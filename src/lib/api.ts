import { isAbsolute, resolve as resolvePath } from 'node:path';
import { FrontmatterDocument } from './document.js';
import { spliceFields } from './splice.js';
import type { FieldChange } from './splice.js';
import { resolveFromDoc } from './resolve.js';
import { compileSchema } from './validate.js';
import { writeVerified } from './writer.js';
import { FieldNotFoundError, UsageError, ValidationError } from './errors.js';
import type { GoverningSchema, JsonValue } from './types.js';

export interface GetResult {
  file: string;
  field: string;
  value: JsonValue;
}

/**
 * Read one top-level frontmatter field (FR-001). Field names are literal
 * top-level keys — a dotted name is looked up literally, not as a nested path.
 */
export async function getField(filePath: string, field: string): Promise<GetResult> {
  const absPath = isAbsolute(filePath) ? filePath : resolvePath(process.cwd(), filePath);
  const doc = await FrontmatterDocument.load(absPath);
  const located = doc.field(field);
  if (!located) {
    throw new FieldNotFoundError(`field not found: "${field}" in ${absPath}`, { file: absPath, field });
  }
  return { file: absPath, field, value: located.value };
}

export interface SetOptions {
  /** Per-invocation override: absolute or cwd-relative path. */
  schema?: string;
  /** Skip schema validation only (FR-006); integrity guarantees still apply. */
  bypassValidation?: boolean;
}

export interface FieldChangeResult {
  field: string;
  before: JsonValue | undefined;
  after: JsonValue;
  created: boolean;
}

export interface SetResult {
  file: string;
  changes: FieldChangeResult[];
  /** True only when a schema resolved and validation actually ran. */
  validated: boolean;
  /** True when validation was explicitly bypassed (FR-006). */
  bypassed: boolean;
  governedBy: GoverningSchema | null;
}

/**
 * Update and/or create one or more top-level fields atomically — all changes
 * validate and land together, or nothing is written (FR-002–FR-007). Values are
 * whole-value replacements; a dotted field name is rejected (nested addressing
 * is unsupported in v0.1).
 */
export async function setFields(
  filePath: string,
  changes: Record<string, JsonValue>,
  options: SetOptions = {},
): Promise<SetResult> {
  const names = Object.keys(changes);
  if (names.length === 0) {
    throw new UsageError('no fields to set');
  }
  for (const name of names) {
    if (name.includes('.')) {
      throw new UsageError(`nested paths are unsupported in this version: "${name}"`, {
        field: name,
        code: 'nested-path-unsupported',
      });
    }
  }

  const absPath = isAbsolute(filePath) ? filePath : resolvePath(process.cwd(), filePath);
  const doc = await FrontmatterDocument.load(absPath);
  const fieldChanges: FieldChange[] = names.map((name) => ({ name, value: changes[name] as JsonValue }));

  const governedBy = await resolveFromDoc(
    doc,
    options.schema !== undefined ? { schema: options.schema } : {},
  );
  const bypassed = options.bypassValidation === true;
  let validated = false;

  if (governedBy && !bypassed) {
    const intended: Record<string, JsonValue> = { ...doc.data };
    for (const change of fieldChanges) intended[change.name] = change.value;

    const schema = await compileSchema(governedBy.location);
    const violations = schema.validate(intended);
    if (violations.length > 0) {
      throw new ValidationError(`frontmatter does not satisfy its schema: ${absPath}`, violations, {
        file: absPath,
      });
    }
    validated = true;
  }

  const { raw } = spliceFields(doc, fieldChanges);
  await writeVerified({ path: absPath, oldDoc: doc, newRaw: raw, changes: fieldChanges });

  const changeResults: FieldChangeResult[] = fieldChanges.map((change) => {
    const existed = doc.field(change.name) !== undefined;
    return {
      field: change.name,
      before: existed ? doc.data[change.name] : undefined,
      after: change.value,
      created: !existed,
    };
  });

  return { file: absPath, changes: changeResults, validated, bypassed, governedBy };
}
