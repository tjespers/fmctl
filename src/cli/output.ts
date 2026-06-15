import { FmctlError, ValidationError, serializeValue } from '../lib/index.js';
import type { JsonValue, SetResult } from '../lib/index.js';

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
