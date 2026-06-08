---
doc_type: issue-fix
issue: 2026-06-08-visual-unsupported-shapes
path: fast-track
fix_date: 2026-06-08
tags: [editor, visual-edit, support, wasm]
---

# Visual unsupported shapes fix record

## 1. Problem

Visual validation accepted stadium and cylinder/database shape syntax even though the Rust parser currently misparses those constructs.

## 2. Root Cause

The support analyzer safety gate covered `classDef`, `style`, `click`, HTML labels, Markdown labels, and invalid directions, but it did not cover Rust parser falsification cases for `A([Stadium])` and `A[(Database)]`. Because validation only checked parse/render success, a lossy parse still counted as `applied`.

## 3. Fix

- Add `flowchart.stadiumShape` and `flowchart.cylinderShape` to `UnsupportedFeatureId`.
- Add both entries to the flowchart unsupported syntax matrix.
- Detect both syntaxes as error-severity unsupported features.
- Let existing visual safety gate convert those support features into `visual_unsupported_syntax` blockers.
- Update README, architecture, and roadmap wording so the public support contract matches runtime behavior.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `tests/visual-roundtrip.test.ts`
- `README.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`
- `.codestable/roadmap/multi-diagram-live-editor/multi-diagram-live-editor-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because stadium/cylinder shape syntax produced no unsupported features.
- RED: `npm test -- tests/visual-roundtrip.test.ts` failed because validation returned `status: 'applied'` for `A([Start])`.
- GREEN: `npm test -- tests/support-matrix.test.ts tests/visual-roundtrip.test.ts` passed.
- Regression: `npm test -- tests/support-matrix.test.ts tests/visual-roundtrip.test.ts tests/xmermaid.test.ts tests/live-editor.test.ts` passed with 102 tests.
- Typecheck: `npm run typecheck` passed.
- Docs sync: `node scripts/verify-release.cjs --check-docs --json` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

Other Rust parser falsification cases still deserve the same treatment, especially edge syntaxes that can misparse into wrong nodes or wrong edge styles. This fix only closes stadium and cylinder/database shape loss because those are directly reachable from the visual serializer contract.
