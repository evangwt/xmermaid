---
doc_type: issue-fix
issue: 2026-06-08-special-label-support-drift
path: fast-track
fix_date: 2026-06-08
tags: [support, diagnostics, parser]
---

# Special label support drift fix record

## 1. Problem

Entity-code labels and FontAwesome labels were known Rust parser falsification cases, but the public support contract did not report them.

## 2. Root Cause

The analyzer had been tightened around syntax that caused structural wrong-graph output first. Literal label degradation was left outside the matrix, which made the public contract less complete than the parser evidence.

## 3. Fix

- Add `flowchart.entityCodeLabel` and `flowchart.fontAwesomeLabel` to the support matrix.
- Detect bracketed label content containing Mermaid-style entity codes or FontAwesome icon markers.
- Return warning-severity unsupported syntax diagnostics so rendering can continue honestly.
- Add README docs-sync coverage for special label limitations.
- Update architecture, requirements, roadmap, and release checklist wording.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `scripts/verify-release.cjs`
- `tests/verify-release.test.ts`
- `README.md`
- `docs/production-release-checklist.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/requirements/production-support-contract.md`
- `.codestable/roadmap/production-readiness/production-readiness-items.yaml`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because special label syntax produced no unsupported features.
- RED: `npm test -- tests/verify-release.test.ts` failed because docs sync did not require special label limitation docs.
- GREEN: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts tests/live-editor.test.ts tests/verify-release.test.ts` passed.
- Release: `npm run verify:release` passed.

## 6. Remaining Items

This does not implement HTML entity decoding or FontAwesome icon rendering. Those would be new rendering capabilities and need a separate roadmap if desired.
