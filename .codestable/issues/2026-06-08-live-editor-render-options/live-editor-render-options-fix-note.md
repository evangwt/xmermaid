---
doc_type: issue-fix
issue: 2026-06-08-live-editor-render-options
path: fast-track
fix_date: 2026-06-08
tags: [production, live-editor, wasm, sdk]
---

# Live Editor Render Options 修复记录

## 1. 问题描述

The live editor accepted `xmermaidOptions`, but its default render path only used constructor-level options. Render-time SDK options were lost.

## 2. 根因

The live editor typed `xmermaidOptions` as `Omit<XMermaidOptions, 'container'>`, which excluded `RenderOptions`. `defaultRenderDiagram()` then called `renderer.renderToSVGElement(source)` without forwarding any render options.

## 3. 修复方案

- Type `xmermaidOptions` as constructor options plus existing SDK `RenderOptions`.
- Keep constructor behavior for theme/layout/container.
- Add `currentRenderOptions()` to forward `securityLevel`, `securityPolicy`, and `wasm` into `renderToSVGElement()`.
- Add a live editor test proving the default render path passes `wasm.wasmUrl` and `securityLevel`.

## 4. 改动文件清单

- `src/editor/index.ts`
- `tests/live-editor.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/live-editor.test.ts` failed because `renderToSVGElement()` was called without render options.
- Targeted verification after implementation:
  - `npm test -- tests/live-editor.test.ts` passed.
  - `npm run typecheck` passed.
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. The fix reuses the existing SDK `RenderOptions` contract and does not create a live-editor-specific configuration layer.
