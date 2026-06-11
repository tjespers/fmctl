# Contract: Library Public API

**Date**: 2026-06-11 | **Plan**: [../plan.md](../plan.md)

`src/lib/index.ts` is the single public entry point. The CLI and external consumers import
**only** this surface (constitution Principle VII, FR-018). Exported type declarations are part
of the contract. Anything not listed here is internal and may change freely.

## Functions

### `getField(filePath: string, field: string): Promise<GetResult>`

Reads one top-level field. (FR-001)

```ts
interface GetResult {
  file: string;            // absolute path
  field: string;
  value: JsonValue;        // whole value: scalar, list, or object
}
type Scalar = string | number | boolean | null;
type JsonValue = Scalar | JsonValue[] | { [key: string]: JsonValue };
```

Throws: `FileNotFoundError`, `NoFrontmatterError`, `ParseError`, `DuplicateKeyError`,
`NotRepresentableError`, `FieldNotFoundError`.

### `setFields(filePath: string, changes: Record<string, JsonValue>, options?: SetOptions): Promise<SetResult>`

Updates and/or creates one or more top-level fields atomically — all changes validate and land
together, or nothing is written. Values are whole-value replacements (scalar, list, or object);
nested-path addressing is unsupported. (FR-002–FR-007)

```ts
interface SetOptions {
  schema?: string;          // per-invocation override (absolute or cwd-relative path)
  bypassValidation?: boolean; // skips schema validation ONLY (FR-006)
}
interface SetResult {
  file: string;
  changes: Array<{ field: string; before: JsonValue | undefined; after: JsonValue; created: boolean }>;
  validated: boolean;       // false when bypassed or ungoverned
  bypassed: boolean;        // true when validation was explicitly bypassed (FR-006)
  governedBy: GoverningSchema | null; // null = ungoverned
}
```

The FR-013 unvalidated-write notice is presentation, composed by the CLI from
`validated === false && bypassed === false` — the library carries state, not display strings.

Throws: everything `getField` throws (except `FieldNotFoundError`), plus `ValidationError`
(nothing written), `SchemaUnresolvableError`, `SchemaInvalidError`, `VerificationError`
(original restored), `IoError`, `UsageError` (e.g. unparseable `field=value` syntax).

### `lintPaths(paths: string[], options?: LintOptions): Promise<LintReport>`

Walks Markdown files and validates each against its resolved schema. Per-file fault isolation —
this function only throws for setup-level failures. (FR-011–FR-013)

```ts
interface LintOptions {
  schema?: string;          // override applied to every file
}
```

Returns: `LintResult` (see [data-model.md](../data-model.md)). Throws: `FileNotFoundError`
(a given root path doesn't exist), `SchemaUnresolvableError`/`SchemaInvalidError` (explicit
override unusable), `UsageError`.

**Note**: "nothing at all could be validated" (FR-013) is a *result* condition
(`summary.checked === 0` with no override), surfaced as an exit-code decision in the CLI layer
— the library returns the result rather than throwing, so programmatic consumers can inspect it.

### `resolveSchema(filePath: string, options?: { schema?: string }): Promise<GoverningSchema | null>`

Exposes the resolution chain (invocation override → document modeline; `null` when ungoverned)
for one file. Powers future `explain`-style tooling and keeps resolution testable through the
public surface. (FR-008)

## Exported types & errors

- Types: `GetResult`, `SetOptions`, `SetResult`, `LintOptions`, `LintResult`,
  `FileLintResult`, `ErrorInfo`, `Violation`, `GoverningSchema`, `Modeline`, `SchemaRef`,
  `Scalar`, `JsonValue`.
- Errors: `FmctlError` (abstract base: `code: string`, `exitCode: number`, `file?: string`,
  `field?: string`), `UsageError`, `NotFoundError`, `FileNotFoundError`, `NoFrontmatterError`,
  `FieldNotFoundError`, `ParseError`, `DuplicateKeyError`, `NotRepresentableError`,
  `SchemaUnresolvableError`, `SchemaInvalidError`, `ValidationError` (`violations:
  Violation[]`), `VerificationError`, `IoError`.

## Behavioral guarantees (contractual)

1. **Byte conservatism** (FR-004): any successful `setFields` changes only the entry lines of
   the named fields (plus one appended line per created field); all other bytes of the file —
   including all comments and the modeline — are identical before and after.
2. **Validate-before-write** (FR-005): when a schema resolves and validation is not bypassed,
   a `ValidationError` guarantees the target file was not modified.
3. **Verify-or-revert** (FR-007): a resolved `setFields` promise means the on-disk file was
   re-parsed and verified; a `VerificationError` means the original content is intact.
4. **No data exposure of modelines** (FR-009): no API returns the modeline as a frontmatter
   field, and no `changes` key may address it.
5. **Determinism** (FR-015): identical inputs yield identical results and error codes.
