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

import { readFileSync, mkdtempSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the fixtures root (tests/fixtures). */
export const FIXTURES_ROOT = join(HERE, '..', 'fixtures');

/**
 * Copy a fixture tree into a fresh temp directory, renaming `_gitignore`
 * entries to `.gitignore`. Fixtures store ignore files under `_gitignore` so a
 * committed `.gitignore` doesn't make git ignore the fixtures themselves; the
 * rename also exercises the no-git-repo case (the temp dir is not a repo).
 * Caller is responsible for removing the returned directory.
 */
export function stageTree(fixtureSubpath: string): string {
  const dest = mkdtempSync(join(tmpdir(), 'fmctl-tree-'));
  copyTree(join(FIXTURES_ROOT, fixtureSubpath), dest);
  return dest;
}

function copyTree(src: string, dest: string): void {
  for (const entry of readdirSync(src)) {
    if (entry === '.gitkeep') continue;
    const from = join(src, entry);
    const to = join(dest, entry === '_gitignore' ? '.gitignore' : entry);
    if (statSync(from).isDirectory()) {
      mkdirSync(to, { recursive: true });
      copyTree(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

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
