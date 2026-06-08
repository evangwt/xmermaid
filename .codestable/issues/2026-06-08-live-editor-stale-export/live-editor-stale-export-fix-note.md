---
doc_type: issue-fix
issue: 2026-06-08-live-editor-stale-export
path: fast-track
fix_date: 2026-06-08
tags: [production, live-editor, export, diagnostics]
---

# Live Editor Stale Export 修复记录

## 1. 问题描述

The live editor could export a retained stale preview after the current selected source failed to render.

## 2. 根因

`exportCurrentDiagram()` only checked whether `[data-xm-preview]` contained an SVG. It did not know whether that SVG came from the latest successful render for the current selected diagram and source.

## 3. 修复方案

- Track the exportable preview as `{ diagramId, source, requestId }` only after a successful render commit.
- Invalidate exportability when a new render starts, when no diagram is selected, or when the current render fails.
- Hide and clear the download link when the preview is invalidated.
- Before exporting, require the retained SVG to match the selected diagram, selected source, and latest render request.
- Show a diagnostic instead of exporting when the current diagram has not rendered successfully.

## 4. 改动文件清单

- `src/editor/index.ts`
- `tests/live-editor.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/live-editor.test.ts` failed because `xmermaid:exported` still fired after a render failure.
- Targeted verification after implementation:
  - `npm test -- tests/live-editor.test.ts` passed.
  - `npm run typecheck` passed.
  - `git diff --check -- HEAD` passed.
- Full verification:
  - First `npm run verify:release` attempt failed in `consumer-pack-install` after typecheck/node import and before browser-render summary.
  - Immediate isolated rerun `npm run smoke:consumer -- --json --keep-temp --timeout-ms 30000` passed, including headless Chrome browser render.
  - Final `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. The fix keeps the existing stale-preview display behavior and only tightens export eligibility.
