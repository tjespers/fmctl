import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { getField } from '../../src/lib/api';
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
