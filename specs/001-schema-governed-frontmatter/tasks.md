---

description: "Task list for schema-governed frontmatter management (001)"
---

# Tasks: Schema-Governed Frontmatter Management

**Input**: Design documents from `/specs/001-schema-governed-frontmatter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are MANDATORY and test-first (Constitution Principle IV: Test-First, No
Exceptions). Every task phase includes test tasks written and observed failing before
implementation tasks begin. Red-green-refactor applies to the CLI surface too.

**Organization**: Tasks are grouped by user story (spec.md US1–US4) so each story is an
independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

Single package at repository root: `src/lib/` (library — the product), `src/cli/` (thin
adapter), `tests/` (`unit/`, `integration/`, `fixtures/`, `helpers/`) per plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — compiler, test runner, package surface

- [x] T001 Extend package.json: runtime deps `yaml@^2.9`, `ajv@^8`, `ajv-formats`, `commander`, `ignore`; dev deps `typescript@^5`, `vitest`, `@types/node`; `exports` (library entry `./dist/lib/index.js` + types), `bin.fmctl` → `./dist/cli/main.js`, scripts `build` (tsc) and `test` (vitest run)
- [x] T002 [P] Create tsconfig.json: `strict`, `module`/`moduleResolution` NodeNext, ES2022 target, `declaration`, `rootDir` src, `outDir` dist
- [x] T003 [P] Create vitest.config.ts (node environment, `tests/**/*.test.ts` include; `passWithNoTests: true` so the Phase 1 checkpoint is green before any tests exist; `slow` tag support for the perf test)
- [x] T004 [P] Create directory skeleton `src/lib/`, `src/cli/commands/`, `tests/{unit,integration,fixtures/{splice,lint,modeline,schemas},helpers}/` with `.gitkeep`s, and add `build`/`test` tasks to Taskfile.yml

**Checkpoint**: `npm install && npm run build && npm test` runs (zero tests, green)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Typed errors and the document model — every user story consumes both

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Write unit tests for the error hierarchy (every class: stable `code`, `exitCode` per research.md R5 table, `file`/`field` context, `instanceof FmctlError`) in tests/unit/errors.test.ts — observe failing
- [x] T006 Implement typed error hierarchy per data-model.md in src/lib/errors.ts
- [x] T007 [P] Create base golden corpus in tests/fixtures/splice/ (well-formed variants: block+inline comments, odd spacing, flow/block lists, quoting variants, CRLF, empty block; malformed variants: unclosed delimiter, broken YAML, duplicate keys, non-string keys) plus corpus loader and byte-level diff assertion helpers in tests/helpers/corpus.ts
- [x] T008 [P] Write unit tests for the document model (delimiter split with byte-faithful body, `raw` reassembly invariant, CRLF preservation, field locate via `node.range` with 1-based `entryLines`, typed refusals: NoFrontmatterError/ParseError/DuplicateKeyError/NotRepresentableError) in tests/unit/document.test.ts — observe failing
- [x] T009 Implement FrontmatterDocument load/split/parse/locate per data-model.md in src/lib/document.ts
- [x] T010 Create public API barrel exporting errors + document types in src/lib/index.ts

**Checkpoint**: Foundation green — user story implementation can begin

---

## Phase 3: User Story 1 - Surgical, Validated Field Edits (Priority: P1) 🎯 MVP

**Goal**: `setFields`/`fmctl set` — splice-edit one or more fields, validated against a schema
before anything touches disk, atomic verify-or-revert write (spec US1, FR-002–FR-007)

**Independent Test**: quickstart.md scenarios 2–6 — valid edit lands as a one-line diff;
invalid edit leaves the file byte-identical with an actionable error

### Tests for User Story 1 (MANDATORY — write first, observe failing) ⚠️

- [x] T011 [P] [US1] Extend tests/fixtures/splice/ with operation triples (input, operation, expected-output): scalar edit preserving inline comment, edit beside odd spacing, flow-list wholesale replace, block-list wholesale replace, object (flow-mapping) whole-value replace, quoted-value edit, field append to end of block, append to empty block, CRLF file edit
- [x] T012 [P] [US1] Write splice-engine unit tests asserting byte-level equality against every fixture triple (Buffer.equals, no string trimming) in tests/unit/splice.test.ts
- [x] T013 [P] [US1] Write value parsing/serialization unit tests (YAML value typing: `true`/`42`/quoted-string scalars; leading-`[` flow sequence incl. JSON array input; leading-`{` flow mapping incl. JSON object input; unparseable value syntax → UsageError; serialized form round-trips to identical parsed value) in tests/unit/values.test.ts
- [x] T014 [P] [US1] Write validation unit tests (Ajv2020 + ajv-formats wiring; translation: enum → `expected: one of …` with allowedValues, required → `field` = the missing property's name (from `params.missingProperty`), type mismatch; violations translated correctly through a composed per-type schema (allOf + if/then keyed on `type`); `allErrors`; unparseable/invalid schema → SchemaInvalidError) in tests/unit/validate.test.ts using tests/fixtures/schemas/
- [x] T015 [P] [US1] Write resolution unit tests for v0.1 chain without modeline (invocation override → GoverningSchema{authority:'invocation'}; nothing → null; missing/unreadable override file → SchemaUnresolvableError) in tests/unit/resolve.test.ts
- [x] T016 [P] [US1] Write atomic-writer unit tests (temp+rename in same dir; verify-before-rename: re-parse equality + line-span diff confinement; induced failures: read-only dir, injected rename failure, corrupted-render simulation → VerificationError/IoError with original byte-identical) in tests/unit/writer.test.ts
- [x] T017 [P] [US1] Write setFields orchestration unit tests (multi-field all-or-nothing, validation refusal writes nothing, created fields appended last, `changes[].before/after/created`, `validated`/`bypassed`/`governedBy` state, ValidationError carries violations, dotted field name → UsageError `code` `nested-path-unsupported` with nothing written) in tests/unit/api.set.test.ts

### Implementation for User Story 1

- [x] T018 [US1] Implement value parsing/serialization in src/lib/values.ts (green T013)
- [x] T019 [US1] Implement splice engine (range splice for existing fields, end-of-block append for new fields, EOL-flavor aware) in src/lib/splice.ts (green T012/T011)
- [x] T020 [US1] Implement schema resolution without modeline tier (override → null) in src/lib/resolve.ts (green T015)
- [x] T021 [US1] Implement ajv wrapper + violation translation in src/lib/validate.ts (green T014)
- [x] T022 [US1] Implement atomic verify-or-revert writer in src/lib/writer.ts (green T016)
- [x] T023 [US1] Implement setFields orchestration (load → edit → validate → stage → verify → commit per data-model.md pipeline) and export via src/lib/index.ts (green T017)
- [x] T024 [P] [US1] Write CLI integration tests for `fmctl set` driving the built binary via node:child_process (JSON success shape with before/after/governedBy, violation refusal exit 1 + stderr JSON with violations[], `--no-validate`, unvalidated-write stderr notice, exit codes 2/3/4/5/6 plus 7 on filesystem failure (e.g. read-only target directory), dotted field name exit 2 with `code` `nested-path-unsupported`, value syntax incl. flow lists) in tests/integration/cli-set.test.ts — observe failing
- [x] T025 [US1] Implement CLI scaffold: commander program in src/cli/main.ts and human/JSON renderers + FmctlError→exit-code mapping in src/cli/output.ts
- [x] T026 [US1] Implement `set` command (field=value parsing, --schema, --no-validate, --json) in src/cli/commands/set.ts (green T024)
- [x] T045 [P] Write architecture-guard test asserting src/cli sources import from the library only via src/lib/index.ts (scan import statements — zero new dependencies, Constitution Principle VII) in tests/unit/architecture.test.ts — cross-cutting, ordered here so the boundary is guarded from the first CLI code

**Checkpoint**: MVP — quickstart scenarios 2–6 pass end-to-end

---

## Phase 4: User Story 2 - Validate a Folder Against Its Schema (Priority: P2)

**Goal**: `lintPaths`/`fmctl lint` — recursive walk, per-file fault isolation, precise report
(spec US2, FR-011–FR-013)

**Independent Test**: quickstart.md scenario 7 — mixed folder classified correctly, exit 1

**Note**: Depends on US1's validate.ts and resolve.ts (library internals), not on US1's CLI.

### Tests for User Story 2 (MANDATORY — write first, observe failing) ⚠️

- [x] T027 [P] [US2] Create lint fixture tree in tests/fixtures/lint/ (valid files, seeded violations across violation classes incl. against a composed per-type schema, no-frontmatter file, malformed file, nested dirs, a hidden dir (e.g. `.docs/`) with a governed file that MUST be walked, gitignored content: root and nested ignore files with a dir-only and a negation pattern covering a violating file that must not be reported). Ignore files are stored as `_gitignore` and renamed to `.gitignore` when the corpus helper stages the tree into a temp dir — a real `.gitignore` in fixtures would make git ignore the fixtures themselves; extend tests/helpers/corpus.ts with this staging (which also exercises the no-git-repo case, per research R8)
- [x] T028 [P] [US2] Write lint unit tests (recursive `*.md` discovery honoring `.gitignore` — root and nested files, dir-only and negation patterns, ignored dirs pruned not descended, `.git` always skipped, hidden dirs walked; explicit file arguments linted directly even when gitignored; exit-precedence edge: all files errored → invalid/error outcome not nothing-validated, per-file fault isolation, FileLintResult statuses valid/invalid/ungoverned/skipped-no-frontmatter/error, governedBy attribution, summary counts, ErrorInfo serialization) in tests/unit/lint.test.ts
- [x] T029 [P] [US2] Write CLI integration tests for `fmctl lint` (human per-file lines + summary, `--json` full LintResult, exit 1 on invalid/error, exit 5 on unusable --schema and on nothing-validated, exit 0 when ungoverned and skipped files appear alongside at least one validated file, default path `.` when invoked with no path arguments) in tests/integration/cli-lint.test.ts

### Implementation for User Story 2

- [x] T030 [US2] Implement walker + report assembly in src/lib/lint.ts, export lintPaths via src/lib/index.ts (green T028)
- [x] T031 [US2] Implement `lint` command + renderers in src/cli/commands/lint.ts and extend src/cli/output.ts (green T029)

**Checkpoint**: US1 + US2 work independently — CI-style guardrail available

---

## Phase 5: User Story 3 - Read a Field (Priority: P3)

**Goal**: `getField`/`fmctl get` — plain and JSON reads (spec US3, FR-001)

**Independent Test**: quickstart.md scenario 1 — scalar, list, missing field, malformed

**Note**: Independent of US1/US2 — needs only the Phase 2 foundation.

### Tests for User Story 3 (MANDATORY — write first, observe failing) ⚠️

- [x] T032 [P] [US3] Write getField unit tests (scalar, list, object-valued field returned in full as JsonValue, FieldNotFoundError incl. on an empty frontmatter block, NoFrontmatterError, ParseError pass-through) in tests/unit/api.get.test.ts
- [x] T033 [P] [US3] Write CLI integration tests for `fmctl get` (plain value, flow-list rendering, `--json` GetResult shape, exit 0/3/4) in tests/integration/cli-get.test.ts

### Implementation for User Story 3

- [x] T034 [US3] Implement getField and export via src/lib/index.ts (green T032)
- [x] T035 [US3] Implement `get` command in src/cli/commands/get.ts (green T033)

**Checkpoint**: All read/write/validate primitives shipped

---

## Phase 6: User Story 4 - Govern Files Whose Format You Don't Own (Priority: P4)

**Goal**: modeline (`# fmctl: $schema=<ref>`) as document-authority schema source
(spec US4, FR-008–FR-010)

**Independent Test**: quickstart.md scenario 8 — external-standard file governed without new
data fields; URI ref exits 5; modeline survives writes byte-for-byte

### Tests for User Story 4 (MANDATORY — write first, observe failing) ⚠️

- [ ] T036 [P] [US4] Create modeline fixtures in tests/fixtures/modeline/ (modeline-governed file, strict external-standard file with `additionalProperties: false` schema, URI modeline, broken-ref modeline, standalone file outside any tree, modeline+odd placement within block)
- [ ] T037 [P] [US4] Write modeline unit tests (grammar scan on raw frontmatter text, whitespace tolerance, first-match-wins, SchemaRef kinds absolute/relative/uri with `location` resolution, never exposed as data) in tests/unit/modeline.test.ts
- [ ] T038 [P] [US4] Extend resolution + document tests: modeline tier precedence (invocation override beats modeline; modeline → GoverningSchema{authority:'document'}; broken ref → SchemaUnresolvableError; URI ref → distinct `schema-uri-reserved` code) in tests/unit/resolve.test.ts and FrontmatterDocument.modeline field in tests/unit/document.test.ts
- [ ] T039 [P] [US4] Write CLI integration tests: set/lint against modeline-governed and standalone files, modeline byte-survival through writes, URI exit 5, lint authority attribution "document" in tests/integration/cli-modeline.test.ts

### Implementation for User Story 4

- [ ] T040 [US4] Implement modeline scanner/parser in src/lib/modeline.ts (green T037)
- [ ] T041 [US4] Wire modeline tier into src/lib/resolve.ts and `modeline` field into src/lib/document.ts; implement resolveSchema public function; export Modeline/SchemaRef/GoverningSchema via src/lib/index.ts (green T038/T039)

**Checkpoint**: All four user stories pass their quickstart scenarios

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T042 [P] Write agent round-trip integration test: scripted get → set --json → lint --json cycle consuming only JSON stdout/stderr + exit codes (SC-004, quickstart scenario 10) in tests/integration/agent-roundtrip.test.ts
- [ ] T043 [P] Write performance test: generate 1,000 governed files in a temp dir, assert lint wall-clock < 10 s, tagged slow (SC-007, quickstart scenario 11) in tests/integration/perf-lint.test.ts
- [ ] T044 [P] Write README.md: usage for all three commands, modeline syntax, exit-code table (the documented contract per FR-015), library-consumer example
- [ ] T046 Execute quickstart.md scenarios 1–9 manually against the built binary and dogfood on the author's real project with ≥20 seeded violations; record results in specs/001-schema-governed-frontmatter/quickstart-results.md (SC-001–SC-006)
- [ ] T047 Final pass: `npm run build && npm test` green, pre-commit hooks green, no constitution violations (re-read gate table in plan.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on Foundational + US1's library modules (validate.ts, resolve.ts); independent of US1's CLI
- **US3 (Phase 5)**: depends on Foundational only — can run in parallel with US1/US2
- **US4 (Phase 6)**: depends on Foundational + US1's resolve.ts
- **Polish (Phase 7)**: depends on all user stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle IV)
- Fixtures before tests that consume them; library before CLI command; CLI scaffold (T025) before any command task

### Parallel Opportunities

- Setup: T002–T004 after T001
- Foundational: T005, T007, T008 together; T006 after T005; T009 after T007/T008
- US1: T011–T017 all parallel (different files); T018–T023 sequenced by module dependency; T024 parallel with T018–T023; T045 any time after T025
- US3 can start the moment Phase 2 completes, fully parallel with US1
- Polish: T042–T044 parallel

---

## Parallel Example: User Story 1 red phase

```bash
# All US1 test tasks land together (different files, all must fail first):
Task: "T012 splice-engine tests in tests/unit/splice.test.ts"
Task: "T013 value parsing tests in tests/unit/values.test.ts"
Task: "T014 validation tests in tests/unit/validate.test.ts"
Task: "T015 resolution tests in tests/unit/resolve.test.ts"
Task: "T016 writer tests in tests/unit/writer.test.ts"
```

---

## Implementation Strategy

### Branching & Review Gate

All implementation work lands on feature branch `001-schema-governed-frontmatter`. Merging to
`main` requires a PR reviewed against this spec (FR coverage via the code-reviewer skill) —
the constitution's Development Workflow gate.

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2 → Phase 3 (US1)
2. **STOP and VALIDATE**: quickstart scenarios 2–6; the riskiest part (splice + verify-or-revert + validated writes) is proven here
3. Dogfood a few real edits before continuing

### Incremental Delivery

1. US1 → MVP: validated surgical edits (the USP)
2. US2 → lint: the CI/agent guardrail
3. US3 → get: completes the agent read–edit–validate loop
4. US4 → modeline: external-standard and standalone files
5. Polish → agent round-trip + perf + docs + dogfood gate

---

## Notes

- Tests are constitutionally mandatory — observe red before green, every module, CLI included
- Fixture files are byte-exact: never hand-"clean" them; mutating pre-commit hooks already exclude `tests/fixtures/`
- Commit after each task or logical group (Conventional Commits enforced by hook)
- Splice engine and writer are the constitution-critical components — when in doubt, add a fixture
