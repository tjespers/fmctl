import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the fixtures root (tests/fixtures). */
export const FIXTURES_ROOT = join(HERE, '..', 'fixtures');

/** Read a fixture as a byte-faithful UTF-8 string (CRLF preserved). */
export function readFixture(relPath: string): string {
  return readFileSync(join(FIXTURES_ROOT, relPath), 'utf8');
}

/** Read a fixture as raw bytes for byte-level equality assertions. */
export function readFixtureBytes(relPath: string): Buffer {
  return readFileSync(join(FIXTURES_ROOT, relPath));
}

/**
 * Assert two strings are byte-for-byte identical (UTF-8). Unlike `toEqual`,
 * a failure reports the first differing byte offset — the executable form of
 * the byte-conservatism guarantee (FR-004).
 */
export function expectBytesEqual(actual: string, expected: string): void {
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (!a.equals(b)) {
    const at = firstDiff(a, b);
    expect.fail(
      `byte mismatch at offset ${at}: ` +
        `actual=${JSON.stringify(sliceAround(actual, at))} ` +
        `expected=${JSON.stringify(sliceAround(expected, at))}`,
    );
  }
}

function firstDiff(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return n; // one is a prefix of the other
}

function sliceAround(s: string, at: number): string {
  return s.slice(Math.max(0, at - 12), at + 12);
}
