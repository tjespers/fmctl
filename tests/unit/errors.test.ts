import { describe, expect, it } from 'vitest';
import {
  FmctlError,
  UsageError,
  NotFoundError,
  FileNotFoundError,
  NoFrontmatterError,
  FieldNotFoundError,
  ParseError,
  DuplicateKeyError,
  NotRepresentableError,
  SchemaUnresolvableError,
  SchemaInvalidError,
  ValidationError,
  VerificationError,
  IoError,
} from '../../src/lib/errors';

// The exit-code contract (research.md R5): families, not classes, own exit codes.
// Every class still carries a distinct, stable machine-readable `code`.
const CASES: Array<{
  name: string;
  make: () => FmctlError;
  code: string;
  exitCode: number;
}> = [
  { name: 'UsageError', make: () => new UsageError('bad flag'), code: 'usage', exitCode: 2 },
  { name: 'NotFoundError', make: () => new NotFoundError('missing'), code: 'not-found', exitCode: 3 },
  { name: 'FileNotFoundError', make: () => new FileNotFoundError('no file'), code: 'file-not-found', exitCode: 3 },
  { name: 'NoFrontmatterError', make: () => new NoFrontmatterError('no fm'), code: 'no-frontmatter', exitCode: 3 },
  { name: 'FieldNotFoundError', make: () => new FieldNotFoundError('no field'), code: 'field-not-found', exitCode: 3 },
  { name: 'ParseError', make: () => new ParseError('broken yaml'), code: 'parse-error', exitCode: 4 },
  { name: 'DuplicateKeyError', make: () => new DuplicateKeyError('dup'), code: 'duplicate-key', exitCode: 4 },
  { name: 'NotRepresentableError', make: () => new NotRepresentableError('weird'), code: 'not-representable', exitCode: 4 },
  { name: 'SchemaUnresolvableError', make: () => new SchemaUnresolvableError('no schema'), code: 'schema-unresolvable', exitCode: 5 },
  { name: 'SchemaInvalidError', make: () => new SchemaInvalidError('bad schema'), code: 'schema-invalid', exitCode: 5 },
  { name: 'ValidationError', make: () => new ValidationError('invalid', []), code: 'validation', exitCode: 1 },
  { name: 'VerificationError', make: () => new VerificationError('mismatch'), code: 'verification', exitCode: 6 },
  { name: 'IoError', make: () => new IoError('disk full'), code: 'io', exitCode: 7 },
];

describe('error hierarchy', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it('is an FmctlError and a real Error', () => {
        const err = c.make();
        expect(err).toBeInstanceOf(FmctlError);
        expect(err).toBeInstanceOf(Error);
      });

      it(`carries stable code "${c.code}" and exit ${c.exitCode}`, () => {
        const err = c.make();
        expect(err.code).toBe(c.code);
        expect(err.exitCode).toBe(c.exitCode);
      });

      it('uses the class name as error name and keeps the message', () => {
        const err = c.make();
        expect(err.name).toBe(c.name);
        expect(err.message).toBeTruthy();
      });
    });
  }

  it('carries optional file/field context', () => {
    const err = new FieldNotFoundError('status missing', { file: '/a.md', field: 'status' });
    expect(err.file).toBe('/a.md');
    expect(err.field).toBe('status');
  });

  it('preserves the not-found family grouping', () => {
    expect(new FileNotFoundError('x')).toBeInstanceOf(NotFoundError);
    expect(new NoFrontmatterError('x')).toBeInstanceOf(NotFoundError);
    expect(new FieldNotFoundError('x')).toBeInstanceOf(NotFoundError);
  });

  it('preserves the parse family grouping', () => {
    expect(new DuplicateKeyError('x')).toBeInstanceOf(ParseError);
    expect(new NotRepresentableError('x')).toBeInstanceOf(ParseError);
  });

  it('allows a per-instance code override while keeping the family exit code', () => {
    const nested = new UsageError('nested path', { field: 'a.b', code: 'nested-path-unsupported' });
    expect(nested.code).toBe('nested-path-unsupported');
    expect(nested.exitCode).toBe(2);

    const uri = new SchemaUnresolvableError('uri reserved', { code: 'schema-uri-reserved' });
    expect(uri.code).toBe('schema-uri-reserved');
    expect(uri.exitCode).toBe(5);
  });

  it('ValidationError carries violations', () => {
    const err = new ValidationError('invalid', [
      { field: 'status', value: 'bogus', message: 'not allowed', expected: 'one of: draft, review', keyword: 'enum' },
    ]);
    expect(err.violations).toHaveLength(1);
    expect(err.violations[0]?.field).toBe('status');
  });
});
