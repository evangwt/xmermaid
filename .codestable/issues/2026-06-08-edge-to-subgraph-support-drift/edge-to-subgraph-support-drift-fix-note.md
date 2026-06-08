---
doc_type: issue-fix
issue: 2026-06-08-edge-to-subgraph-support-drift
path: fast-track
fix_date: 2026-06-08
tags: [support, diagnostics, parser, subgraph]
---

# Edge-to-subgraph support drift fix record

## 1. Problem

Edges to subgraph ids were known unsupported compound-edge syntax, but the public support analyzer did not report them.

## 2. Root Cause

Subgraph support was documented as partial, but the analyzer only looked for unsupported statements and edge operators. It did not cross-check edge endpoints against declared subgraph ids.

## 3. Fix

- Add `flowchart.edgeToSubgraph` to the support matrix.
- Collect declared subgraph ids during support analysis.
- Detect supported-looking edges whose source or target endpoint is a declared subgraph id.
- Return error-severity unsupported syntax diagnostics to block wrong-graph render.
- Update README, docs-sync, architecture, requirements, roadmap, and release checklist wording.

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

- RED: `npm test -- tests/support-matrix.test.ts` failed because edge-to-subgraph syntax produced no unsupported features.
- RED: `npm test -- tests/verify-release.test.ts` failed because docs sync did not require subgraph edge limitation docs.
- GREEN: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts tests/live-editor.test.ts tests/verify-release.test.ts` passed.
- Release: `npm run verify:release` passed.

## 6. Remaining Items

This does not implement Mermaid compound edge layout to subgraph boundaries. That is a layout/parser feature and should be planned separately if needed.
