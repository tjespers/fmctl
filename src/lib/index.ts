// Public API barrel for fmctl's library surface — the single import surface for
// both external consumers and src/cli (constitution Principle VII, FR-018).
// Grows as modules land; see contracts/library-api.md.

// Shared value vocabulary
export type { Scalar, JsonValue, Violation, SchemaRef, Modeline, GoverningSchema } from './types.js';

// Document model
export { FrontmatterDocument } from './document.js';
export type { Field, FrontmatterRegion } from './document.js';

// Operations (the product capability surface; FR-018)
export { setFields } from './api.js';
export type { SetOptions, SetResult, FieldChangeResult } from './api.js';
export { lintPaths } from './lint.js';
export type { LintOptions } from './lint.js';
export type { LintResult, FileLintResult, LintSummary, FileLintStatus, ErrorInfo } from './types.js';
export { resolveSchema } from './resolve.js';
export type { ResolveOptions } from './resolve.js';

// Value syntax (field=value parsing/rendering, shared with the CLI)
export { parseValue, serializeValue } from './values.js';

// Typed error hierarchy (exit-code-mapped; research.md R5)
export {
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
} from './errors.js';
export type { FmctlErrorContext } from './errors.js';
