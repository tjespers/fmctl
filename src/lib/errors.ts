import type { Violation } from './types.js';

/**
 * Context attachable to any fmctl error. `code` overrides the class's default
 * machine-readable code for the rare cases that share an exit code but need a
 * distinct code (e.g. a nested-path UsageError, a reserved-URI schema error).
 */
export interface FmctlErrorContext {
  file?: string;
  field?: string;
  code?: string;
  cause?: unknown;
}

/**
 * Root of the fmctl error hierarchy (constitution Principle III; research.md R5).
 * Every concrete error carries a stable `code` and an `exitCode`. Exit codes are
 * owned by failure *families*; the `code` distinguishes the precise class.
 */
export abstract class FmctlError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly file: string | undefined;
  readonly field: string | undefined;

  protected constructor(
    message: string,
    spec: { exitCode: number; code: string },
    context: FmctlErrorContext = {},
  ) {
    super(message, context.cause !== undefined ? { cause: context.cause } : undefined);
    this.name = new.target.name;
    this.exitCode = spec.exitCode;
    this.code = context.code ?? spec.code;
    this.file = context.file;
    this.field = context.field;
  }
}

/** Bad invocation: unknown flag, unparseable `field=value`, nested-path field name. */
export class UsageError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 2, code: 'usage' }, context);
  }
}

/** Family base (exit 3): a requested target does not exist. */
export class NotFoundError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 3, code: 'not-found' }, context);
  }
}

export class FileNotFoundError extends NotFoundError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { code: 'file-not-found', ...context });
  }
}

export class NoFrontmatterError extends NotFoundError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { code: 'no-frontmatter', ...context });
  }
}

export class FieldNotFoundError extends NotFoundError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { code: 'field-not-found', ...context });
  }
}

/** Family base (exit 4): frontmatter present but malformed or unrepresentable. */
export class ParseError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 4, code: 'parse-error' }, context);
  }
}

export class DuplicateKeyError extends ParseError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { code: 'duplicate-key', ...context });
  }
}

export class NotRepresentableError extends ParseError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { code: 'not-representable', ...context });
  }
}

/**
 * No usable schema could be resolved for a file. The reserved-URI rejection
 * (FR-010) reuses this class with code `schema-uri-reserved`.
 */
export class SchemaUnresolvableError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 5, code: 'schema-unresolvable' }, context);
  }
}

/** A schema document exists but is not readable / not valid JSON Schema. */
export class SchemaInvalidError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 5, code: 'schema-invalid' }, context);
  }
}

/** Frontmatter failed schema validation. Carries the translated violations. */
export class ValidationError extends FmctlError {
  readonly violations: Violation[];

  constructor(message: string, violations: Violation[], context: FmctlErrorContext = {}) {
    super(message, { exitCode: 1, code: 'validation' }, context);
    this.violations = violations;
  }
}

/** Post-write self-verification failed; the original content has been restored. */
export class VerificationError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 6, code: 'verification' }, context);
  }
}

/** Filesystem failure outside the verify path. */
export class IoError extends FmctlError {
  constructor(message: string, context: FmctlErrorContext = {}) {
    super(message, { exitCode: 7, code: 'io' }, context);
  }
}
