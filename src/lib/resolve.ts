import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import { SchemaUnresolvableError } from './errors.js';
import type { GoverningSchema } from './types.js';

export interface ResolveOptions {
  /** Per-invocation override: absolute or cwd-relative path. */
  schema?: string;
}

/**
 * Resolve which schema governs a file (FR-008). v0.1 precedence: per-invocation
 * override → in-file modeline → none. The modeline tier is wired in Phase 6;
 * for now an absent override yields `null` (ungoverned). No ambient or global
 * configuration is ever consulted.
 */
export async function resolveSchema(
  filePath: string,
  options: ResolveOptions = {},
): Promise<GoverningSchema | null> {
  if (options.schema !== undefined) {
    const location = isAbsolute(options.schema)
      ? options.schema
      : resolvePath(process.cwd(), options.schema);
    await assertReadable(location, options.schema);
    return { authority: 'invocation', location };
  }

  // Phase 6: consult filePath's modeline here before returning null.
  void filePath;
  return null;
}

async function assertReadable(location: string, ref: string): Promise<void> {
  try {
    await access(location, constants.R_OK);
  } catch (err) {
    throw new SchemaUnresolvableError(`schema not found or unreadable: ${ref}`, {
      file: location,
      cause: err,
    });
  }
}
