# Implementation Plan: Schema-Governed Frontmatter Management

**Branch**: `main` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-schema-governed-frontmatter/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

fmctl v0.1 delivers schema-governed editing of YAML frontmatter in Markdown files: surgical
`set` writes that are validated against a JSON Schema before anything touches disk, `get`
reads, and folder-wide `lint` — as a TypeScript library with a thin CLI as its first consumer.
The technical core is a splice-edit engine (parser used only to locate byte ranges; new values
spliced into the original source text; whole-document re-serialization prohibited) wrapped in
an atomic, self-verifying writer. Schema resolution is deliberately minimal in v0.1:
per-invocation `--schema` override → in-file modeline comment → none (no configuration concept).

## Technical Context

**Language/Version**: TypeScript 5.x, `strict` mode, ESM-only; Node.js ≥ 22 (developed on 25)

**Primary Dependencies**: `yaml` 2.9.x (parse-to-locate only), `ajv` 8.x + `ajv-formats`
(JSON Schema draft 2020-12), `commander` (CLI argument parsing). Dev: `typescript`, `vitest`.
No other runtime dependencies; walking and process control use `node:fs`/`node:child_process`.

**Storage**: local filesystem only — Markdown files edited in place via temp-file + rename

**Testing**: vitest; full TDD (constitution Principle IV); golden-file fixture corpus under
`tests/fixtures/` with byte-level diff assertions; induced-failure tests for verify-or-revert;
integration tests driving the built CLI binary via JSON output and exit codes only

**Target Platform**: Linux and macOS, Node.js runtime

**Project Type**: single npm package exposing a library entry point (`exports`) and a CLI
binary (`bin`) — library-first, CLI is the reference consumer

**Performance Goals**: lint of 1,000 files completes in < 10 s (SC-007); single-threaded is
comfortably sufficient at the envelope (hundreds to low thousands of files)

**Constraints**: byte-level conservatism — a write may alter only the lines of the fields it
was asked to change (no re-serialization of untouched content); writes are atomic and
self-verified with restore-on-anomaly; malformed input is refused, never repaired; every
failure class is a typed, exported error mapped 1:1 to a documented exit code

**Scale/Scope**: 3 CLI commands (`get`, `set`, `lint`), ~9 library modules, hundreds to low
thousands of Markdown files per invocation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Design compliance | Status |
|---|-----------|-------------------|--------|
| I | Byte-Level Conservatism | Splice engine edits source text via parser-located byte ranges; body split off as opaque bytes and never parsed; no write path may call whole-document serialization (`doc.toString()` proven normalizing in 2026-06-10 spike) | PASS |
| II | Verify-or-Revert Writes | Dedicated atomic writer: temp file + rename; post-write re-parse asserting data-matches-intent and diff confined to expected fields; anomaly → original restored, distinct exit code 6 | PASS |
| III | Refuse Loudly | Typed error hierarchy in the library (parse, duplicate-key, no-frontmatter, field-not-found, schema-unresolvable, schema-invalid, validation, verification, I/O), each mapped 1:1 to documented exit codes; no best-effort reads; URI modelines rejected with a distinct reserved error | PASS |
| IV | Test-First, No Exceptions | TDD workflow enforced in task ordering (tests authored and observed failing before implementation); golden corpus with byte-diff assertions is the executable form of FR-004 | PASS |
| V | Agent-First Ergonomics | `--json` on every command; results → stdout, diagnostics → stderr; exit-code table is a documented contract; errors carry file/field/value/expected | PASS |
| VI | Boring Code, Lean Deps | 4 runtime deps, each justified in [research.md](./research.md): `yaml` (only maintained TS parser exposing node byte ranges), `ajv`+`ajv-formats` (richest error params for the translation layer), `commander` (boring standard). Walker/process needs met by Node built-ins — no globby, no execa | PASS |
| VII | Library-First, Prove Before Grow | All capability in `src/lib/` behind a single public entry; `src/cli/` imports only that entry (FR-018); no query/graph/config speculation — v0.1 resolution chain is flag → modeline → none | PASS |

**Technical Constraints check**: TS strict ✓, Node on Linux+macOS ✓, dual surface (exports +
bin, type declarations published) ✓, performance secondary to correctness ✓, local-dev
distribution only ✓.

**Post-design re-check (after Phase 1)**: PASS — no new violations introduced by the data
model or contracts; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-schema-governed-frontmatter/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── library-api.md   # Public library surface (the product contract)
│   └── cli-interface.md # CLI commands, flags, output shapes, exit codes
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── index.ts         # public API barrel — the ONLY import surface for consumers & CLI
│   ├── errors.ts        # typed error hierarchy (exit-code-mapped)
│   ├── document.ts      # frontmatter document model: delimiter split, parse, node location
│   ├── splice.ts        # splice engine: byte-range edits on original source text
│   ├── values.ts        # field-value parsing (YAML scalar / flow collection) & serialization
│   ├── writer.ts        # atomic write + post-write verification + restore-on-anomaly
│   ├── modeline.ts      # modeline scan/parse (`# fmctl: $schema=<ref>`)
│   ├── resolve.ts       # schema resolution chain: override → modeline → none
│   ├── validate.ts      # ajv wrapper + error translation to actionable violations
│   └── lint.ts          # recursive walker, per-file fault isolation, report assembly
└── cli/
    ├── main.ts          # bin entry: commander program wiring
    ├── commands/
    │   ├── get.ts
    │   ├── set.ts
    │   └── lint.ts
    └── output.ts        # human/JSON renderers, error → exit-code mapping

tests/
├── fixtures/            # golden corpus — byte-exact; excluded from mutating pre-commit hooks
│   ├── splice/          # (input, operation, expected-output) triples
│   ├── lint/            # mixed folders: valid/invalid/malformed/no-frontmatter/modeline
│   └── schemas/         # JSON Schema documents used by fixtures
├── unit/                # per-module TDD tests (mirror src/lib structure)
├── integration/         # built CLI driven via child_process: JSON + exit codes only
└── helpers/             # corpus loader, diff assertions, temp-dir scaffolding
```

**Structure Decision**: Single project (Option 1 variant). The package boundary is the
repository; `src/lib` vs `src/cli` is the constitutionally load-bearing split (Principle VII):
`src/lib/index.ts` is the public API consumed by both external programs and `src/cli`. Tests
mirror that split — unit tests target library modules, integration tests target the CLI
contract exactly as an agent would use it.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*(empty — no violations)*
