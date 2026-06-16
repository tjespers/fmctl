import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { SchemaInvalidError } from './errors.js';
import type { JsonValue, Violation } from './types.js';

// ajv-formats is CJS with only a default export; NodeNext mistypes the default
// import as a namespace, so pin it to its real call signature.
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;

/** A compiled schema, reusable across many files (lint compiles once). */
export interface CompiledSchema {
  location: string;
  validate(data: Record<string, JsonValue>): Violation[];
}

/**
 * Read, parse, and compile a JSON Schema (draft 2020-12) into a reusable
 * validator that emits translated {@link Violation}s. Any failure to read,
 * parse, or compile the schema is a SchemaInvalidError (R2).
 */
export async function compileSchema(location: string): Promise<CompiledSchema> {
  let text: string;
  try {
    text = await readFile(location, 'utf8');
  } catch (err) {
    throw new SchemaInvalidError(`cannot read schema document: ${location}`, { file: location, cause: err });
  }

  let schemaDoc: unknown;
  try {
    schemaDoc = JSON.parse(text);
  } catch (err) {
    throw new SchemaInvalidError(`schema document is not valid JSON: ${location}`, { file: location, cause: err });
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  let validateFn: ValidateFunction;
  try {
    validateFn = ajv.compile(schemaDoc as object);
  } catch (err) {
    throw new SchemaInvalidError(`invalid JSON Schema: ${location}: ${(err as Error).message}`, {
      file: location,
      cause: err,
    });
  }

  return {
    location,
    validate(data: Record<string, JsonValue>): Violation[] {
      if (validateFn(data)) return [];
      return (validateFn.errors ?? []).map((err) => translate(data, err));
    },
  };
}

function translate(data: Record<string, JsonValue>, err: ErrorObject): Violation {
  const field = fieldOf(err);
  return {
    field,
    value: valueOf(data, err),
    message: err.message ?? 'schema violation',
    expected: expectedOf(err),
    keyword: err.keyword,
  };
}

function fieldOf(err: ErrorObject): string | null {
  if (err.keyword === 'required') {
    return String((err.params as { missingProperty: string }).missingProperty);
  }
  if (err.instancePath === '') return null;
  return err.instancePath.replace(/^\//, '').replace(/\//g, '.');
}

function valueOf(data: Record<string, JsonValue>, err: ErrorObject): unknown {
  if (err.keyword === 'required') return undefined;
  if (err.instancePath === '') return data;
  const tokens = err.instancePath
    .split('/')
    .slice(1)
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: unknown = data;
  for (const token of tokens) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[token];
  }
  return cur;
}

function expectedOf(err: ErrorObject): string {
  switch (err.keyword) {
    case 'enum':
      return 'one of: ' + (err.params as { allowedValues: unknown[] }).allowedValues.join(', ');
    case 'required':
      return `required property "${(err.params as { missingProperty: string }).missingProperty}"`;
    case 'type':
      return String((err.params as { type: string }).type);
    default:
      return err.message ?? '';
  }
}
