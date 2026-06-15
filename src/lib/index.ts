// Public API barrel for fmctl's library surface — the single import surface for
// both external consumers and src/cli (constitution Principle VII, FR-018).
// Grows as modules land; see contracts/library-api.md.

// Shared value vocabulary
export type { Scalar, JsonValue, Violation, SchemaRef, Modeline } from './types.js';

// Document model
export { FrontmatterDocument } from './document.js';
export type { Field, FrontmatterRegion } from './document.js';

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
