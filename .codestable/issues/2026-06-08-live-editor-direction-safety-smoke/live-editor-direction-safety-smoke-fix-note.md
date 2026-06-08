---
doc_type: issue-fix
issue: 2026-06-08-live-editor-direction-safety-smoke
path: fast-track
fix_date: 2026-06-08
tags: [release, browser, live-editor, workflow]
---

# Live editor direction and safety smoke fix record

## 1. Problem

The packed consumer smoke did not drive the direction split or unsupported visual safety gate that the roadmap treats as core live editor behavior.

## 2. Root Cause

The browser smoke was expanded incrementally. It covered visual rename, share, and export first, but did not yet exercise the direction controls or visual fail-closed branch in the installed browser bundle.

## 3. Fix

- Extend `scripts/consumer-smoke.cjs` so real Chrome:
  - changes layout direction and verifies selected source is unchanged
  - clicks Apply direction and verifies source/document update
  - injects unsupported `classDef` syntax
  - attempts a visual rename and verifies `visual_unsupported_syntax` blocks rewrite
- Add static helper coverage for the new smoke page markers.
- Update README, docs sync, architecture, release checklist, and roadmap wording.

## 4. Changed Files

- `scripts/consumer-smoke.cjs`
- `tests/consumer-smoke.test.ts`
- `scripts/verify-release.cjs`
- `tests/verify-release.test.ts`
- `README.md`
- `docs/production-release-checklist.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/roadmap/production-readiness/production-readiness-items.yaml`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/consumer-smoke.test.ts` failed because the generated smoke page did not contain the direction/safety workflow markers.
- RED: `npm test -- tests/verify-release.test.ts` failed because docs sync did not require direction/safety smoke docs.
- GREEN: `npm test -- tests/consumer-smoke.test.ts` passed.
- Browser: `npm run --silent smoke:consumer -- --json` passed.
- GREEN: `npm test -- tests/consumer-smoke.test.ts tests/verify-release.test.ts` passed.
- GREEN: `node scripts/verify-release.cjs --check-docs --json` passed with no missing docs checks.
- GREEN: `npm test -- tests/consumer-smoke.test.ts tests/verify-release.test.ts tests/live-editor.test.ts` passed.
- GREEN: `npm run typecheck` passed.
- GREEN: `git diff --check -- HEAD` passed.
- GREEN: `npm run verify:release` passed, including wasm build, packed consumer smoke, docs sync, full npm test, typecheck, cargo test, and diff whitespace.

## 6. Remaining Items

This still verifies DOM workflow state rather than screenshot pixels. Pixel-level visual regression remains outside the current release gate.
