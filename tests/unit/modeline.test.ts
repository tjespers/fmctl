import { describe, expect, it } from 'vitest';
import { scanModeline } from '../../src/lib/modeline';

const FILE = '/proj/docs/file.md';

describe('scanModeline', () => {
  it('parses a relative ref, resolving against the file directory', () => {
    const ml = scanModeline('# fmctl: $schema=./schema.json\nstatus: draft\n', FILE);
    expect(ml).not.toBeNull();
    expect(ml!.schema).toEqual({ ref: './schema.json', kind: 'relative', location: '/proj/docs/schema.json' });
  });

  it('parses an absolute ref as-is', () => {
    const ml = scanModeline('# fmctl: $schema=/etc/schemas/task.json\n', FILE);
    expect(ml!.schema).toEqual({ ref: '/etc/schemas/task.json', kind: 'absolute', location: '/etc/schemas/task.json' });
  });

  it('recognizes a URI ref with a null location (reserved)', () => {
    const ml = scanModeline('# fmctl: $schema=https://example.com/s.json\n', FILE);
    expect(ml!.schema).toEqual({ ref: 'https://example.com/s.json', kind: 'uri', location: null });
  });

  it('tolerates surrounding whitespace and odd placement within the block', () => {
    const text = 'status: draft\n  #  fmctl:  $schema = ./schema.json\ntype: task\n';
    const ml = scanModeline(text, FILE);
    expect(ml!.schema.kind).toBe('relative');
    expect(ml!.schema.location).toBe('/proj/docs/schema.json');
  });

  it('takes the first matching modeline line', () => {
    const text = '# fmctl: $schema=./first.json\n# fmctl: $schema=./second.json\n';
    const ml = scanModeline(text, FILE);
    expect(ml!.schema.ref).toBe('./first.json');
  });

  it('captures the raw comment line', () => {
    const ml = scanModeline('# fmctl: $schema=./schema.json\n', FILE);
    expect(ml!.raw).toBe('# fmctl: $schema=./schema.json');
  });

  it('returns null when there is no modeline', () => {
    expect(scanModeline('status: draft\ntype: task\n', FILE)).toBeNull();
  });

  it('ignores a non-fmctl comment', () => {
    expect(scanModeline('# just a comment\nstatus: draft\n', FILE)).toBeNull();
  });
});
