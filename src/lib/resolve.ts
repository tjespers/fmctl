import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import { FrontmatterDocument } from './document.js';
import { SchemaUnresolvableError } from './errors.js';
import type { GoverningSchema, Modeline } from './types.js';

export interface ResolveOptions {
  /** Per-invocation override: absolute or cwd-relative path. */
  schema?: string;
}

/**
 * Resolve which schema governs a file (FR-008): per-invocation override →
 * in-file modeline → none. Loads the file to read its modeline; callers that
 * already hold a {@link FrontmatterDocument} should use {@link resolveFromDoc}
 * to avoid re-reading. No ambient or global configuration is consulted.
 */
export async function resolveSchema(
  filePath: string,
  options: ResolveOptions = {},
): Promise<GoverningSchema | null> {
  if (options.schema !== undefined) {
    return resolveOverride(options.schema);
  }
  const doc = await FrontmatterDocument.load(filePath);
  return resolveFromDoc(doc, options);
}

/** Resolve governance for an already-loaded document (no re-read). */
export async function resolveFromDoc(
  doc: FrontmatterDocument,
  options: ResolveOptions = {},
): Promise<GoverningSchema | null> {
  if (options.schema !== undefined) {
    return resolveOverride(options.schema);
  }
  if (doc.modeline) {
    return resolveModeline(doc.modeline, doc.path);
  }
  return null;
}

async function resolveOverride(schema: string): Promise<GoverningSchema> {
  const location = isAbsolute(schema) ? schema : resolvePath(process.cwd(), schema);
  await assertReadable(location, schema);
  return { authority: 'invocation', location };
}

async function resolveModeline(modeline: Modeline, filePath: string): Promise<GoverningSchema> {
  const ref = modeline.schema;
  if (ref.kind === 'uri') {
    throw new SchemaUnresolvableError(
      `schema URI references are reserved for a future version: ${ref.ref} (in ${filePath})`,
      { file: filePath, code: 'schema-uri-reserved' },
    );
  }
  await assertReadable(ref.location!, ref.ref, filePath);
  return { authority: 'document', location: ref.location! };
}

async function assertReadable(location: string, ref: string, file = location): Promise<void> {
  try {
    await access(location, constants.R_OK);
  } catch (err) {
    throw new SchemaUnresolvableError(`schema not found or unreadable: ${ref}`, {
      file,
      cause: err,
    });
  }
}
