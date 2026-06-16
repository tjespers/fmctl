# Feature Specification: Schema-Governed Frontmatter Management

**Feature Branch**: `001-schema-governed-frontmatter`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "fmctl v0.1 lets a developer — or an AI agent working on his behalf — manage the YAML frontmatter of Markdown files as schema-governed state. It works with any frontmatter'd Markdown file: a whole project, a single file, even a file following an external standard whose schema fmctl doesn't control. Its core differentiator: writes are validated by default, so neither human nor agent can put a file into an invalid state without explicitly bypassing validation. He can read the value of any frontmatter field, change one or more fields in place (scalar values, or replacing the entire value of a list field), and validate files' frontmatter against their governing schema. Validation uses industry-standard JSON Schema; a per-project schema document can describe required fields, allowed values, and per-type variations through standard schema composition. fmctl resolves which schema governs a file in precedence order: an explicit per-invocation flag; an in-file modeline comment inside the frontmatter block (a YAML comment, not a data field — invisible to validators and external consumers, and not writable through fmctl's own editing commands); or a small project config found by walking up from the target file, so different projects naturally carry different schemas with no global state. Where nothing resolves, editing works unvalidated and lint refuses loudly. A write validates the file's complete resulting frontmatter before anything touches disk: on violation, nothing is written. A narrowly-scoped flag bypasses schema validation only — the integrity guarantees (surgical edits, post-write verification, refusal of malformed files) can never be bypassed. Edits are surgical: only the changed field's content differs; comments, key order, formatting, and the document body are untouched. Lint walks all Markdown files under a path: files without frontmatter are skipped and reported, malformed frontmatter is an error, and the report names which schema governed each file. Every command serves humans and agents equally (machine-readable output, predictable exit codes). Success means fmctl dogfooding on the author's real project: lint catches every seeded violation, every write produces a verified minimal diff, and an agent attempting an invalid state change is stopped with an error it can act on. Out of scope for v0.1: folder-wide querying, dependency-graph analysis, item-level list editing, remote schema URLs, glob-to-schema mappings in project config, schema-association policy controls, and $schema as a frontmatter data field."

*Note: the description above is the historical input to `/speckit-specify`. The project-config
mechanism it mentions was subsequently removed from v0.1 scope (see FR-008 and Out of Scope);
the per-invocation override and the in-file modeline are the only v0.1 schema sources. Lint's
"walks all Markdown files" was likewise refined during review: discovery honors `.gitignore`
(see FR-011). Reading was broadened after the original spec: a read returns either a single
field or the entire frontmatter of one file (see FR-001 and User Story 3).*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Surgical, Validated Field Edits (Priority: P1)

