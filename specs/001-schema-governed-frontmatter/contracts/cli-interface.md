# Contract: CLI Interface

**Date**: 2026-06-11 | **Plan**: [../plan.md](../plan.md)

The `fmctl` binary is a thin adapter over the library contract
([library-api.md](./library-api.md)). Global conventions:

- **stdout** carries results; **stderr** carries diagnostics and errors. (FR-014)
- `--json` switches stdout (and structured error reporting) to JSON; without it, output is
  human-readable. JSON shapes below are stable contracts.
- Exit codes (FR-015, research.md R5): `0` success · `1` validation/lint violations · `2`
  usage · `3` not found (file/frontmatter/field) · `4` malformed frontmatter · `5` schema
  unresolvable/invalid · `6` verification failure (original restored) · `7` I/O failure.
- In `--json` mode, failures print one JSON object to stderr:
  `{ "error": { "code": string, "message": string, "file"?: string, "field"?: string,
  "violations"?: Violation[] } }`.

## `fmctl get <file> [field] [--json] [--schema <path>]`

Read one top-level field, or — when `field` is omitted — the whole frontmatter. (`--schema` is
accepted for symmetry; reads never validate.)

**One field** (`get <file> <field>`):

- Human: the value printed plainly (lists and objects as YAML flow, e.g. `[./a.md, ./b.md]`).
- JSON: `{ "file": "...", "field": "status", "value": "draft" }`
- Exit: `0` found · `3` file/frontmatter/field missing · `4` malformed · `2` usage.

**Whole frontmatter** (`get <file>`):

- Human: one `field: value` line per entry (values as YAML flow), in document order.
- JSON: `{ "file": "...", "frontmatter": { "status": "draft", "type": "task" } }`
- An empty frontmatter block yields `{}`; a file with no block exits `3`.
- Exit: `0` read · `3` file/frontmatter missing · `4` malformed · `2` usage.

## `fmctl set <file> <field>=<value>... [--json] [--schema <path>] [--no-validate]`

Surgically update/create one or more fields; validated by default. (FR-002–FR-007)

- Value syntax: a YAML value — plain scalar; leading `[` → flow sequence; leading `{` → flow
  mapping (JSON arrays and objects are valid YAML flow). Quoting forces string. Always a
  whole-value replacement of a top-level field; nested-path addressing is unsupported — a
  field name containing `.` exits `2` with `code` `nested-path-unsupported` ("nested paths
  unsupported in this version").
- `--no-validate` bypasses **schema validation only** (FR-006). Integrity guarantees are not
  flag-controllable.
- When no schema resolves (and not bypassed): write proceeds, stderr carries
  `notice: unvalidated write (no schema resolved for <file>)`. (FR-013)
- Human success: one line per change, e.g. `status: draft → review` / `tags: created`.
- JSON success:
  `{ "file": "...", "changes": [{ "field": "status", "before": "draft", "after": "review",
  "created": false }], "validated": true, "bypassed": false, "governedBy": { "authority":
  "invocation", "location": "/abs/schema.json" } }`
- Validation refusal (exit `1`), JSON stderr error includes `violations[]` with `field`,
  `value`, `message`, `expected` (FR-005/012). File untouched.
- Exit: `0` written+verified · `1` validation refusal · `2` usage · `3` not found · `4`
  malformed · `5` schema problem · `6` verification failure (restored) · `7` I/O.

## `fmctl lint [path...] [--json] [--schema <path>]`

Validate the given files and directories (default `.`): explicit file paths are linted
directly; directories are walked recursively — always, no recursion toggle in v0.1.
(FR-011–FR-013)

- Discovery: recursive `*.md`, honoring `.gitignore` files found in the walked tree; `.git`
  itself is always skipped, and there are no other built-in ignores (hidden directories such
  as `.github` are walked). Explicit file arguments are linted directly and never ignored.
- Per-file fault isolation: a malformed file is one `error` entry, the walk continues.
- Human output: one line per non-valid file
  (`✗ tasks/a.md  status: "done" not allowed — expected one of: draft, review`,
  `! notes/b.md  ungoverned (no schema)`, `- README.md  skipped (no frontmatter)`,
  `✗ broken.md  malformed frontmatter: <reason>`), then a summary line with counts.
- JSON output: the full `LintResult` from [data-model.md](../data-model.md).
- Exit decision, precedence top-down: `1` if any file's result has status `invalid` or `error`
  · `5` if `--schema` itself is unusable, or if no override was given, `summary.checked === 0`,
  and no file errored while Markdown files were found · else `0` (ungoverned and skipped files
  are reported, not failing). Thrown setup errors follow the global table (`3` nonexistent
  root path · `2` usage).
- Schema attribution: every checked file's result names its governing schema and the authority
  it governs by — `invocation` or `document` (FR-012).

## Modeline (read-only contract)

`# fmctl: $schema=<ref>` inside the frontmatter block. `<ref>`: absolute path, file-relative
path, or `https://…`/`http://…` — URIs exit `5` with code `schema-uri-reserved` ("reserved for
a future version"). No CLI command reads or writes the modeline as data; it survives every
`set` byte-for-byte. (FR-009/FR-010)
