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
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setFields } from '../../src/lib/api';
import { ValidationError, UsageError } from '../../src/lib/errors';
import { readFixture, FIXTURES_ROOT } from '../helpers/corpus';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const dirs: string[] = [];

function stage(fixture: string): { path: string; original: string } {
  const dir = mkdtempSync(join(tmpdir(), 'fmctl-set-'));
  dirs.push(dir);
  const path = join(dir, 'doc.md');
  const original = readFixture(fixture);
  writeFileSync(path, original);
  return { path, original };
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('setFields', () => {
  it('applies multiple fields together (all-or-nothing) and reports changes', async () => {
    const { path } = stage('splice/simple.md');
    const result = await setFields(path, { status: 'review', type: 'decision' }, { schema: SCHEMA });
    expect(result.changes).toEqual([
      { field: 'status', before: 'draft', after: 'review', created: false },
      { field: 'type', before: 'task', after: 'decision', created: false },
    ]);
    const data = (await import('../../src/lib/document')).FrontmatterDocument.fromString(readFileSync(path, 'utf8')).data;
    expect(data.status).toBe('review');
    expect(data.type).toBe('decision');
  });

  it('reports created fields as appended with before=undefined', async () => {
    const { path } = stage('splice/simple.md');
    const result = await setFields(path, { priority: 'high' }, { schema: SCHEMA });
    expect(result.changes[0]).toEqual({ field: 'priority', before: undefined, after: 'high', created: true });
  });

  it('refuses a schema-violating write and leaves the file byte-identical', async () => {
    const { path, original } = stage('splice/simple.md');
    await expect(setFields(path, { status: 'bogus' }, { schema: SCHEMA })).rejects.toBeInstanceOf(ValidationError);
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  it('ValidationError carries violations naming the field and allowed values', async () => {
    const { path } = stage('splice/simple.md');
    try {
      await setFields(path, { status: 'bogus' }, { schema: SCHEMA });
      expect.unreachable();
    } catch (err) {
      const v = (err as ValidationError).violations;
      expect(v[0]).toMatchObject({ field: 'status', value: 'bogus', keyword: 'enum' });
      expect(v[0]!.expected).toContain('draft');
    }
  });

  it('marks governance state: validated under a schema', async () => {
    const { path } = stage('splice/simple.md');
    const result = await setFields(path, { status: 'review' }, { schema: SCHEMA });
    expect(result.validated).toBe(true);
    expect(result.bypassed).toBe(false);
    expect(result.governedBy).toMatchObject({ authority: 'invocation', location: SCHEMA });
  });

  it('bypass skips validation only (writes a schema-invalid value)', async () => {
    const { path } = stage('splice/simple.md');
    const result = await setFields(path, { status: 'bogus' }, { schema: SCHEMA, bypassValidation: true });
    expect(result.validated).toBe(false);
    expect(result.bypassed).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('status: bogus');
  });

  it('writes unvalidated when no schema resolves (validated=false, governedBy=null)', async () => {
    const { path } = stage('splice/simple.md');
    const result = await setFields(path, { status: 'anything' });
    expect(result.validated).toBe(false);
    expect(result.bypassed).toBe(false);
    expect(result.governedBy).toBeNull();
    expect(readFileSync(path, 'utf8')).toContain('status: anything');
  });

  it('rejects a dotted field name with UsageError(nested-path-unsupported); nothing written', async () => {
    const { path, original } = stage('splice/simple.md');
    let thrown: unknown;
    await setFields(path, { 'meta.author': 'x' }).catch((e) => (thrown = e));
    expect(thrown).toBeInstanceOf(UsageError);
    expect((thrown as UsageError).code).toBe('nested-path-unsupported');
    expect(readFileSync(path, 'utf8')).toBe(original);
  });
});
