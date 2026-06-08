---
doc_type: issue-fix
issue: 2026-06-08-live-editor-workflow-smoke
path: fast-track
fix_date: 2026-06-08
tags: [release, browser, live-editor, workflow]
---

# Live editor workflow smoke fix record

## 1. Problem

The packed consumer smoke mounted `XMermaidLiveEditor`, but did not prove the browser workflow behind the roadmap actually worked from the installed package.

## 2. Root Cause

The release gate was checking component existence instead of user-path behavior. It stopped at "preview SVG exists" and never interacted with the diagram list, visual editor, share button, or SVG export path.

## 3. Fix

- Extend `scripts/consumer-smoke.cjs` so the generated browser smoke page:
  - loads a two-diagram live editor document
  - switches to the second diagram
  - renames `Second` to `Renamed` through the visual editor
  - verifies selected source, full document, and preview update
  - verifies the share hash is namespaced with `#xm=`
  - verifies SVG export dispatches and prepares a download link
- Add a `live-editor-workflow` JSON check to the consumer smoke output.
- Add a README docs-sync requirement so release docs must keep describing the workflow smoke.
- Update architecture, release checklist, and production-readiness roadmap wording to match the stronger gate.

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

- RED: `npm test -- tests/consumer-smoke.test.ts` failed because the generated smoke page did not contain the live editor workflow assertions.
- GREEN: `npm test -- tests/consumer-smoke.test.ts tests/verify-release.test.ts` passed with 11 tests.
- Browser: `npm run --silent smoke:consumer -- --json` passed and reported `live-editor-workflow`.
- Docs: `node scripts/verify-release.cjs --check-docs --json` passed.

## 6. Remaining Items

The browser smoke still verifies DOM state and export readiness, not screenshot pixels. That is acceptable for the release gate, but a visual regression harness would be a separate roadmap item if the project starts promising rendered layout fidelity.
