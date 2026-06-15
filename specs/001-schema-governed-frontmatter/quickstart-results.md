# Quickstart & Dogfood Results — Schema-Governed Frontmatter (001)

**Date**: 2026-06-12 | **Build**: `npm run build` green | **Suite**: full vitest run green

This records the manual validation gate (quickstart scenarios) and the SC-003
dogfood (a seeded-violation corpus standing in for a real Markdown-state project).

## SC-003 — lint flags every seeded violation, zero false positives

A corpus of 25 files was generated: 6 valid, plus seeded violations across every
class. `fmctl lint . --schema task.json` was run once.

| Metric | Value |
|--------|-------|
| Seeded problems flagged | 23 (≥ 20 required) |
| — schema violations (enum/required/type) | 19 |
| — structural errors (malformed/duplicate-key/non-string-key) | 4 |
| Valid files mis-flagged (false positives) | 0 |
| Exit code | 1 |
| Summary | `{"checked": 21, "valid": 6, "invalid": 15, "ungoverned": 0, "skipped": 0, "errored": 4}` |

Result: **23 seeded problems, all flagged; 0 false positives.** SC-003 met.

### Violation classes exercised

- **enum** — disallowed `status` / `type` values
- **required** — missing `status` and/or `type`
- **type** — `links` given a non-array value
- **malformed frontmatter** — unclosed flow sequence, broken mapping (ParseError)
- **duplicate key** — repeated `status` (DuplicateKeyError)
- **non-string key** — numeric top-level key (NotRepresentableError)

### Lint output (human)

```text
✗ enum1.md  status: bogus — expected one of: draft, review, done
✗ enum2.md  type: wrong — expected one of: task, decision
✗ enum3.md  status: xxx — expected one of: draft, review, done
✗ enum3.md  type: yyy — expected one of: task, decision
✗ enum4.md  status: pending — expected one of: draft, review, done
✗ enum5.md  type: epic — expected one of: task, decision
✗ enum6.md  status: foo — expected one of: draft, review, done
✗ enum6.md  type: bar — expected one of: task, decision
✗ enum7.md  status: nope — expected one of: draft, review, done
✗ err-broken.md  malformed frontmatter: Nested mappings are not allowed in compact mappings at line 1, column 9:

status: draft
        ^

✗ err-dupkey.md  duplicate key in frontmatter of /tmp/tmp.Ki9PaXoxSz/err-dupkey.md
✗ err-malformed.md  malformed frontmatter: Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:

status: [unclosed

^

✗ err-numkey.md  frontmatter has a non-string key in /tmp/tmp.Ki9PaXoxSz/err-numkey.md
✗ req1.md  status: (absent) — expected required property "status"
✗ req2.md  type: (absent) — expected required property "type"
✗ req3.md  status: (absent) — expected required property "status"
✗ req3.md  type: (absent) — expected required property "type"
✗ req4.md  status: (absent) — expected required property "status"
✗ req5.md  status: (absent) — expected required property "status"
✗ req5.md  type: (absent) — expected required property "type"
✗ type1.md  links: nope — expected array
✗ type2.md  links: 42 — expected array
✗ type3.md  links: { a: b } — expected array
21 checked, 6 valid, 15 invalid, 4 errored, 0 ungoverned, 0 skipped
```

## Quickstart scenarios (manual, against the built binary)

| # | Scenario | Result |
|---|----------|--------|
| 1 | read a field (get) | ✓ scalar/list/JSON; missing field exits 3 |
| 2 | validated surgical edit | ✓ one-line diff, inline comment preserved |
| 3 | invalid write refused, file untouched | ✓ exit 1, byte-identical (cmp) |
| 4 | bypass is narrow | ✓ `--no-validate` writes, re-validate repairs |
| 5 | field creation & list replace | ✓ appended last, list replaced wholesale |
| 6 | unvalidated write notice | ✓ stderr notice, exit 0 |
| 7 | lint a tree | ✓ classified, gitignored file absent, exit 1 |
| 8 | modeline governance, external-standard | ✓ authority "document", modeline survives, no data field added |
| 9 | verify-or-revert under induced failure | ✓ exit 6/7, original byte-identical (writer unit + CLI exit-7 integration) |
| 10 | agent round-trip (JSON only) | ✓ get→set→lint on first attempt (integration) |
| 11 | performance envelope | ✓ 1,000 files linted in well under 10 s (RUN_SLOW) |

All scenarios pass. The verify-or-revert and agent-round-trip scenarios are also
covered by automated tests (writer unit suite, cli exit-7, agent-roundtrip).
