# fmctl

Manage the YAML frontmatter of Markdown files as **schema-governed state**.

`fmctl` reads, edits, and validates frontmatter for any frontmatter'd Markdown
file — a whole project, a single file, or a file following an external standard
whose schema `fmctl` doesn't control. Its core guarantee: **writes are validated
by default**, so neither a human nor an agent can put a file into an invalid
state without explicitly bypassing validation — and edits are **surgical**, so
only the changed field's bytes differ. Every command serves humans and agents
equally (machine-readable output, predictable exit codes).

> v0.1 is local-development software. Build it and run the `fmctl` binary from
> this checkout; it is not published yet.

## Build

```sh
task setup        # pre-commit hooks + npm install
npm run build     # tsc → dist/
npm test          # full suite
```

This produces the `fmctl` CLI at `dist/cli/main.js` and a library entry at
`dist/lib/index.js`.

## Commands

### `fmctl get <file> [field] [--json] [--schema <path>]`

Read one top-level field, or — when `field` is omitted — the whole frontmatter.
Field names are literal top-level keys (no nested addressing). `--schema` is
accepted for symmetry; reads never validate.

```sh
fmctl get task.md status            # → draft
fmctl get task.md links --json      # → {"file":"…","field":"links","value":["./a.md"]}
fmctl get task.md                   # → every field, one `field: value` line
fmctl get task.md --json            # → {"file":"…","frontmatter":{"status":"draft",…}}
```

### `fmctl set <file> <field>=<value>... [--json] [--schema <path>] [--no-validate]`

Surgically update or create one or more top-level fields, validated by default.
The value is a YAML value: a plain scalar, a `[…]` flow sequence, or a `{…}` flow
mapping (JSON arrays/objects are valid YAML flow). All changes apply together or
none do.

```sh
fmctl set task.md status=review --schema schema.json
fmctl set task.md priority=high 'links=[./a.md, ./b.md]' --schema schema.json
fmctl set task.md status=bogus --schema schema.json --no-validate  # bypass validation only
```

`--no-validate` skips **schema validation only**. The integrity guarantees —
surgical edits, post-write verification, and refusal of malformed files — can
never be bypassed. When no schema resolves, the write proceeds and a notice is
printed to stderr.

### `fmctl lint [paths...] [--json] [--schema <path>]`

Validate frontmatter across files and directories (default `.`). Directories are
walked recursively, honoring `.gitignore` files within the tree; `.git` is always
skipped and explicitly named files are always linted. Files without frontmatter
are reported as skipped; malformed files are reported as errors without halting
the rest.

```sh
fmctl lint docs --schema schema.json
fmctl lint docs --schema schema.json --json
```

## Schema resolution

For each file, the governing schema is resolved in this precedence order
(no ambient or global configuration in v0.1):

1. **`--schema` override** — a per-invocation flag (absolute or cwd-relative path).
2. **In-file modeline** — a YAML comment inside the frontmatter block.
3. **None** — reads work; writes proceed unvalidated with a notice; lint reports
   the file as ungoverned.

### Modeline

A modeline is a YAML comment inside the frontmatter block — invisible to schema
validators and external consumers, never readable or writable as a field, and
preserved byte-for-byte by every write:

```markdown
---
# fmctl: $schema=./schema.json
status: draft
type: task
---
```

The reference may be an absolute path or a path relative to the file's directory.
URI references (`https://…`) are recognized but reserved for a future version
(they exit with code 5). This is how a file following a strict external standard
(`additionalProperties: false`) is brought under governance without adding any
data field to its frontmatter.

## Exit codes

Every failure family maps to a distinct exit code; the precise error class is
carried in the JSON error's `code` field.

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | schema validation / lint violations |
| 2 | usage error (bad flag, unparseable `field=value`, nested-path field name) |
| 3 | not found (file, frontmatter block, or field) |
| 4 | malformed frontmatter (parse error, duplicate key, unrepresentable data) |
| 5 | schema problem (unresolvable, invalid, or reserved URI ref) |
| 6 | post-write verification failed (original restored) |
| 7 | filesystem failure |

In `--json` mode, results go to stdout and a failure prints one JSON object to
stderr: `{ "error": { "code", "message", "file?", "field?", "violations?" } }`.

## Library

The CLI is one consumer of the library; every capability is available
programmatically through the package entry point.

```ts
import { getField, getFrontmatter, setFields, lintPaths } from '@tjespers/fmctl';

const { value } = await getField('task.md', 'status');
const { frontmatter } = await getFrontmatter('task.md'); // the whole block at once

const result = await setFields(
  'task.md',
  { status: 'review', links: ['./a.md', './b.md'] },
  { schema: './schema.json' },
);
// result.changes, result.validated, result.governedBy

const report = await lintPaths(['docs'], { schema: './schema.json' });
// report.files[], report.summary
```

Typed errors (`ValidationError`, `ParseError`, `VerificationError`, …) extend a
common `FmctlError` base carrying a stable `code` and an `exitCode`.
