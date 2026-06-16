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

// Public API barrel for fmctl's library surface — the single import surface for
// both external consumers and src/cli (constitution Principle VII, FR-018).
// Grows as modules land; see contracts/library-api.md.

// Shared value vocabulary
export type { Scalar, JsonValue, Violation, SchemaRef, Modeline, GoverningSchema } from './types.js';

// Document model
export { FrontmatterDocument } from './document.js';
export type { Field, FrontmatterRegion } from './document.js';

// Operations (the product capability surface; FR-018)
export { setFields, getField, getFrontmatter } from './api.js';
export type { SetOptions, SetResult, FieldChangeResult, GetResult, FrontmatterResult } from './api.js';
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
