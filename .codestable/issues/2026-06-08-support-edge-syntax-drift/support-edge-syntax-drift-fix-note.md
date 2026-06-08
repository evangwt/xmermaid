---
doc_type: issue-fix
issue: 2026-06-08-support-edge-syntax-drift
path: fast-track
fix_date: 2026-06-08
tags: [support, parser, diagnostics]
---

# Edge syntax support drift fix record

## 1. Problem

`detectUnsupportedFeatures()` did not surface edge syntax that the Rust parser already documents as unsupported or lossy.

## 2. Root Cause

The support analyzer only scanned a small set of flowchart syntax boundaries. It covered class/style/click/HTML/Markdown, invalid directions, and recently shape syntax, but it had no rules for edge syntax falsification cases from Rust parser coverage.

## 3. Fix

- Add support matrix entries for:
  - `flowchart.bidirectionalEdge`
  - `flowchart.circleEdge`
  - `flowchart.crossEdge`
  - `flowchart.inlineEdgeLabel`
  - `flowchart.edgeId`
- Detect those source patterns as error-severity unsupported features.
- Keep pipe-delimited edge labels supported; the new rule only targets inline `-- label -->` syntax.
- Update README, architecture, and production roadmap support contract wording.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `README.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because unsupported edge syntax produced no features.
- GREEN: `npm test -- tests/support-matrix.test.ts` passed.
- Regression: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts tests/live-editor.test.ts tests/visual-roundtrip.test.ts` passed with 103 tests.
- Typecheck: `npm run typecheck` passed.
- Docs sync: `node scripts/verify-release.cjs --check-docs --json` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

The analyzer remains a lightweight contract scanner. Additional parser falsification cases should only be added when there is concrete Rust-side evidence of lossy behavior or production support drift.
