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
import { join } from 'node:path';
import { getField, getFrontmatter } from '../../src/lib/api';
import { FieldNotFoundError, NoFrontmatterError, ParseError } from '../../src/lib/errors';
import { FIXTURES_ROOT } from '../helpers/corpus';

const simple = join(FIXTURES_ROOT, 'splice', 'simple.md');
const odd = join(FIXTURES_ROOT, 'splice', 'odd-spacing.md');

describe('getField', () => {
  it('reads a scalar field', async () => {
    const result = await getField(simple, 'status');
    expect(result).toEqual({ file: simple, field: 'status', value: 'draft' });
  });

  it('reads a list field in full', async () => {
    const result = await getField(simple, 'links');
    expect(result.value).toEqual(['./other.md']);
  });

  it('reads an object-valued field in full', async () => {
    const result = await getField(odd, 'nested');
    expect(result.value).toEqual({ k: 'v' });
  });

  it('throws FieldNotFoundError for a missing field', async () => {
    await expect(getField(simple, 'nope')).rejects.toBeInstanceOf(FieldNotFoundError);
  });

  it('looks up a dotted name literally (no nested addressing) → not found', async () => {
    await expect(getField(odd, 'nested.k')).rejects.toBeInstanceOf(FieldNotFoundError);
  });

  it('throws NoFrontmatterError when the file has no block', async () => {
    await expect(getField(join(FIXTURES_ROOT, 'splice', 'no-frontmatter.md'), 'x')).rejects.toBeInstanceOf(
      NoFrontmatterError,
    );
  });

  it('passes through ParseError on malformed frontmatter', async () => {
    await expect(getField(join(FIXTURES_ROOT, 'splice', 'broken-yaml.md'), 'status')).rejects.toBeInstanceOf(
      ParseError,
    );
  });
});

describe('getFrontmatter', () => {
  it('returns the whole frontmatter as JSON-representable data', async () => {
    const result = await getFrontmatter(simple);
    expect(result.file).toBe(simple);
    expect(result.frontmatter).toEqual({ status: 'draft', type: 'task', links: ['./other.md'] });
  });

  it('returns an empty object for an empty frontmatter block', async () => {
    const result = await getFrontmatter(join(FIXTURES_ROOT, 'splice', 'empty-block.md'));
    expect(result.frontmatter).toEqual({});
  });

  it('throws NoFrontmatterError when there is no block', async () => {
    await expect(getFrontmatter(join(FIXTURES_ROOT, 'splice', 'no-frontmatter.md'))).rejects.toBeInstanceOf(
      NoFrontmatterError,
    );
  });

  it('passes through ParseError on malformed frontmatter', async () => {
    await expect(getFrontmatter(join(FIXTURES_ROOT, 'splice', 'broken-yaml.md'))).rejects.toBeInstanceOf(ParseError);
  });

  it('never surfaces the modeline as a field', async () => {
    const result = await getFrontmatter(join(FIXTURES_ROOT, 'modeline', 'governed.md'));
    expect(result.frontmatter).toEqual({ status: 'draft', type: 'task' });
  });
});
