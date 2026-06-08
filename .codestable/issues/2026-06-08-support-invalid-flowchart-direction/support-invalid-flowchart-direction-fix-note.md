---
doc_type: issue-fix
issue: 2026-06-08-support-invalid-flowchart-direction
path: fast-track
fix_date: 2026-06-08
tags: [support, diagnostics, parser]
---

# Invalid flowchart direction support analyzer fix record

## 1. Problem

`analyzeSupport()` did not surface invalid flowchart directions even though the parser rejects them.

## 2. Root Cause

`detectDiagramType()` classified any first line starting with `graph` or `flowchart` as flowchart, and `detectUnsupportedFeatures()` only scanned body-level unsupported syntax such as `classDef`, `style`, `click`, HTML labels, and Markdown labels. It did not validate the declaration direction against the parser's accepted `TD`, `TB`, `BT`, `LR`, and `RL` set.

## 3. Fix

- Add `flowchart.invalidDirection` to the support contract.
- Add it to the flowchart unsupported syntax matrix.
- Detect invalid `graph` / `flowchart` declarations on the source line and return an error-severity unsupported feature with line/column range.
- Document the unsupported direction boundary in README and the production roadmap contract.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `README.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because `unsupportedFeatures` was empty for `graph XXX`.
- GREEN: `npm test -- tests/support-matrix.test.ts` passed.
- Typecheck: `npm run typecheck` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

The analyzer remains a lightweight support scanner, not a full parser. It now covers the parser's core flowchart declaration direction boundary without adding a parallel parsing subsystem.
