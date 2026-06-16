# Quickstart: Validating Schema-Governed Frontmatter Management

**Date**: 2026-06-11 | **Plan**: [plan.md](./plan.md)

Runnable scenarios proving the feature end-to-end. Each maps to spec success criteria /
acceptance scenarios. Contracts: [library-api.md](./contracts/library-api.md),
[cli-interface.md](./contracts/cli-interface.md).

## Prerequisites & setup

```sh
task setup            # pre-commit hooks + npm install
npm run build         # tsc → dist/
npm test              # full suite green (TDD — exists before implementation completes)
```

Create a playground:

```sh
mkdir -p /tmp/fmctl-demo && cd /tmp/fmctl-demo

cat > schema.json <<'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["status", "type"],
  "properties": {
    "status": { "enum": ["draft", "review", "done"] },
    "type":   { "enum": ["task", "decision"] },
    "links":  { "type": "array", "items": { "type": "string" } }
  }
}
EOF

cat > task.md <<'EOF'
---
# task metadata — comment must survive
status: draft # inline comment
type: task
links: [./other.md]
---

# Body must stay byte-identical
EOF
```

## Scenario 1 — read a field, or the whole frontmatter (US3)

```sh
fmctl get task.md status               # → draft           (exit 0)
fmctl get task.md status --json        # → {"file":...,"field":"status","value":"draft"}
fmctl get task.md missing; echo $?     # → error, exit 3

# whole-frontmatter read (omit the field):
fmctl get task.md                      # → one `field: value` line per entry
fmctl get task.md --json               # → {"file":...,"frontmatter":{"status":"draft",...}}
```

## Scenario 2 — validated surgical edit (US1, SC-001/SC-002)

```sh
cp task.md before.md
fmctl set task.md status=review --schema schema.json    # exit 0
diff before.md task.md                 # exactly one changed line: the status line,
                                       # inline comment intact
```

## Scenario 3 — invalid write refused, file untouched (US1, SC-002)

```sh
cp task.md before.md
fmctl set task.md status=bogus --schema schema.json --json; echo $?
# exit 1; stderr JSON error with violations[]: field "status", value "bogus",
# expected "one of: draft, review, done"
cmp before.md task.md                  # byte-identical — nothing was written
```

## Scenario 4 — bypass is narrow (US1 sc6)

```sh
fmctl set task.md status=bogus --schema schema.json --no-validate   # exit 0, written
fmctl set task.md status=review --schema schema.json                # repair, exit 0
```

## Scenario 5 — field creation & list replace (US1 sc3/sc4)

```sh
fmctl set task.md priority=high 'links=[./other.md, ./new.md]' --schema schema.json
# exit 0: priority appended as new last frontmatter line; links replaced wholesale;
# all other bytes identical
```

## Scenario 6 — unvalidated write notice (FR-013)

```sh
fmctl set task.md status=done          # no schema resolves →
# stderr: notice: unvalidated write (no schema resolved for task.md); exit 0
```

## Scenario 7 — lint a tree (US2, SC-003)

```sh
mkdir docs && cp task.md docs/ok.md
printf -- '---\nstatus: bogus\ntype: task\n---\nx\n' > docs/bad.md
printf -- '# plain doc, no frontmatter\n' > docs/README.md
printf -- '---\nstatus: [unclosed\n---\nx\n' > docs/broken.md
printf -- 'ignored.md\n' > docs/.gitignore
printf -- '---\nstatus: bogus\ntype: task\n---\nx\n' > docs/ignored.md

fmctl lint docs --schema schema.json; echo $?
# ✗ docs/bad.md (violation), ✗ docs/broken.md (malformed), - docs/README.md (skipped),
# ✓ ok.md counted; docs/ignored.md absent (gitignored, FR-011); summary line; exit 1
fmctl lint docs --schema schema.json --json   # full LintResult JSON
```

## Scenario 8 — modeline governance, external-standard file (US4, SC-006)

```sh
cat > standalone.md <<'EOF'
---
# fmctl: $schema=./schema.json
status: draft
type: task
---
body
EOF
fmctl lint standalone.md   # governed via modeline — result shows authority "document"
fmctl set standalone.md status=bogus; echo $?   # exit 1 — modeline schema enforced, no flag
fmctl set standalone.md status=review           # exit 0; modeline comment survives the write

printf -- '---\n# fmctl: $schema=https://example.com/s.json\nstatus: draft\n---\nx\n' > uri.md
fmctl get uri.md status                          # reads fine
fmctl set uri.md status=review; echo $?          # exit 5 — URI reserved for future version
```

## Scenario 9 — verify-or-revert under induced failure (SC-005)

Covered by automated induced-failure tests (read-only target directory, simulated rename
failure): assert exit 6/7 and `cmp` original bytes. Manual spot-check:

```sh
chmod a-w . && fmctl set task.md status=done --schema schema.json; echo $?; chmod u+w .
# non-zero exit; task.md byte-identical
```

## Scenario 10 — agent round-trip (SC-004)

An agent (or a script standing in for one) completes: `get` → decide → `set --json` →
`lint --json`, consuming only JSON stdout/stderr and exit codes — no human-readable parsing.
This is automated as the flagship integration test.

## Scenario 11 — performance envelope (SC-007)

```sh
# generate 1000 governed files, then:
time fmctl lint bigdir --schema schema.json    # wall clock < 10s
```
