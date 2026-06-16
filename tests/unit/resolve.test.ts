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
import { resolveSchema } from '../../src/lib/resolve';
import { SchemaUnresolvableError } from '../../src/lib/errors';
import { FIXTURES_ROOT } from '../helpers/corpus';
import { isAbsolute, join } from 'node:path';

const SCHEMA = join(FIXTURES_ROOT, 'schemas', 'task.json');
const MODELINE = join(FIXTURES_ROOT, 'modeline');

describe('resolveSchema — v0.1 chain (override → none)', () => {
  it('resolves a per-invocation override to an absolute, invocation-authority schema', async () => {
    const gov = await resolveSchema('/any/file.md', { schema: SCHEMA });
    expect(gov).not.toBeNull();
    expect(gov!.authority).toBe('invocation');
    expect(isAbsolute(gov!.location)).toBe(true);
    expect(gov!.location).toBe(SCHEMA);
  });

  it('returns null (ungoverned) when no override and no modeline', async () => {
    const raw = join(FIXTURES_ROOT, 'splice', 'simple.md');
    expect(await resolveSchema(raw)).toBeNull();
  });

  it('throws SchemaUnresolvableError when the override file is missing', async () => {
    await expect(resolveSchema('/any/file.md', { schema: '/no/such/schema.json' })).rejects.toBeInstanceOf(
      SchemaUnresolvableError,
    );
  });

  it('resolves a cwd-relative override against process.cwd()', async () => {
    const rel = 'tests/fixtures/schemas/task.json';
    const gov = await resolveSchema('/any/file.md', { schema: rel });
    expect(gov!.location).toBe(join(process.cwd(), rel));
  });
});

describe('resolveSchema — modeline tier (US4)', () => {
  it('resolves a modeline to a document-authority schema', async () => {
    const gov = await resolveSchema(join(MODELINE, 'governed.md'));
    expect(gov).toEqual({ authority: 'document', location: join(MODELINE, 'schema.json') });
  });

  it('lets a per-invocation override beat the modeline', async () => {
    const gov = await resolveSchema(join(MODELINE, 'governed.md'), { schema: SCHEMA });
    expect(gov).toEqual({ authority: 'invocation', location: SCHEMA });
  });

  it('rejects a broken modeline ref with SchemaUnresolvableError', async () => {
    await expect(resolveSchema(join(MODELINE, 'broken-ref.md'))).rejects.toBeInstanceOf(SchemaUnresolvableError);
  });

  it('rejects a URI modeline ref with the distinct schema-uri-reserved code', async () => {
    try {
      await resolveSchema(join(MODELINE, 'uri.md'));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaUnresolvableError);
      expect((err as SchemaUnresolvableError).code).toBe('schema-uri-reserved');
      expect((err as SchemaUnresolvableError).exitCode).toBe(5);
    }
  });
});
