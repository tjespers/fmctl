import { describe, expect, it } from 'vitest';
import { spliceFields } from '../../src/lib/splice';
import { FrontmatterDocument } from '../../src/lib/document';
import { readFixture, expectBytesEqual } from '../helpers/corpus';
import type { JsonValue } from '../../src/lib/types';

interface Triple {
  label: string;
  input: string;
  change: { name: string; value: JsonValue };
  expected: string;
}

const TRIPLES: Triple[] = [
  {
    label: 'scalar edit preserves inline comment',
    input: 'splice/simple.md',
    change: { name: 'status', value: 'review' },
    expected: 'splice/expected/simple--status-review.md',
  },
  {
    label: 'flow-list wholesale replace',
    input: 'splice/simple.md',
    change: { name: 'links', value: ['./other.md', './new.md'] },
    expected: 'splice/expected/simple--links-replace.md',
  },
  {
    label: 'append new field to end of non-empty block',
    input: 'splice/simple.md',
    change: { name: 'priority', value: 'high' },
    expected: 'splice/expected/simple--append-priority.md',
  },
  {
    label: 'edit beside odd spacing keeps the spacing',
    input: 'splice/odd-spacing.md',
    change: { name: 'status', value: 'review' },
    expected: 'splice/expected/odd--status-review.md',
  },
  {
    label: 'quoted-value edit',
    input: 'splice/odd-spacing.md',
    change: { name: 'title', value: 'has: colon' },
    expected: 'splice/expected/odd--title-quoted.md',
  },
  {
    label: 'block-list wholesale replace (value range only)',
    input: 'splice/odd-spacing.md',
    change: { name: 'tags', value: ['x', 'y'] },
    expected: 'splice/expected/odd--tags-replace.md',
  },
  {
    label: 'object (flow-mapping) whole-value replace',
    input: 'splice/odd-spacing.md',
    change: { name: 'nested', value: { k: 'w', n: 2 } },
    expected: 'splice/expected/odd--nested-replace.md',
  },
  {
    label: 'append to an empty frontmatter block',
    input: 'splice/empty-block.md',
    change: { name: 'priority', value: 'high' },
    expected: 'splice/expected/empty--append.md',
  },
  {
    label: 'CRLF file edit preserves CRLF',
    input: 'splice/crlf.md',
    change: { name: 'status', value: 'review' },
    expected: 'splice/expected/crlf--status-review.md',
  },
  {
    label: 'CRLF append uses CRLF line ending',
    input: 'splice/crlf.md',
    change: { name: 'newfield', value: 1 },
    expected: 'splice/expected/crlf--append.md',
  },
];

describe('spliceFields — byte-exact golden triples', () => {
  for (const t of TRIPLES) {
    it(t.label, () => {
      const doc = FrontmatterDocument.fromString(readFixture(t.input), '/abs/' + t.input);
      const result = spliceFields(doc, [t.change]);
      expectBytesEqual(result.raw, readFixture(t.expected));
    });
  }

  it('reports created field names', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/simple.md'));
    const result = spliceFields(doc, [{ name: 'priority', value: 'high' }]);
    expect(result.created).toEqual(['priority']);
    const edit = spliceFields(doc, [{ name: 'status', value: 'review' }]);
    expect(edit.created).toEqual([]);
  });

  it('applies multiple scattered edits in one pass', () => {
    const doc = FrontmatterDocument.fromString(readFixture('splice/odd-spacing.md'));
    const result = spliceFields(doc, [
      { name: 'status', value: 'review' },
      { name: 'nested', value: { k: 'w', n: 2 } },
    ]);
    const reparsed = FrontmatterDocument.fromString(result.raw);
    expect(reparsed.data.status).toBe('review');
    expect(reparsed.data.nested).toEqual({ k: 'w', n: 2 });
    // untouched fields survive
    expect(reparsed.data.title).toBe('Quoted: value');
    expect(reparsed.data.tags).toEqual(['a', 'b']);
  });
});
