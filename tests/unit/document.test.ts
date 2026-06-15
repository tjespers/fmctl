import { describe, expect, it } from 'vitest';
import { FrontmatterDocument } from '../../src/lib/document';
import {
  NoFrontmatterError,
  ParseError,
  DuplicateKeyError,
  NotRepresentableError,
} from '../../src/lib/errors';
import { readFixture } from '../helpers/corpus';

describe('FrontmatterDocument.fromString', () => {
  it('splits delimiters, frontmatter text, and an opaque body', () => {
    const raw = readFixture('splice/simple.md');
    const doc = FrontmatterDocument.fromString(raw, '/abs/simple.md');

    expect(doc.path).toBe('/abs/simple.md');
    expect(doc.raw).toBe(raw);
    // frontmatter.text is the bytes between (exclusive of) the --- delimiter lines
    expect(doc.frontmatter.text).toContain('status: draft # inline comment');
    expect(doc.frontmatter.text).not.toContain('---');
    expect(doc.body).toBe('\n# Body must stay byte-identical\n');
  });

  it('reassembly invariant: open + frontmatter.text + rest == raw', () => {
    const raw = readFixture('splice/simple.md');
    const doc = FrontmatterDocument.fromString(raw);
    const [start, end] = doc.frontmatter.range;
    expect(raw.slice(start, end)).toBe(doc.frontmatter.text);
    expect(raw.slice(0, start) + doc.frontmatter.text + raw.slice(end)).toBe(raw);
  });

  it('parses data as JSON-representable values', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/simple.md'));
    expect(doc.data).toEqual({
      status: 'draft',
      type: 'task',
      links: ['./other.md'],
    });
  });

  it('preserves CRLF in raw, frontmatter.text, and body', () => {
    const raw = readFixture('splice/crlf.md');
    const doc = FrontmatterDocument.fromString(raw);
    expect(doc.raw).toBe(raw);
    expect(doc.frontmatter.text).toContain('\r\n');
    expect(doc.body).toBe('\r\nbody\r\n');
    expect(raw.slice(0, doc.frontmatter.range[0]) + doc.frontmatter.text + raw.slice(doc.frontmatter.range[1])).toBe(raw);
  });

  it('handles an empty frontmatter block (data = {})', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/empty-block.md'));
    expect(doc.data).toEqual({});
    expect(doc.frontmatter.text).toBe('');
    expect(doc.body).toBe('body\n');
  });

  it('has no modeline until the Phase 6 scanner lands', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/simple.md'));
    expect(doc.modeline).toBeNull();
  });
});

describe('FrontmatterDocument.field', () => {
  it('locates a scalar field with a value range and 1-based entry lines', () => {
    const raw = readFixture('splice/simple.md');
    const doc = FrontmatterDocument.fromString(raw);
    const f = doc.field('status');
    expect(f).toBeDefined();
    expect(f!.name).toBe('status');
    expect(f!.value).toBe('draft');
    // valueRange addresses the value within frontmatter.text and excludes the inline comment
    const [vs, ve] = f!.valueRange;
    expect(doc.frontmatter.text.slice(vs, ve)).toBe('draft');
    expect(f!.entryLines[0]).toBeGreaterThanOrEqual(1);
  });

  it('returns a list field as its whole value', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/simple.md'));
    const f = doc.field('links');
    expect(f!.value).toEqual(['./other.md']);
    const [vs, ve] = f!.valueRange;
    expect(doc.frontmatter.text.slice(vs, ve)).toBe('[./other.md]');
  });

  it('returns undefined for a missing field (caller decides not-found)', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/simple.md'));
    expect(doc.field('nope')).toBeUndefined();
  });
});

describe('FrontmatterDocument typed refusals', () => {
  it('throws NoFrontmatterError when there is no block', () => {
    const raw = readFixture('splice/no-frontmatter.md');
    expect(() => FrontmatterDocument.fromString(raw, '/x.md')).toThrowError(NoFrontmatterError);
  });

  it('throws ParseError on an unclosed delimiter', () => {
    const raw = readFixture('splice/unclosed.md');
    expect(() => FrontmatterDocument.fromString(raw)).toThrowError(ParseError);
  });

  it('throws ParseError on broken YAML', () => {
    const raw = readFixture('splice/broken-yaml.md');
    expect(() => FrontmatterDocument.fromString(raw)).toThrowError(ParseError);
  });

  it('throws DuplicateKeyError on duplicate keys', () => {
    const raw = readFixture('splice/dup-keys.md');
    expect(() => FrontmatterDocument.fromString(raw)).toThrowError(DuplicateKeyError);
  });

  it('throws NotRepresentableError on a non-string top-level key', () => {
    const raw = readFixture('splice/numeric-key.md');
    expect(() => FrontmatterDocument.fromString(raw)).toThrowError(NotRepresentableError);
  });

  it('names the file on a refusal', () => {
    const raw = readFixture('splice/no-frontmatter.md');
    try {
      FrontmatterDocument.fromString(raw, '/abs/no-frontmatter.md');
      expect.unreachable();
    } catch (e) {
      expect((e as NoFrontmatterError).file).toBe('/abs/no-frontmatter.md');
    }
  });
});
