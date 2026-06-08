---
doc_type: issue-fix
issue: 2026-06-08-hyphenated-node-id-support-drift
path: fast-track
fix_date: 2026-06-08
tags: [support, diagnostics, parser]
---

# Hyphenated node id support drift fix record

## 1. Problem

Hyphenated node ids were known parser falsification cases, but the support analyzer did not expose them.

## 2. Root Cause

The analyzer recognized unsupported edge forms and edge ids, but not the parser's node-id tokenization boundary where `my-node` is split instead of preserved.

## 3. Fix

- Add `flowchart.hyphenatedNodeId` to the support matrix.
- Detect hyphenated ids in supported-looking edge endpoints.
- Avoid classifying extended line edge syntax such as `D----E` as a hyphenated id case.
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

- RED: `npm test -- tests/support-matrix.test.ts` failed because hyphenated node ids produced no unsupported feature.
- RED: `npm test -- tests/verify-release.test.ts` failed because docs sync did not require hyphenated node id limitation docs.
- GREEN: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts tests/live-editor.test.ts tests/verify-release.test.ts` passed.
- Docs: `node scripts/verify-release.cjs --check-docs --json` passed.
- Release: `npm run verify:release` passed.

## 6. Remaining Items

This does not implement hyphenated node id parsing. That would be parser grammar work and needs its own roadmap if required.
