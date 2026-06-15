import { readFile } from 'node:fs/promises';
import { isMap, isScalar, parseDocument } from 'yaml';
import {
  DuplicateKeyError,
  FileNotFoundError,
  IoError,
  NoFrontmatterError,
  NotRepresentableError,
  ParseError,
} from './errors.js';
import { scanModeline } from './modeline.js';
import type { JsonValue, Modeline } from './types.js';

/** The delimited YAML region at the top of a document. */
export interface FrontmatterRegion {
  /** Raw text between (exclusive of) the `---` delimiter lines. */
  text: string;
  /** Byte offsets of `text` within `raw`. */
  range: [number, number];
}

/** A located top-level frontmatter entry. */
export interface Field {
  name: string;
  value: JsonValue;
  /** Byte offsets of the value node within `frontmatter.text`. */
  valueRange: [number, number];
  /** 1-based line span of the whole entry within `frontmatter.text`. */
  entryLines: [number, number];
}

interface DocumentInit {
  path: string;
  raw: string;
  frontmatter: FrontmatterRegion;
  body: string;
  data: Record<string, JsonValue>;
  fields: Map<string, Field>;
  modeline: Modeline | null;
}

/**
 * The parsed representation of one Markdown file. Immutable once loaded; edits
 * produce new text via the splice engine. Construction fails with a typed error
 * rather than producing a partial document (constitution Principle III).
 */
export class FrontmatterDocument {
  readonly path: string;
  readonly raw: string;
  readonly frontmatter: FrontmatterRegion;
  readonly body: string;
  readonly data: Record<string, JsonValue>;
  readonly modeline: Modeline | null;
  private readonly fields: Map<string, Field>;

  private constructor(init: DocumentInit) {
    this.path = init.path;
    this.raw = init.raw;
    this.frontmatter = init.frontmatter;
    this.body = init.body;
    this.data = init.data;
    this.fields = init.fields;
    this.modeline = init.modeline;
  }

  /** Read a file from disk and parse it. */
  static async load(path: string): Promise<FrontmatterDocument> {
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'EISDIR') {
        throw new FileNotFoundError(`file not found: ${path}`, { file: path, cause: err });
      }
      throw new IoError(`cannot read ${path}: ${(err as Error).message}`, { file: path, cause: err });
    }
    return FrontmatterDocument.fromString(raw, path);
  }

  /** Parse a document from in-memory content (used by `load` and by tests). */
  static fromString(raw: string, path = ''): FrontmatterDocument {
    const region = splitFrontmatter(raw, path);
    const doc = parseDocument(region.text);

    for (const err of doc.errors) {
      if (err.code === 'DUPLICATE_KEY') {
        throw new DuplicateKeyError(`duplicate key in frontmatter of ${path || '<input>'}`, {
          file: path,
          cause: err,
        });
      }
    }
    if (doc.errors.length > 0) {
      const first = doc.errors[0]!;
      throw new ParseError(`malformed frontmatter: ${first.message}`, { file: path, cause: first });
    }

    const data: Record<string, JsonValue> = {};
    const fields = new Map<string, Field>();
    const contents = doc.contents;

    if (contents != null) {
      if (!isMap(contents)) {
        throw new NotRepresentableError(`frontmatter is not a mapping of fields in ${path || '<input>'}`, {
          file: path,
        });
      }
      const full = (doc.toJS() ?? {}) as Record<string, unknown>;
      for (const pair of contents.items) {
        const keyNode = pair.key;
        if (!isScalar(keyNode) || typeof keyNode.value !== 'string') {
          throw new NotRepresentableError(`frontmatter has a non-string key in ${path || '<input>'}`, {
            file: path,
          });
        }
        const name = keyNode.value;
        const value = full[name] as JsonValue;
        assertJsonRepresentable(value, path, name);
        data[name] = value;

        const keyRange = keyNode.range;
        const valueNode = pair.value;
        const valueRange: [number, number] =
          valueNode && isNode(valueNode) && valueNode.range
            ? [valueNode.range[0], valueNode.range[1]]
            : [keyRange![2], keyRange![2]];
        const entryStart = keyRange![0];
        const entryEnd = valueRange[1];
        const entryLines: [number, number] = [
          lineOf(region.text, entryStart),
          lineOf(region.text, Math.max(entryStart, entryEnd - 1)),
        ];
        fields.set(name, { name, value, valueRange, entryLines });
      }
    }

    return new FrontmatterDocument({
      path,
      raw,
      frontmatter: { text: region.text, range: [region.range[0], region.range[1]] },
      body: raw.slice(region.bodyStart),
      data,
      fields,
      modeline: scanModeline(region.text, path),
    });
  }

  /** Locate a top-level field by name, or `undefined` if absent. */
  field(name: string): Field | undefined {
    return this.fields.get(name);
  }

  /** All located top-level fields, in document order. */
  allFields(): Field[] {
    return [...this.fields.values()];
  }
}

interface SplitResult {
  text: string;
  range: [number, number];
  bodyStart: number;
}

/**
 * Locate the frontmatter block by its delimiter lines, returning byte offsets
 * only — never reconstructing text, so the body stays byte-faithful.
 */
function splitFrontmatter(raw: string, path: string): SplitResult {
  const opener = /^---[^\S\r\n]*(\r?\n|$)/.exec(raw);
  if (!opener || opener[1] === '') {
    throw new NoFrontmatterError(`no frontmatter block in ${path || '<input>'}`, { file: path });
  }
  const openEnd = opener[0].length;

  let idx = openEnd;
  while (idx <= raw.length) {
    const nl = raw.indexOf('\n', idx);
    const lineEnd = nl === -1 ? raw.length : nl;
    const line = raw.slice(idx, lineEnd);
    const bare = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (bare === '---' || bare === '...') {
      return {
        text: raw.slice(openEnd, idx),
        range: [openEnd, idx],
        bodyStart: nl === -1 ? raw.length : nl + 1,
      };
    }
    if (nl === -1) break;
    idx = nl + 1;
  }

  throw new ParseError(`frontmatter block is not closed (missing --- delimiter) in ${path || '<input>'}`, {
    file: path,
  });
}

function isNode(value: unknown): value is { range?: [number, number, number] } {
  return typeof value === 'object' && value !== null && 'range' in value;
}

function assertJsonRepresentable(value: unknown, path: string, field: string): void {
  if (value === null) return;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return;
  if (Array.isArray(value)) {
    for (const item of value) assertJsonRepresentable(item, path, field);
    return;
  }
  if (t === 'object') {
    if (value instanceof Date) {
      throw new NotRepresentableError(`field "${field}" holds a date value not representable as JSON`, {
        file: path,
        field,
      });
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      assertJsonRepresentable(item, path, field);
    }
    return;
  }
  throw new NotRepresentableError(`field "${field}" holds a ${t} value not representable as JSON`, {
    file: path,
    field,
  });
}

/** 1-based line number of a byte offset within `text`. */
function lineOf(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}