A developer — or an AI agent acting on his behalf — changes the state recorded in a Markdown file (for example, moving a task's `status` from `draft` to `review`) by setting one or more frontmatter fields in a single command. The proposed change is validated against the file's governing schema before anything touches disk, and the resulting file differs only in the changed fields — every comment, every other key, all formatting, and the entire document body survive byte-for-byte.

**Why this priority**: This is the product's reason to exist and its differentiator: a write operation that can neither corrupt a file's formatting nor put its data into an invalid state. Every other capability builds on trust in this one.

**Independent Test**: In a folder containing a schema and one Markdown file, set a field to an allowed value and verify the file changed only on that field's line; then set a disallowed value and verify the file is byte-identical to before and the command failed with an actionable error.

**Acceptance Scenarios**:

1. **Given** a file whose frontmatter is valid against its governing schema, **When** the user sets a field to a value the schema allows, **Then** the file contains the new value and every other byte of the file is unchanged (comments, key order, spacing, quoting, blank lines, document body).
2. **Given** a schema restricting a field to a set of allowed values, **When** the user sets that field to a disallowed value, **Then** nothing is written, and the command fails with an error naming the file, the field, the offending value, and the allowed values, using a distinct exit code.
3. **Given** a field that does not yet exist in a file's frontmatter, **When** the user sets it and the resulting frontmatter validates, **Then** the field is added as a new line and all existing content is otherwise unchanged.
4. **Given** a list-valued field (e.g. `links`), **When** the user replaces it with a new list of values, **Then** the resulting frontmatter contains exactly the new list, validates against the schema, and the rest of the file is unchanged.
5. **Given** multiple field=value pairs in one invocation, **When** the command runs, **Then** validation considers the complete resulting frontmatter, and either all changes are applied or none are.
6. **Given** the validation-bypass option, **When** the user sets a value the schema forbids, **Then** the write proceeds — while surgical-edit behavior and post-write verification still fully apply.
7. **Given** a file with malformed frontmatter, **When** the user attempts any edit, with or without the bypass option, **Then** the command refuses, nothing is modified, and the error names the file and the parse problem.
8. **Given** an object-valued field (or a field being created), **When** the user replaces it with a new object value, **Then** the resulting frontmatter contains exactly the new object as the field's whole value, it validates against the schema, and the rest of the file is unchanged.
9. **Given** a write that fails after validation (the target becomes unwritable, the operation is interrupted, or self-verification detects an anomaly), **When** the command ends, **Then** the original file content is intact byte-for-byte and the command fails with a distinct exit code.

---

### User Story 2 - Validate a Folder Against Its Schema (Priority: P2)

A developer, a CI job, or an agent checks an entire folder tree of Markdown files for frontmatter that violates the project's rules, receiving a precise per-file report of what is wrong and what would be valid.

**Why this priority**: Validation across the whole corpus is how invalid state already present in a project gets found — it turns the schema from documentation into an enforced contract, and it is the natural CI / agent guardrail.

**Independent Test**: In a folder containing a schema plus a mix of valid files, files with seeded violations, files without frontmatter, one malformed file, and one gitignored file, run lint once and verify each file is classified correctly — the gitignored file absent — with an overall failing exit code.

**Acceptance Scenarios**:

1. **Given** a folder where every file's frontmatter is valid, **When** lint runs, **Then** it reports the files checked and exits with the success code.
2. **Given** files with seeded schema violations, **When** lint runs, **Then** every violation is reported with the file, the field, the violating value, and what the schema would accept, and the command exits with a distinct failure code.
3. **Given** Markdown files without any frontmatter block, **When** lint runs, **Then** those files are reported as skipped and do not cause failure.
4. **Given** a file with malformed frontmatter, **When** lint runs, **Then** that file is reported as an error, the remaining files are still checked, and the overall exit code signals failure.
5. **Given** a mixed folder, **When** lint runs, **Then** the report names which schema governed each checked file.
6. **Given** no schema can be resolved for the lint target, **When** lint runs, **Then** it fails loudly with a distinct error explaining that nothing could be validated.
7. **Given** a tree whose `.gitignore` excludes a directory containing Markdown files, **When** lint runs, **Then** the excluded files are neither checked nor reported, while explicitly named file arguments are always linted even when ignored.

---

### User Story 3 - Read Frontmatter: a Field or the Whole Block (Priority: P3)

A developer or agent reads frontmatter from a file — either the value of one named field, or the entire frontmatter (every top-level field and its whole value) in a single operation. A human gets a plainly printed value or a readable rendering; a script or agent gets structured output. Reading the whole block at once is the natural first step of the agent loop ("read all state before acting") and mirrors editing, which already accepts multiple fields in one invocation.

**Why this priority**: Reading is the cheapest, most frequent operation in agent workflows (check state before acting), but it delivers value only alongside trustworthy editing and validation.

**Independent Test**: On a file with known frontmatter, read an existing scalar field, an existing list field, a missing field, and the whole frontmatter at once; verify the individual values, the complete field set, and the distinct not-found failure.

**Acceptance Scenarios**:

1. **Given** a file with an existing field, **When** the user reads it, **Then** the value is printed plainly, and structured output is available on request.
2. **Given** a field that does not exist in the file, **When** the user reads it, **Then** the command fails with a distinct not-found error and exit code.
3. **Given** a list-valued field, **When** the user reads it with structured output, **Then** the full list of values is returned.
4. **Given** a file with malformed frontmatter, **When** the user reads a field or the whole frontmatter, **Then** the command refuses with an error naming the file and the parse problem.
5. **Given** a file with frontmatter, **When** the user reads the whole frontmatter (naming no field), **Then** every top-level field and its whole value is returned as structured output, with a plain rendering available for humans; reading never validates.
6. **Given** a file whose frontmatter block is empty, **When** the user reads the whole frontmatter, **Then** an empty set of fields is returned and the command succeeds.

---

### User Story 4 - Govern Files Whose Format You Don't Own (Priority: P4)

A developer brings a file that follows an external standard — one whose schema forbids adding arbitrary fields (for example, a skill-definition file) — under fmctl governance by adding a modeline comment inside its frontmatter block. The file remains fully conformant to its external standard, because the modeline is a comment, not data. The same mechanism governs a standalone file that belongs to no project at all.

**Why this priority**: This makes "works with ANY frontmatter'd Markdown file" literally true — including formats fmctl doesn't control and files outside any project — but it builds entirely on the resolution and validation machinery of Stories 1–2.

**Independent Test**: Take a file with a strict external schema, add a modeline pointing at that schema, and verify lint and set validate against it — without any new data field appearing in the file's frontmatter.

**Acceptance Scenarios**:

1. **Given** a file whose frontmatter block contains a modeline comment referencing a schema, **When** any command needs the file's governing schema and no per-invocation override is supplied, **Then** the modeline's schema is used.
2. **Given** a standalone file anywhere on disk, **When** it carries a modeline, **Then** validation works with no project context or configuration of any kind.
3. **Given** a file with no modeline and no per-invocation override, **When** a write occurs, **Then** it proceeds unvalidated with a diagnostic notice, and lint reports the file as ungoverned.
4. **Given** a per-invocation schema override, **When** supplied, **Then** it takes precedence over any modeline.
5. **Given** any write to a file carrying a modeline, **When** the write completes, **Then** the modeline comment is preserved exactly, and no editing command exists that can alter it as data.
6. **Given** a modeline referencing a schema document that does not exist or cannot be read, **When** any command needs it, **Then** the command refuses loudly, naming the file, the modeline reference, and the problem.
7. **Given** a modeline whose schema reference is a URI (`https://…`), **When** any command needs the file's governing schema, **Then** the command refuses with a distinct error stating that URI references are reserved for a future version.

---

### Edge Cases

- A file with malformed YAML or a missing closing delimiter is never read best-effort and never written to — distinct error and exit code, file and problem named, with or without the bypass option.
- A Markdown file with no frontmatter block at all: lint reports it as skipped; read and edit commands fail with a distinct "no frontmatter" error (creating a new frontmatter block is out of scope for v0.1).
- An empty frontmatter block (delimiters with nothing between): reading a named field yields not-found; reading the whole frontmatter yields an empty set of fields; setting a field creates it.
- A file that is already invalid against its schema in field B, when the user edits only field A: whole-document validation fails, naming field B. The user fixes both in one multi-field invocation or uses the bypass deliberately.
- The schema document itself is unreadable, not valid JSON, or not a valid schema: every operation needing it refuses loudly.
- Frontmatter containing duplicate keys: refused as ambiguous — named file, named key.
- Frontmatter whose data cannot be represented in the validation data model (e.g. non-string keys): refused with a clear explanation.
- A write that fails mid-operation (disk full, permissions, interruption): the original file content remains intact, byte-for-byte.
- Setting a field whose name contains a dot (e.g. `meta.author`): refused with a distinct "nested paths unsupported in this version" error — nested addressing and writing literal dotted keys are both deferred, so the rejection stays unambiguous. Reads treat field names as literal top-level keys.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST read frontmatter from a Markdown file in two forms — the value of a single named top-level field, or the entire frontmatter (every top-level field and its whole value) in one operation — each with both human-readable and machine-readable output forms. Reads never validate.
- **FR-002**: The system MUST update one or more top-level frontmatter fields in a single invocation, accepting any JSON-representable value (scalar, list, or object) as a whole-value replacement of each named field.
- **FR-003**: The system MUST create a top-level field that does not yet exist when it is set (added as a new line at the end of the frontmatter block), subject to the same validation as any other write.
- **FR-004**: After any successful write, all file content other than the changed fields' lines MUST be byte-identical to before: comments (block and inline), key order, quoting style, indentation, whitespace, blank lines, and the entire document body.
- **FR-005**: Writes MUST validate the file's complete resulting frontmatter against its governing schema before any disk modification; on violation nothing is written, and the error names the file, the field, the violating value, and what the schema would accept.
- **FR-006**: A validation-bypass option MUST skip schema validation only; the surgical-edit guarantee, post-write verification, and refusal of malformed files MUST NOT be bypassable by any option.
- **FR-007**: Every write MUST be atomic and self-verified: the system re-reads its own output, confirms the data matches the intended change, and confirms the change is confined to the expected fields; on any anomaly the original content is restored exactly and the command fails with a non-zero exit code.
- **FR-008**: The system MUST resolve a file's governing schema in this precedence order: per-invocation override, in-file modeline, none. No ambient or global configuration is consulted in v0.1.
- **FR-009**: The modeline MUST be a YAML comment inside the frontmatter block: invisible to schema validation and to external consumers of the file's data, never readable or writable as a field through the system's commands, and preserved exactly by all writes.
- **FR-010**: Modeline schema references MUST support absolute filesystem paths and file-relative paths (resolved against the referencing file's directory). URI references (e.g. `https://…`) MUST be recognized and rejected with a distinct error stating they are reserved for a future version.
- **FR-011**: Lint MUST accept both files and directories: explicit file paths are linted directly (ignore rules never apply to them), and directories are walked recursively (always — v0.1 has no recursion toggle), honoring `.gitignore` files found in the walked tree; the `.git` directory itself is always skipped, and there are no other built-in ignores. Each file is validated against its resolved schema; files without frontmatter are reported as skipped, and files with malformed frontmatter are reported as errors without halting the remaining files.
- **FR-012**: The lint report MUST state, per file: which schema governed it (or why it was skipped or errored), and each violation with its field and what would have been valid.
- **FR-013**: When no schema resolves for a file: reads proceed normally; writes proceed without validation but MUST emit a diagnostic notice that the write was unvalidated; lint MUST report such files as ungoverned, and MUST fail with a distinct error when nothing at all could be validated (no override supplied, no file carries a modeline, and no per-file errors were reported — per-file violations and errors take precedence over this failure).
- **FR-014**: Every command MUST offer a machine-readable (JSON) output mode; results go to standard output and diagnostics to standard error.
- **FR-015**: Every failure class MUST be identifiable by a distinct, stable machine-readable code; every failure family MUST map to a distinct, documented exit code; and identical inputs MUST produce identical outcomes.
- **FR-016**: The system MUST refuse to read best-effort or write to: malformed frontmatter, frontmatter with duplicate keys, frontmatter not representable in the validation data model, and operations requiring an unreadable or invalid schema document — in each case naming the file and the specific problem.
- **FR-017**: Schemas MUST be standard JSON Schema documents, usable unmodified by third-party tools, with per-type variation expressed through standard schema composition — no tool-specific schema extensions.
- **FR-018**: Every capability MUST be available to programmatic consumers without invoking the command-line binary; the command-line interface is one consumer of the same capability surface.

### Key Entities

- **Markdown document**: a file consisting of an optional frontmatter block followed by a body; the body is opaque to the system and always preserved byte-for-byte.
- **Frontmatter block**: the delimited YAML region at the top of a document; the unit the system reads, edits, and validates.
- **Field**: a top-level entry in the frontmatter holding any JSON-representable value (scalar, list, or object); the unit of whole-value read and write operations.
- **Modeline**: a comment inside the frontmatter block associating the file with a schema; metadata about the document, never part of its data.
- **Schema document**: a standard JSON Schema describing what valid frontmatter looks like, possibly varying by the file's declared type via composition.
- **Schema association**: the outcome of resolution for a given file — which schema governs it and by which mechanism (override, modeline, none).
- **Violation**: a single way in which a file's frontmatter fails its schema: the field, the offending value, and what would have been accepted.
- **Lint report**: the per-file results of validating a tree: checked/skipped/errored status, governing schema, and any violations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a corpus of representative real-world files (comments, inline comments, unusual spacing, flow-style lists, varied quoting), single-field edits produce diffs touching only the edited field's lines in 100% of cases.
- **SC-002**: 100% of attempted writes that would violate the governing schema leave the target file byte-identical to its prior state, and every such refusal names the file, field, and acceptable values.
- **SC-003**: Linting the author's real project flags every violation in a seeded set of at least 20 across all violation classes, with zero false positives.
- **SC-004**: An AI agent completes a read–edit–validate cycle end-to-end using only machine-readable output and exit codes — no human interpretation — on the first attempt.
- **SC-005**: After any induced failure (interrupted write, permission error, unreadable schema), the target file's content is byte-identical to its pre-operation state in 100% of trials.
- **SC-006**: A file conforming to a strict external standard is brought under validation without adding a single data field to its frontmatter, and remains fully valid under its external standard afterwards.
- **SC-007**: Linting 1,000 files completes in under 10 seconds on a typical developer machine.

## Assumptions

- Values supplied to an edit are interpreted as YAML values: plain scalars (unquoted `true`/`42` become boolean/number; quoting forces a string), flow sequences (`[…]`) for lists, and flow mappings (`{…}`) for objects; the schema then enforces expected types.
- Newly created fields are appended at the end of the frontmatter block.
- Reads and writes address top-level fields only, always as whole values; a read targets either one named field or the entire frontmatter of a file, while a write names one or more fields. Nested-path addressing is unsupported in v0.1 — a write naming a field that contains a dot is rejected with a distinct error (writing literal dotted keys is deferred along with nested addressing), while reads treat field names literally.
- Read and edit commands operate on one file per invocation; folder-scale operation is lint's job in v0.1. Reading the whole frontmatter of a single file is in scope; querying across a folder (the "query like a database" use case) remains out of scope.
- A Markdown file with no frontmatter block cannot be read from or written to in v0.1 (distinct error); creating frontmatter blocks from scratch is deferred.
- The exact modeline syntax is a design-phase decision; one modeline per file applies in v0.1. Relative modeline references intentionally travel with the file (moving a file without its schema breaks the reference — accepted for v0.1; stable URI references arrive with the future configuration/catalog feature).
- v0.1 has no configuration file concept at all; in practice, project-wide schema enforcement is achieved by supplying the per-invocation schema override (e.g. via a task runner or agent harness wrapper).
- One current, widely supported JSON Schema draft is targeted (selected at design time); schema documents are local files, and a schema split across multiple documents (cross-file references) is out of scope for v0.1.
- A "Markdown file", for lint discovery, is a file with the `.md` extension; other Markdown extensions (`.markdown`, `.mdx`) are out of scope for v0.1.
- Lint discovery honors `.gitignore` files encountered within the linted tree — no git-repo detection, no global or repo-local exclude files (`.git/info/exclude`), and linting a subdirectory does not see a parent directory's `.gitignore` (collect-upward arrives with the future configuration spec). The `.git` directory is always skipped.
- Single user on a local filesystem; concurrent writers to the same file are out of scope.
- Success criterion SC-003 is evaluated by dogfooding on the author's real Markdown-state project.

## Out of Scope (v0.1)

- Folder-wide querying of frontmatter ("query the folder like a database").
- Link/dependency-graph analysis and blast-radius reporting.
- Item-level list editing and nested-path addressing; only whole-value replacement of top-level fields is supported.
- Remote schema fetching and published-schema resolution; cross-file schema references. (URI references in modelines are syntactically reserved and rejected in v0.1.)
- Any project configuration concept: config files, ambient schema discovery (upward walk), schema catalogs, glob-to-schema mappings, cascading configurations, and schema-association policy controls — all deferred to a dedicated future configuration spec.
- `$schema` (or any schema pointer) as a frontmatter data field.
- Creating frontmatter blocks in files that have none.
