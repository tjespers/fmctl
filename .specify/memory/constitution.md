<!--
Sync Impact Report
==================
Version change: (template) → 1.0.0 — initial ratification
Modified principles: all template placeholders replaced (initial adoption)
  - I. Byte-Level Conservatism (NON-NEGOTIABLE)
  - II. Verify-or-Revert Writes
  - III. Refuse Loudly
  - IV. Test-First, No Exceptions (NON-NEGOTIABLE)
  - V. Agent-First Ergonomics
  - VI. Boring Code, Lean Dependencies
  - VII. Library-First, Prove Before Grow
Added sections: Technical Constraints; Development Workflow
Removed sections: none
Templates:
  - .specify/templates/plan-template.md ✅ aligned — Constitution Check gate is generic and
    derives its gates from this file at plan time; no edit required
  - .specify/templates/spec-template.md ✅ aligned — no constitution-driven changes required
  - .specify/templates/tasks-template.md ✅ updated — tests were marked "OPTIONAL", which
    contradicted Principle IV; test tasks are now mandatory and test-first
  - CLAUDE.md ✅ no change needed — contains only the managed SPECKIT block, refreshed by the
    agent-context extension hooks
Follow-up TODOs: none
-->

# fmctl Constitution

fmctl (frontmatter-control) is a TypeScript library and CLI for managing YAML frontmatter
across a folder of inter-linked Markdown files. The CLI ships on day one; the same core will
later be consumed as a library inside a Node.js backend. Its primary users are one developer
and the AI agents working alongside him, dogfooding on a project whose entire state lives in
Markdown. The tool's product is trust in its edits; every principle below exists to protect
that trust.

## Core Principles

### I. Byte-Level Conservatism (NON-NEGOTIABLE)

A write MUST change only the bytes of the fields it was asked to change. Everything else in the
file — comments (block and inline), key order, quoting style, indentation, whitespace, blank
lines, and the entire Markdown body — MUST survive byte-for-byte.

- The Markdown body is never parsed; files are split at the frontmatter delimiters and the body
  is carried through untouched.
- The editing approach is parse-to-locate, splice-to-write: the YAML parser is used to find the
  exact byte range of a value; the new value is spliced into the original source text.
- Re-serializing a whole document (or any node the user did not ask to change) on a write path
  is prohibited, regardless of how convenient it would be.

**Rationale**: The project this tool serves keeps full-copy version history; any reformatting
turns a one-line change into an unreadable diff. A 2026-06-10 spike proved that even
careful in-place node mutation followed by document re-serialization normalizes untouched lines
(spacing collapsed, flow collections rewritten) — splicing is the only approach that meets this
guarantee, so this principle exists to protect it from future "convenience" regressions.

### II. Verify-or-Revert Writes

A mutation is not complete when the bytes are written; it is complete when fmctl has verified
its own output. Every write MUST be atomic (write to a temporary file, then rename). After
writing, fmctl MUST re-parse the result and confirm both that the parsed data matches the
intended change and that the textual diff against the original touches only the expected lines.
On any anomaly the original content MUST be restored and the command MUST exit non-zero. fmctl
MUST never leave a file in a state it did not verify.

**Rationale**: The tool edits files that are the system of record. A splice bug that silently
corrupts a file is the one failure mode that destroys the tool's reason to exist; runtime
self-verification makes that failure mode loud and recoverable.

### III. Refuse Loudly

When fmctl encounters a file whose frontmatter is malformed (broken YAML, missing or mangled
delimiters), it MUST refuse to operate on it: no best-effort reads, no writes, and no "repair"
beyond what was explicitly asked. Errors MUST name the file and the specific problem. Each
failure class MUST exist as a distinct, exported error type in the library, and the CLI MUST
map these 1:1 to distinct, documented exit codes. Identical inputs MUST produce identical
outcomes — no heuristic or environment-dependent behavior on the failure path.

**Rationale**: AI agents, not humans, hit these walls most often. An agent can recover cleanly
from a predictable hard wall; it cannot recover from silent salvage that returns plausible but
wrong data.

### IV. Test-First, No Exceptions (NON-NEGOTIABLE)

