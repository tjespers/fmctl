// Shared value vocabulary for fmctl. Pure type declarations — no behavior.

/** A frontmatter value that maps cleanly onto JSON (the validation data model). */
export type Scalar = string | number | boolean | null;
export type JsonValue = Scalar | JsonValue[] | { [key: string]: JsonValue };

/**
 * One way a file's frontmatter fails its schema (translated from an Ajv error).
 * `field` names the offending property; it is `null` only for document-level
 * violations that name no field (e.g. a root type mismatch).
 */
export interface Violation {
  field: string | null;
  value: unknown;
  message: string;
  expected: string;
  keyword: string;
}

/** A schema reference parsed from a modeline `$schema=<ref>` directive. */
export interface SchemaRef {
  /** The raw `<ref>` text after `$schema=`. */
  ref: string;
  /** Absolute and relative refs resolve to a path; `uri` is reserved (v0.1). */
  kind: 'absolute' | 'relative' | 'uri';
  /** Absolute path after resolution; `null` for `uri`. */
  location: string | null;
}

/** The parsed `# fmctl: …` comment inside a frontmatter block. */
export interface Modeline {
  /** The full comment line as found. */
  raw: string;
  /** The parsed `$schema=` directive. */
  schema: SchemaRef;
}
