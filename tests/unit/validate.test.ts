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

import { describe, expect, it } from 'vitest';
import { compileSchema } from '../../src/lib/validate';
import { SchemaInvalidError } from '../../src/lib/errors';
import { FIXTURES_ROOT } from '../helpers/corpus';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TASK = join(FIXTURES_ROOT, 'schemas', 'task.json');
const TYPED = join(FIXTURES_ROOT, 'schemas', 'typed.json');

describe('compileSchema + validate', () => {
  it('passes valid data with no violations', async () => {
    const schema = await compileSchema(TASK);
    expect(schema.validate({ status: 'draft', type: 'task' })).toEqual([]);
  });

  it('translates an enum violation with allowed values', async () => {
    const schema = await compileSchema(TASK);
    const [v] = schema.validate({ status: 'bogus', type: 'task' });
    expect(v).toMatchObject({ field: 'status', value: 'bogus', keyword: 'enum' });
    expect(v!.expected).toBe('one of: draft, review, done');
  });

  it('names the missing field on a required violation (not null)', async () => {
    const schema = await compileSchema(TASK);
    const violations = schema.validate({ status: 'draft' });
    const required = violations.find((x) => x.keyword === 'required');
    expect(required).toBeDefined();
    expect(required!.field).toBe('type');
    expect(required!.expected).toContain('type');
  });

  it('reports a type mismatch', async () => {
    const schema = await compileSchema(TASK);
    const [v] = schema.validate({ status: 'draft', type: 'task', links: 'nope' });
    expect(v).toMatchObject({ field: 'links', keyword: 'type' });
    expect(v!.expected).toBe('array');
  });

  it('collects all errors at once (allErrors)', async () => {
    const schema = await compileSchema(TASK);
    const violations = schema.validate({ status: 'bogus', type: 'nope' });
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('validates through a composed per-type schema (allOf + if/then on type)', async () => {
    const schema = await compileSchema(TYPED);
    // a task requires status
    const taskMissing = schema.validate({ type: 'task' });
    expect(taskMissing.some((v) => v.keyword === 'required' && v.field === 'status')).toBe(true);
    // a decision requires outcome, not status
    const decisionMissing = schema.validate({ type: 'decision' });
    expect(decisionMissing.some((v) => v.keyword === 'required' && v.field === 'outcome')).toBe(true);
    // a well-formed task passes
    expect(schema.validate({ type: 'task', status: 'review' })).toEqual([]);
  });

  it('throws SchemaInvalidError on unreadable / non-JSON / invalid schema', async () => {
    await expect(compileSchema('/no/such/schema.json')).rejects.toBeInstanceOf(SchemaInvalidError);

    const dir = mkdtempSync(join(tmpdir(), 'fmctl-schema-'));
    const notJson = join(dir, 'bad.json');
    writeFileSync(notJson, '{ not json');
    await expect(compileSchema(notJson)).rejects.toBeInstanceOf(SchemaInvalidError);

    const badSchema = join(dir, 'bad-schema.json');
    writeFileSync(badSchema, JSON.stringify({ type: 'not-a-real-type' }));
    await expect(compileSchema(badSchema)).rejects.toBeInstanceOf(SchemaInvalidError);
  });
});
