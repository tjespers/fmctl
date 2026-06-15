# Data Model: Schema-Governed Frontmatter Management

**Date**: 2026-06-11 | **Plan**: [plan.md](./plan.md) | **Spec entities**: [spec.md → Key Entities](./spec.md#key-entities)

All types live in `src/lib/` and are exported (directly or as type declarations) through the
public entry point where consumers need them. Field names below are the contract; exact TS
syntax lives in [contracts/library-api.md](./contracts/library-api.md).

## Core document model

### `FrontmatterDocument`
The parsed representation of one Markdown file. Immutable once loaded; edits produce new text.

| Field | Type | Notes |
|---|---|---|
| `path` | `string` | absolute path of the source file |
| `raw` | `string` | entire original file content, byte-faithful |
| `frontmatter.text` | `string` | raw text between (exclusive of) the `---` delimiter lines |
| `frontmatter.range` | `[start, end]` | byte offsets of `frontmatter.text` within `raw` |
| `body` | `string` | everything after the closing delimiter line — **opaque, never parsed** |
| `data` | `Record<string, JsonValue>` | frontmatter parsed to plain data (JSON-representable, see `Field`) |
| `modeline` | `Modeline \| null` | parsed modeline if present |

**Invariants**:
- `raw === '---\n' + frontmatter.text + '\n---\n' + body` modulo the file's own delimiter/EOL
  flavor, which is captured exactly (CRLF preserved as found).
- Construction fails with a typed error rather than producing a partial document: no
  frontmatter block (`NoFrontmatterError`), unparseable YAML (`ParseError`), duplicate keys
  (`DuplicateKeyError`), data not JSON-representable (`NotRepresentableError`).

### `Field`
A top-level frontmatter entry addressed by name.

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | top-level key |
| `value` | `JsonValue` | whole value of the entry; `JsonValue = Scalar \| JsonValue[] \| { [key: string]: JsonValue }` with `Scalar = string \| number \| boolean \| null` |
| `valueRange` | `[start, end]` | byte offsets of the value node within `frontmatter.text` (from `node.range`) |
| `entryLines` | `[firstLine, lastLine]` | 1-based line span of the whole entry — the only lines a write to this field may alter |

### `Modeline`
The parsed `# fmctl: …` comment line. Future directives become additional fields alongside
`schema` — extension by addition, no speculative interface hierarchy (constitution
Principle VII).

| Field | Type | Notes |
|---|---|---|
| `raw` | `string` | the full comment line as found |
| `schema` | `SchemaRef` | the parsed `$schema=` directive |

### `SchemaRef`

| Field | Type | Notes |
|---|---|---|
| `ref` | `string` | the `<ref>` text after `$schema=` |
| `kind` | `'absolute' \| 'relative' \| 'uri'` | `uri` is recognized but unusable in v0.1 |
| `location` | `string \| null` | absolute path after resolution (`null` for `uri`) |

## Schema & validation model

### `GoverningSchema`
Outcome of schema resolution for one file (FR-008). Resolution yields
`GoverningSchema | null` — `null` means ungoverned; there is no `'none'` member.

| Field | Type | Notes |
|---|---|---|
| `authority` | `'invocation' \| 'document'` | on whose say-so the schema governs: `invocation` = per-invocation override (`--schema` flag / library option); `document` = the file's own modeline. `'project'` is reserved for the future configuration spec |
| `location` | `string` | absolute path of the governing schema document (a URL in future versions) |

### `Violation`
One way a file's frontmatter fails its schema (translated from an ajv error).

| Field | Type | Notes |
|---|---|---|
| `field` | `string \| null` | dotted instance path; for `required` violations the missing property's name (from ajv `params.missingProperty`); `null` only for document-level violations that name no field (e.g. root type mismatch) |
| `value` | `unknown` | the offending value (`undefined` when absent) |
| `message` | `string` | human sentence: what is wrong |
| `expected` | `string` | what would have been valid (e.g. `one of: draft, review, done`) |
| `keyword` | `string` | originating schema keyword (`enum`, `required`, `type`, …) |

### `LintResult`

| Field | Type | Notes |
|---|---|---|
| `files` | `FileLintResult[]` | one per discovered file |
| `summary` | `{ checked, valid, invalid, ungoverned, skipped, errored }` | counts |

`FileLintResult`: `{ file: string; status: 'valid' | 'invalid' | 'ungoverned' |
'skipped-no-frontmatter' | 'error'; governedBy: GoverningSchema | null;
violations: Violation[]; error: ErrorInfo | null }`.

`ErrorInfo`: `{ code: string; message: string }` — the serialized form of an `FmctlError`,
used where an error is data inside a result rather than a thrown failure.

Status semantics (FR-011/012/013): `ungoverned` = frontmatter present, no schema resolved;
`skipped-no-frontmatter` = no block at all; `error` = malformed/duplicate/unrepresentable —
fault-isolated, never aborts the walk.

## Error model

Hierarchy rooted at `FmctlError extends Error`, every class carrying `code` (stable string),
`exitCode`, and optional `file`/`field` context. See research.md R5 for the full table.

```text
FmctlError
├── UsageError                  (exit 2)   — incl. dotted field names (distinct `code` `nested-path-unsupported`)
├── NotFoundError               (exit 3)
│   ├── FileNotFoundError
│   ├── NoFrontmatterError
│   └── FieldNotFoundError
├── ParseError                  (exit 4)
│   ├── DuplicateKeyError
│   └── NotRepresentableError
├── SchemaUnresolvableError     (exit 5)   — incl. reserved-URI rejection (distinct `code`)
├── SchemaInvalidError          (exit 5)
├── ValidationError             (exit 1)   — carries `violations: Violation[]`
├── VerificationError           (exit 6)   — original restored
└── IoError                     (exit 7)
```

## Write pipeline states

A `set` operation moves through explicit states; failure at any state leaves the on-disk file
exactly as it was (constitution Principle II):

```text
loaded ──edit──▶ rendered ──validate──▶ validated ──write-temp──▶ staged
   │                │  (skip when bypassed   │                       │
   ▼                ▼   or unvalidated:      ▼                       ▼
ParseError /   UsageError    notice)   ValidationError      verify(temp): re-parse +
NotFound...                            (nothing written)    line-span diff confinement
                                                              │
                                              ┌── fail ──────┴────── pass ──┐
                                              ▼                             ▼
                                    VerificationError                 rename → committed
                                    (temp removed,
                                     original untouched)
```

- **rendered**: new frontmatter text produced purely by splicing value ranges / appending new
  entry lines; body bytes concatenated untouched.
- **validated**: complete post-edit frontmatter data validated against the governing schema
  (whole-document, FR-005); bypass flag or absent schema skips this state (the CLI emits the
  FR-013 unvalidated-write notice — the library only carries the state).
- **staged → committed**: verification happens on the temp file *before* `rename`, so the
  original is never replaced by unverified bytes (research.md R7).

## Relationships

```text
FrontmatterDocument 1──n Field
FrontmatterDocument 1──0..1 Modeline ──1 SchemaRef
FrontmatterDocument 1──0..1 GoverningSchema (computed per invocation; null = ungoverned)
GoverningSchema 1──1 Schema document (JSON Schema 2020-12, local file)
Validation (document data × schema) ──▶ 0..n Violation
Lint (path) ──▶ 1 LintResult ──▶ n FileLintResult ──▶ 0..n Violation
```
