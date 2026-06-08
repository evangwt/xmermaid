---
doc_type: issue-fix
issue: 2026-06-08-support-parser-falsification-drift
path: fast-track
fix_date: 2026-06-08
tags: [support, parser, diagnostics]
---

# Parser falsification support drift fix record

## 1. Problem

The support analyzer did not cover multiple lossy syntax cases that Rust parser falsification tests already documented.

## 2. Root Cause

The analyzer was being tightened incrementally by symptom. That left known parser evidence outside the production preflight contract.

## 3. Fix

- Add support matrix entries for:
  - `flowchart.expandedShape`
  - `flowchart.thickLineEdge`
  - `flowchart.extendedLineEdge`
  - `flowchart.extendedThickEdge`
  - `flowchart.inlineClass`
  - `flowchart.linkStyle`
- Detect those patterns as error-severity unsupported syntax.
- Update README, architecture, and production roadmap support contract wording.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `README.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because the new falsification cases produced no features.
- GREEN: `npm test -- tests/support-matrix.test.ts` passed with 10 tests.

## 6. Remaining Items

Entity-code and Font Awesome labels are still parser limitations but currently degrade into literal text rather than structural wrong-graph output. Treat them separately if the product contract decides literal rendering is unacceptable.
