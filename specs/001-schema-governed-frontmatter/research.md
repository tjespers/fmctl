# Research: Schema-Governed Frontmatter Management

**Date**: 2026-06-11 | **Plan**: [plan.md](./plan.md)

No `NEEDS CLARIFICATION` markers remained in the Technical Context — every decision below was
settled during pre-planning (a hands-on spike on 2026-06-10 plus primed refinement rounds with
the product owner). This document records each decision in Decision / Rationale / Alternatives
form so the choices stay auditable.

## R1. YAML processing: `yaml` (eemeli) 2.9.x, parse-to-locate + text splice

- **Decision**: Use `yaml@2.9.x`. `parseDocument` is used to (a) parse frontmatter into data
  for validation and (b) locate the byte range (`node.range`) of fields being edited. Writes
  splice the new value's text into the **original source string**. Whole-document
  re-serialization (`doc.toString()`) is prohibited on every write path. New fields are
  appended as a new line at the end of the frontmatter block (FR-003) — also a splice, at the
  block's end offset. The Markdown body is split off at the delimiters and carried as opaque
  bytes, never parsed.
- **Rationale**: A 2026-06-10 spike proved that even careful in-place node mutation followed by
  `doc.toString()` normalizes untouched lines (`key:   value` spacing collapsed, flow sequences
  rewritten `[a, b]` → `[ a, b ]`) — violating FR-004. The same spike proved range-splicing
  produces a true one-line diff with inline comments preserved. `yaml` is the only maintained
  TypeScript YAML library that exposes per-node source ranges on a comment-preserving AST.
- **Alternatives considered**: `js-yaml` (no CST/ranges, discards comments — unusable);
  round-trip via `doc.toString()` (proven normalizing); hand-rolled YAML subset parser
  (unjustifiable risk and scope for v0.1).

## R2. JSON Schema validation: `ajv` 8.x + `ajv-formats`, draft 2020-12

- **Decision**: `ajv` with `Ajv2020` (draft 2020-12 dialect), `allErrors: true`, plus
  `ajv-formats` for standard formats (`date`, `uri`, …). A translation layer converts ajv
  error objects into fmctl violations.
- **Rationale**: ajv is the ecosystem standard (battle-tested, actively maintained, small
  dependency tree) and emits the richest machine-readable errors — `instancePath` plus
  `params` such as `allowedValues` (enum), `missingProperty` (required), `type` — exactly the
  inputs FR-012 needs for "field, offending value, what would have been valid". Draft 2020-12
  is the current standard and the right target for schemas meant to be published later.
  ajv's runtime code generation (`new Function`) is acceptable in a local Node CLI/library
  context (no CSP constraints). Justifies its place under constitution Principle VI.
- **Alternatives considered**: `@cfworker/json-schema` (zero-dep, no codegen, but basic error
  output — translation layer would have to reconstruct context ajv gives for free);
  `@exodus/schemasafe` (security-focused, but weakest error reporting and incomplete 2020-12
  coverage); writing a validator (a project in itself; rejected outright).

## R3. Modeline: `# fmctl: $schema=<ref>` scanned from raw frontmatter text

- **Decision**: A YAML comment line inside the frontmatter block, matched by a line-anchored
  pattern on the raw frontmatter text (whitespace-tolerant):
  `# fmctl: $schema=<ref>`. The `key=value` form after the `fmctl:` namespace is reserved for
  future directives. `<ref>` semantics: absolute path → used as-is; relative path → resolved
  against the referencing file's directory; `http://`/`https://` → recognized and rejected
  with the distinct reserved-for-future error (FR-010). First matching line wins; the modeline
  is never exposed as data and survives writes like any other comment (FR-009).
- **Rationale**: The `$schema=` token mirrors the established yaml-language-server modeline,
  so it reads as familiar; the `fmctl:` namespace avoids squatting on YLS semantics. Scanning
  text (rather than walking comment nodes) matches how YLS implementations do it, is trivially
  testable, and works even before full parse — but modeline extraction still happens only
  after the frontmatter block is located.
