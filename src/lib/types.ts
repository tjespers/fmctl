// Copyright 2026 Tim Jespers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

/** The serialized form of an FmctlError carried as data inside a lint result. */
export interface ErrorInfo {
  code: string;
  message: string;
}

export type FileLintStatus =
  | 'valid'
  | 'invalid'
  | 'ungoverned'
  | 'skipped-no-frontmatter'
  | 'error';

export interface FileLintResult {
  file: string;
  status: FileLintStatus;
  governedBy: GoverningSchema | null;
  violations: Violation[];
  error: ErrorInfo | null;
}

export interface LintSummary {
  checked: number;
  valid: number;
  invalid: number;
  ungoverned: number;
  skipped: number;
  errored: number;
}

export interface LintResult {
  files: FileLintResult[];
  summary: LintSummary;
}

/** The outcome of schema resolution for one file (FR-008); `null` = ungoverned. */
export interface GoverningSchema {
  /**
   * On whose say-so the schema governs: `invocation` = per-invocation override
   * (`--schema` / library option); `document` = the file's own modeline.
   * `'project'` is reserved for the future configuration spec.
   */
  authority: 'invocation' | 'document';
  /** Absolute path of the governing schema document. */
  location: string;
}
