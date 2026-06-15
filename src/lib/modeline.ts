import { dirname, isAbsolute, resolve } from 'node:path';
import type { Modeline, SchemaRef } from './types.js';

// A YAML comment line inside the frontmatter block: `# fmctl: $schema=<ref>`.
// Whitespace-tolerant; the `fmctl:` namespace reserves room for future
// directives. Scanned from raw text (not walked as comment nodes) per R3.
const MODELINE_RE = /^[ \t]*#[ \t]*fmctl:[ \t]*\$schema[ \t]*=[ \t]*(\S+)[ \t]*$/;

/**
 * Scan a frontmatter block's raw text for the first fmctl modeline (FR-009).
 * Returns the parsed modeline or `null`. The modeline is metadata about the
 * document, never part of its data — callers must never surface it as a field.
 */
export function scanModeline(frontmatterText: string, filePath: string): Modeline | null {
  for (const rawLine of frontmatterText.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const match = MODELINE_RE.exec(line);
    if (match) {
      return { raw: line, schema: parseSchemaRef(match[1]!, filePath) };
    }
  }
  return null;
}

function parseSchemaRef(ref: string, filePath: string): SchemaRef {
  if (/^https?:\/\//i.test(ref)) {
    return { ref, kind: 'uri', location: null };
  }
  if (isAbsolute(ref)) {
    return { ref, kind: 'absolute', location: ref };
  }
  return { ref, kind: 'relative', location: resolve(dirname(filePath), ref) };
}
