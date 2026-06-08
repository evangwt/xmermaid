---
doc_type: issue-fix
issue: 2026-06-08-live-editor-browser-smoke
path: fast-track
fix_date: 2026-06-08
tags: [release, browser, live-editor]
---

# Live editor packed browser smoke fix record

## 1. Problem

The release smoke tested direct SDK rendering but not `XMermaidLiveEditor.mount()` in an installed package browser path.

## 2. Root Cause

`scripts/consumer-smoke.cjs` generated a smoke page that imported only `XMermaid`, rendered a minimal flowchart, and reported `browser-render`. The script did not import `XMermaidLiveEditor`, mount it, or include any live editor preview evidence in the JSON checks.

## 3. Fix

- Extend the browser smoke page to import `XMermaidLiveEditor`.
- Mount a live editor with a minimal flowchart source and explicit WASM URL.
- Require the smoke result to include a preview SVG from `[data-xm-preview]`.
- Add a `live-editor-render` check to the packed consumer smoke JSON.
- Update release docs and production roadmap notes to include the live editor browser smoke.

## 4. Changed Files

- `scripts/consumer-smoke.cjs`
- `tests/consumer-smoke.test.ts`
- `README.md`
- `docs/production-release-checklist.md`
- `.codestable/roadmap/production-readiness/production-readiness-items.yaml`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/consumer-smoke.test.ts` failed because `writeBrowserSmokePage` did not expose the expected live editor smoke evidence.
- GREEN: `npm test -- tests/consumer-smoke.test.ts` passed.
- Packed smoke: `npm run --silent smoke:consumer -- --json` passed and included `live-editor-render` with 1 preview SVG.
- YAML: `python3 .codestable/tools/validate-yaml.py --file .codestable/roadmap/production-readiness/production-readiness-items.yaml` passed.
- Typecheck: `npm run typecheck` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

This verifies live editor mount and preview rendering in Chrome. It is not a full interactive visual editor E2E suite.