All production code follows red-green-refactor — the CLI surface included. Tests MUST be
written first and observed to fail before the implementation is written. The splice engine
additionally maintains a golden-file fixture corpus of hostile real-world frontmatter
(comments, inline comments, odd spacing, flow collections, quoting variations) with byte-level
diff assertions.

**Rationale**: Most of this codebase is AI-written. Tests are the executable specification and
the human's primary lever for trusting code he did not write line-by-line. The discipline is
deliberately chosen over weekend velocity; scope flexes before rigor does.

### V. Agent-First Ergonomics

Machine consumers are first-class users, not an afterthought. Every command MUST offer
machine-readable output (`--json`). Data goes to stdout; diagnostics go to stderr. Exit codes
are deterministic, documented, and form a stable contract. Error messages MUST be actionable by
an agent without a human interpreting them — they state what failed, on which file, and what a
valid retry looks like.

**Rationale**: Half the user base parses output rather than reads it. Ergonomics for agents is
ergonomics for the primary workflow.

### VI. Boring Code, Lean Dependencies

Prefer boring, auditable choices over clever ones — human review bandwidth is the scarcest
resource in an AI-written codebase. Every new runtime dependency MUST earn its place: it does
something material that the standard library or an existing dependency cannot, and it is
well-maintained and widely used. When in doubt, write the small thing instead of importing the
large thing.

### VII. Library-First, Prove Before Grow

fmctl is a library with a CLI as its first consumer — not a CLI with extractable internals. All
capability lives in the library's public API, and the CLI MUST consume the library exclusively
through that public API; imports of library internals from CLI code are prohibited. If the CLI
needs something the public API does not expose, the API is incomplete — extend the API, never
bypass it.

Features earn their way in through dogfooding: a capability layer is added only after the layer
below it is proven in real use. No speculative features, no APIs built for imagined future
needs.

**Rationale**: A second consumer already exists in planning — a Node.js backend that will import
fmctl as an npm package. Enforcing the library boundary from day one, with the CLI as reference
consumer, keeps the public API honest and complete before that consumer arrives.

## Technical Constraints

- **Language/runtime**: TypeScript on Node.js with `strict` mode enabled; MUST run on Linux and
  macOS.
- **Dual surface**: one package exposing both a library entry point and a CLI binary. The
  exported type declarations are part of the public API contract. The library reads and writes
  the filesystem, so it is a server-side (Node) dependency — browser compatibility is a
  non-goal.
- **YAML engine**: `yaml` (eemeli). Its role on write paths is locating nodes via source ranges
  and validating; whole-document serialization is reserved for read/derived output, never for
  writing a user's file (Principle I).
- **Scale envelope**: designed for hundreds to low thousands of Markdown files per project.
  Performance is secondary to correctness; optimization work requires a measured problem first.
- **Distribution**: local development usage for v0.x. No packaging, installers, or single-binary
  builds until the core has proven itself in dogfooding (Principle VII).

## Development Workflow

- **Process**: SpecKit with light ceremony — one-page specs, then plan, then tasks, then
  implementation. Heavy artifacts are produced only when they pay for themselves.
- **Commits**: every commit message follows the Conventional Commits specification, enforced by
  a commit-msg hook — the same wall for humans and agents.
- **Constitution gate**: every implementation plan passes the Constitution Check before research
  and design begin, and re-checks after design.
- **Spec compliance**: implementation is reviewed against its spec (functional requirement
  coverage) before merge.
- **Test gate**: TDD per Principle IV; the full test suite passes before merge.
- **Deviations**: any violation of a principle is recorded in the plan's Complexity Tracking
  table with a justification and the simpler alternative that was rejected — or the design is
  simplified until no violation remains.

## Governance

This constitution supersedes all other development practices in this repository. Amendments are
made by editing this file in a reviewed change that includes a version bump, the rationale, and
synchronization of all dependent templates and guidance documents.

Versioning follows semantic versioning: MAJOR for removing or redefining a principle in a
backward-incompatible way, MINOR for adding a principle or materially expanding guidance, PATCH
for clarifications and wording fixes.

Compliance is verified at two points: the Constitution Check gate in every plan, and review of
every implementation against its spec and these principles. Unjustified complexity is rejected,
not tolerated.

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
