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
import { parseValue, serializeValue } from '../../src/lib/values';
import { UsageError } from '../../src/lib/errors';
import type { JsonValue } from '../../src/lib/types';

describe('parseValue', () => {
  it('types plain scalars by YAML rules', () => {
    expect(parseValue('draft')).toBe('draft');
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
    expect(parseValue('42')).toBe(42);
    expect(parseValue('3.14')).toBe(3.14);
    expect(parseValue('null')).toBeNull();
  });

  it('forces a string when quoted', () => {
    expect(parseValue('"42"')).toBe('42');
    expect(parseValue('"true"')).toBe('true');
  });

  it('parses a leading-[ flow sequence, including JSON array input', () => {
    expect(parseValue('[./a.md, ./b.md]')).toEqual(['./a.md', './b.md']);
    expect(parseValue('["a","b"]')).toEqual(['a', 'b']);
    expect(parseValue('[]')).toEqual([]);
  });

  it('parses a leading-{ flow mapping, including JSON object input', () => {
    expect(parseValue('{k: v}')).toEqual({ k: 'v' });
    expect(parseValue('{"k":"v","n":2}')).toEqual({ k: 'v', n: 2 });
  });

  it('rejects unparseable value syntax with UsageError', () => {
    expect(() => parseValue('[unclosed')).toThrowError(UsageError);
    expect(() => parseValue('{also: [broken')).toThrowError(UsageError);
  });

  it('rejects values not representable as JSON (e.g. explicit timestamp)', () => {
    expect(() => parseValue('!!timestamp 2020-01-01')).toThrowError(UsageError);
  });
});

describe('serializeValue', () => {
  it('renders scalars without a trailing newline', () => {
    expect(serializeValue('draft')).toBe('draft');
    expect(serializeValue(true)).toBe('true');
    expect(serializeValue(42)).toBe('42');
    expect(serializeValue(null)).toBe('null');
  });

  it('quotes a string that would otherwise parse as another type', () => {
    expect(serializeValue('42')).toBe('"42"');
  });

  it('renders collections in flow style', () => {
    expect(serializeValue(['./a.md', './b.md'])).toMatch(/^\[.*\]$/);
    expect(serializeValue({ k: 'v' })).toMatch(/^\{.*\}$/);
  });

  it('round-trips every value back to an identical parse', () => {
    const values: JsonValue[] = [
      'draft',
      '42',
      true,
      42,
      3.14,
      null,
      ['./a.md', './b.md'],
      { k: 'v', n: 2 },
      { a: [1, 2], b: { c: 'd' } },
    ];
    for (const v of values) {
      expect(parseValue(serializeValue(v))).toEqual(v);
    }
  });
});
