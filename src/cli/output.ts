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

import { relative } from 'node:path';
import { FmctlError, ValidationError, serializeValue } from '../lib/index.js';
import type {
  JsonValue,
  SetResult,
  GetResult,
  FrontmatterResult,
  LintResult,
  FileLintResult,
} from '../lib/index.js';

/** Render a `get` result to stdout — plain value for humans, JSON on request. */
export function printGetResult(result: GetResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  process.stdout.write(serializeValue(result.value) + '\n');
}

/** Render a whole-frontmatter read — one `field: value` line per entry, or JSON. */
export function printFrontmatter(result: FrontmatterResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  for (const [field, value] of Object.entries(result.frontmatter)) {
    process.stdout.write(`${field}: ${serializeValue(value)}\n`);
  }
}

/** Render a successful `set` result to stdout (FR-014: results → stdout). */
export function printSetResult(result: SetResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  for (const change of result.changes) {
    if (change.created) {
      process.stdout.write(`${change.field}: created\n`);
    } else {
      process.stdout.write(`${change.field}: ${formatValue(change.before)} → ${formatValue(change.after)}\n`);
    }
  }
}

/** The FR-013 unvalidated-write notice — a diagnostic, so it goes to stderr. */
export function unvalidatedNotice(file: string): void {
  process.stderr.write(`notice: unvalidated write (no schema resolved for ${file})\n`);
}

/** Render a lint report to stdout: one line per non-valid file, then a summary. */
export function printLintResult(result: LintResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  for (const file of result.files) printLintLine(file);
  const s = result.summary;
  process.stdout.write(
    `${s.checked} checked, ${s.valid} valid, ${s.invalid} invalid, ` +
      `${s.errored} errored, ${s.ungoverned} ungoverned, ${s.skipped} skipped\n`,
  );
}

function printLintLine(file: FileLintResult): void {
  const name = relativize(file.file);
  switch (file.status) {
    case 'valid':
      return; // only non-valid files get a line
    case 'invalid':
      for (const v of file.violations) {
        const detail = v.field ? `${v.field}: ${describe(v.value)} — expected ${v.expected}` : v.message;
        process.stdout.write(`✗ ${name}  ${detail}\n`);
      }
      return;
    case 'error':
      process.stdout.write(`✗ ${name}  ${file.error?.message ?? 'error'}\n`);
      return;
    case 'ungoverned':
      process.stdout.write(`! ${name}  ungoverned (no schema)\n`);
      return;
    case 'skipped-no-frontmatter':
      process.stdout.write(`- ${name}  skipped (no frontmatter)\n`);
      return;
  }
}

function relativize(file: string): string {
  const rel = relative(process.cwd(), file);
  return rel.startsWith('..') ? file : rel;
}

/**
 * Render an error to stderr and return its exit code. fmctl errors carry their
 * own exit code (the documented contract); anything else is an unexpected
 * failure mapped to 1.
 */
export function fail(err: unknown, json: boolean): number {
  if (err instanceof FmctlError) {
    if (json) {
      const error: Record<string, unknown> = { code: err.code, message: err.message };
      if (err.file !== undefined) error.file = err.file;
      if (err.field !== undefined) error.field = err.field;
      if (err instanceof ValidationError) error.violations = err.violations;
      process.stderr.write(JSON.stringify({ error }) + '\n');
    } else {
      process.stderr.write(`error: ${err.message}\n`);
      if (err instanceof ValidationError) {
        for (const v of err.violations) {
          const where = v.field ? `${v.field}: ` : '';
          process.stderr.write(`  ✗ ${where}${describe(v.value)} — expected ${v.expected}\n`);
        }
      }
    }
    return err.exitCode;
  }
  process.stderr.write(`error: ${(err as Error).message ?? String(err)}\n`);
  return 1;
}

function formatValue(value: JsonValue | undefined): string {
  return value === undefined ? '∅' : serializeValue(value);
}

function describe(value: unknown): string {
  if (value === undefined) return '(absent)';
  return serializeValue(value as JsonValue);
}
