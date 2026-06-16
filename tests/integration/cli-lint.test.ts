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

import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../helpers/cli';
import { stageTree, FIXTURES_ROOT } from '../helpers/corpus';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const trees: string[] = [];
function tree(): string {
  const d = stageTree('lint');
  trees.push(d);
  return d;
}
afterEach(() => {
  for (const d of trees.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('fmctl lint (integration)', () => {
  it('prints per-file lines and a summary; exit 1 on invalid/error', () => {
    const run = runCli(['lint', tree(), '--schema', SCHEMA]);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('✗'); // bad.md / broken.md
    expect(run.stdout).toContain('- '); // README skipped
    expect(run.stdout).toMatch(/\d+ checked, \d+ valid, \d+ invalid/);
  });

  it('emits the full LintResult as JSON', () => {
    const run = runCli(['lint', tree(), '--schema', SCHEMA, '--json']);
    expect(run.status).toBe(1);
    const result = JSON.parse(run.stdout);
    expect(result.summary).toEqual({
      checked: 5,
      valid: 4,
      invalid: 1,
      ungoverned: 0,
      skipped: 1,
      errored: 1,
    });
    // gitignored files never appear
    expect(result.files.some((f: { file: string }) => f.file.endsWith('secret.md'))).toBe(false);
    expect(result.files.some((f: { file: string }) => f.file.endsWith('notes.draft.md'))).toBe(false);
  });

  it('exit 5 when the --schema override is unusable', () => {
    const run = runCli(['lint', tree(), '--schema', '/no/such/schema.json']);
    expect(run.status).toBe(5);
  });

  it('exit 5 (nothing-validated) when no schema resolves for any file', () => {
    const root = tree();
    const run = runCli(['lint', join(root, 'nested')]); // deep.md present, no schema
    expect(run.status).toBe(5);
    expect(run.stderr).toContain('nothing could be validated');
  });

  it('exit 0 when only valid and skipped files are present', () => {
    const root = tree();
    const run = runCli(['lint', join(root, 'ok.md'), join(root, 'README.md'), '--schema', SCHEMA]);
    expect(run.status).toBe(0);
  });
});
