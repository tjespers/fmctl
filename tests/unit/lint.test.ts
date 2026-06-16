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
import { lintPaths } from '../../src/lib/lint';
import { FileNotFoundError } from '../../src/lib/errors';
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

describe('lintPaths — discovery + report', () => {
  it('classifies each file and honors .gitignore (root + nested, dir-only + negation)', async () => {
    const root = tree();
    const result = await lintPaths([root], { schema: SCHEMA });
    const get = (name: string) => result.files.find((f) => f.file.endsWith('/' + name));
    expect(get('ok.md')!.status).toBe('valid');
    expect(get('bad.md')!.status).toBe('invalid');
    expect(get('README.md')!.status).toBe('skipped-no-frontmatter');
    expect(get('broken.md')!.status).toBe('error');
    expect(get('deep.md')!.status).toBe('valid');
    expect(get('hidden.md')!.status).toBe('valid'); // hidden .docs/ dir is walked

    // negation: *.draft.md ignored, but keep.draft.md re-included
    expect(get('keep.draft.md')!.status).toBe('valid');
    expect(get('notes.draft.md')).toBeUndefined();

    // dir-only ignore + nested ignore: never discovered
    expect(get('secret.md')).toBeUndefined();
    expect(get('skip.md')).toBeUndefined();
  });

  it('produces correct summary counts', async () => {
    const result = await lintPaths([tree()], { schema: SCHEMA });
    expect(result.summary).toEqual({
      checked: 5, // ok, keep.draft, deep, hidden (valid) + bad (invalid)
      valid: 4,
      invalid: 1,
      ungoverned: 0,
      skipped: 1, // README
      errored: 1, // broken
    });
  });

  it('attributes the governing schema and authority per checked file', async () => {
    const result = await lintPaths([tree()], { schema: SCHEMA });
    const ok = result.files.find((f) => f.file.endsWith('/ok.md'))!;
    expect(ok.governedBy).toMatchObject({ authority: 'invocation', location: SCHEMA });
  });

  it('isolates faults: a malformed file is one error entry, the walk continues', async () => {
    const result = await lintPaths([tree()], { schema: SCHEMA });
    const broken = result.files.find((f) => f.file.endsWith('/broken.md'))!;
    expect(broken.status).toBe('error');
    expect(broken.error).toMatchObject({ code: expect.any(String), message: expect.any(String) });
    // other files still checked
    expect(result.files.some((f) => f.status === 'valid')).toBe(true);
  });

  it('reports invalid files with their violations', async () => {
    const result = await lintPaths([tree()], { schema: SCHEMA });
    const bad = result.files.find((f) => f.file.endsWith('/bad.md'))!;
    expect(bad.violations[0]).toMatchObject({ field: 'status', value: 'bogus', keyword: 'enum' });
  });

  it('marks every file ungoverned when no schema resolves', async () => {
    const result = await lintPaths([tree()]);
    expect(result.summary.checked).toBe(0);
    expect(result.summary.ungoverned).toBeGreaterThan(0);
    // (excluding the malformed/skipped ones, the rest are ungoverned)
    const ok = result.files.find((f) => f.file.endsWith('/ok.md'))!;
    expect(ok.status).toBe('ungoverned');
    expect(ok.governedBy).toBeNull();
  });

  it('lints an explicitly named file directly, even when .gitignore would exclude it', async () => {
    const root = tree();
    const result = await lintPaths([join(root, 'notes.draft.md')], { schema: SCHEMA });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.file).toBe(join(root, 'notes.draft.md'));
    expect(result.files[0]!.status).toBe('invalid');
  });

  it('throws FileNotFoundError when a root path does not exist', async () => {
    await expect(lintPaths(['/no/such/path'], { schema: SCHEMA })).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