- **Alternatives considered**: adopting the literal YLS modeline (muddy ownership of
  third-party namespace, editors don't apply it inside Markdown anyway); `$schema` as a data
  field (rejected in spec red-teaming: writable governance, validator pollution,
  `additionalProperties: false` conflicts); supporting both syntaxes (two formats to document
  and test in v0.1 for no concrete consumer).

## R4. Schema resolution chain: override → modeline → none

- **Decision**: `--schema <path>` (CLI) / `schema` option (library) takes precedence; else the
  file's modeline; else no schema. No configuration file, no directory walking, no global
  state in v0.1. With no schema: reads work; writes proceed but emit a stderr diagnostic
  notice; lint reports files as ungoverned and fails distinctly only when nothing at all could
  be validated (FR-013).
- **Rationale**: The product owner explicitly cut the configuration concept from v0.1 — it was
  becoming a subsystem (config file, upward walk, URI catalog, glob maps, policy) deserving
  its own spec. Explicit-over-ambient keeps v0.1 honest; project-wide enforcement comes from
  wrappers (task runner / agent harness) supplying `--schema`.
- **Alternatives considered**: `.fmctl.yaml` + upward walk (deferred to the future config
  spec); URI→path schema catalog (deferred, same spec); remote fetching (out of scope, network
  failure modes + security surface).

## R5. Typed errors mapped to exit codes

- **Decision**: Library exports an error hierarchy rooted at `FmctlError` (carries `code`
  string, optional `file`/`field` context). Classes and CLI exit codes:

  | Exit | Error class | Meaning |
  |------|-------------|---------|
  | 0 | — | success |
  | 1 | `ValidationError` | schema violations (set refusal, lint findings) |
  | 2 | `UsageError` | bad invocation (unknown flag, unparseable field=value) |
  | 3 | `NotFoundError` family: file not found, `NoFrontmatterError`, `FieldNotFoundError` | target missing |
  | 4 | `ParseError`, `DuplicateKeyError`, `NotRepresentableError` | malformed/ambiguous frontmatter |
  | 5 | `SchemaUnresolvableError` (incl. reserved-URI), `SchemaInvalidError` | schema problems |
  | 6 | `VerificationError` | post-write verification failed, original restored |
  | 7 | `IoError` | filesystem failures outside the verify path |

- **Rationale**: Constitution Principle III (v1.0.1) requires a distinct exported error type
  per failure class with family-level exit codes; grouping related conditions under one exit
  code keeps the table memorizable for agents while the JSON error `code` field carries the
  precise class.
- **Alternatives considered**: one generic non-zero exit (useless to agents); errno-style
  large code space (over-engineered for 3 commands).

## R6. CLI value parsing: YAML scalar / flow sequence

- **Decision**: For `field=value`, the value substring is parsed with the same `yaml` library:
  values starting with `[` parse as a YAML flow sequence, values starting with `{` parse as a
  YAML flow mapping (JSON arrays and objects are valid YAML flow, agents can emit JSON
  unchanged); anything else parses as a single YAML scalar (`true` → boolean, `42` → number,
  quoted → string). Every write is a whole-value replacement of a top-level field;
  nested-path addressing is unsupported in v0.1 — a field name containing `.` is rejected
  with `UsageError` code `nested-path-unsupported` (writing literal dotted keys is deferred
  along with nested addressing, keeping the rejection unambiguous; reads look field names up
  literally). Serialization of new values into the splice uses YAML flow style for
  collections and plain/quoted scalars chosen to round-trip the parsed value exactly.
- **Rationale**: One parser, one set of quoting rules (YAML's own), zero bespoke syntax; the
  schema then enforces expected types. Matches the spec assumption verbatim.
- **Alternatives considered**: comma-splitting (breaks on values containing commas, ambiguous
  single-item lists); repeated `key=value` accumulation (collides with multi-field set
  semantics; empty list inexpressible).

## R7. Atomic write + verification algorithm

- **Decision**: Write pipeline: render edited frontmatter text → write whole new file content
  to a temp file in the same directory → `rename(2)` over the original (atomic on POSIX same
  filesystem). Verification before rename is structural (re-parse temp content; deep-equal the
  parsed frontmatter against intended post-state) and textual (line-level diff between
  original and new content must touch only the line spans of edited/created fields). On any
  verification failure: temp file removed, original untouched, `VerificationError` (exit 6).
  Original content is also held in memory for belt-and-braces restore if rename half-fails.
- **Rationale**: Constitution Principle II demands "never leave a file in a state it didn't
  verify" — verifying the temp file *before* rename means the original is never replaced by
  unverified bytes; rename atomicity covers crash windows. Line-span diff confinement is the
  executable form of FR-004.
- **Alternatives considered**: verify-after-rename with restore (window where the file on disk
  is unverified); write-in-place with backup file (litter, non-atomic); fsync ceremony beyond
  rename (out of proportion for v0.1's single-user envelope — noted as future hardening).

## R8. Lint walker: per-directory walk honoring `.gitignore`

- **Decision**: Recursive discovery via a per-directory `node:fs` `readdir` walk that prunes
  ignored directories as it descends, filtering `*.md`. Ignore rules come from `.gitignore`
  files encountered in the walked tree (the lint root and below, including nested ones),
  applied with the `ignore` package (gitignore-spec matcher); the `.git` directory is always
  skipped; there is no other built-in ignore and no git-repo detection — `.gitignore` files
  are honored wherever found, repo or not. Explicit file arguments are linted directly,
  ignore rules never applied. Per-file processing is fault-isolated: one file's error becomes
  a report entry, never an abort. Report assembled as data; rendering (human/JSON) lives in
  the CLI layer.
- **Rationale**: v0.1's only project-wide mode is the `--schema` override applied to every
  discovered file — without ignore handling, vendored Markdown (e.g. `node_modules` READMEs)
  validates against the project schema and floods the report with false violations, breaking
  SC-003's zero-false-positive gate. Respecting `.gitignore` borrows the intent the user has
  already declared instead of inventing an fmctl-specific ignore list that would only grow
  (the rejected hardcoded set also silently hid real content like `.github/**/*.md` via its
  blanket hidden-directory skip). `ignore` is the zero-dependency, ecosystem-standard matcher
  (used by eslint); gitignore semantics — negation, anchoring, dir-only patterns — are
  exactly the kind of deceptively gnarly logic Principle VI says not to hand-roll. A
  per-directory walk (rather than `readdir recursive: true`) is required anyway to prune
  ignored trees instead of descending into them. Known v0.1 caveat, documented in the spec's
  Assumptions: linting a subdirectory does not see a parent directory's `.gitignore`
  (collect-upward and repo-root detection arrive with the future configuration spec).
  Fault isolation implements US2 acceptance scenario 4.
- **Alternatives considered**: fixed hardcoded ignore set `node_modules`/`.git`/hidden dirs
  (arbitrary, invites growth, hides real hidden-directory content); no ignores at all
  (false-violation flood under `--schema`, see above); `readdir recursive: true` +
  post-filter (descends into `node_modules` anyway — wasted I/O at exactly the wrong scale);
  shelling out to `git ls-files` (requires git presence, misses untracked files);
  `globby`/`fast-glob` (walking is already covered by built-ins; neither implements nested
  `.gitignore` collection for free).

## R9. Build, module format, test tooling

- **Decision**: ESM-only package (`"type": "module"` already set), compiled with plain `tsc`
  (`module`/`moduleResolution: NodeNext`, `strict: true`, declarations emitted). `exports`
  maps `"."` to the library entry; `bin.fmctl` points at the compiled CLI entry with a Node
  shebang. Tests run with vitest (native TS, no transpile step); integration tests spawn the
  built CLI via `node:child_process` (no `execa`). Dev-only deps: `typescript`, `vitest`,
  `@types/node`.
- **Rationale**: Boring, minimal, and sufficient. ESM-only avoids dual-format publishing
  complexity v0.1 doesn't need; declarations are part of the API contract (constitution
  Technical Constraints).
- **Alternatives considered**: `tsup`/bundlers (nothing to bundle for local-dev distribution);
  CJS or dual format (no CJS consumer exists; the future backend is ESM-era Node);
  `execa` (built-in `child_process` suffices — one less dep).

## R10. Golden corpus & TDD shape

- **Decision**: `tests/fixtures/splice/` holds (input file, operation description, expected
  output file) triples covering: inline & block comments, odd spacing, flow and block lists,
  quoting variants, field creation, list replacement, CRLF line endings, empty frontmatter
  block. Assertions are byte-level (`Buffer.equals`) — not string-trimmed equality. Fixture
  directories are already excluded from mutating pre-commit hooks (`^tests/fixtures/`).
  TDD ordering is enforced at task level: each module's tests are authored and observed
  failing before its implementation (constitution Principle IV); the corpus is built alongside
  the splice engine's red phase.
- **Rationale**: The corpus is the executable form of the byte-conservatism guarantee — the
  product's central promise gets the most rigorous test artifact. Byte-level comparison
  catches what string normalization would mask (trailing whitespace, EOL flavor).
- **Alternatives considered**: property-based testing with `fast-check` (attractive future
  hardening; deferred — adds a dep and the corpus covers the known hostile cases);
  snapshot testing (snapshots invite thoughtless updates; golden files are deliberate).
