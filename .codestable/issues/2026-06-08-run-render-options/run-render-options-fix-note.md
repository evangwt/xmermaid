---
doc_type: issue-fix
issue: 2026-06-08-run-render-options
path: fast-track
fix_date: 2026-06-08
tags: [production, sdk, wasm, security]
---

# XMermaid.run Render Options 修复记录

## 1. 问题描述

`XMermaid.run()` dropped render-time SDK options while scanning and rendering `.mermaid` DOM elements.

## 2. 根因

The helper accepted `XMermaidOptions` and delegated to `xm.render(dsl)`, whose compatibility signature does not accept `RenderOptions`.

## 3. 修复方案

- Type `XMermaid.run()` as constructor options plus existing `RenderOptions`.
- Extract render options from the supplied object.
- Use `renderToSVGElement(dsl, renderOptions)` inside the helper and append the SVG to preserve DOM replacement behavior.
- Add a test proving `wasm.wasmUrl` and `securityLevel` reach the render call.

## 4. 改动文件清单

- `src/xmermaid.ts`
- `tests/xmermaid.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/xmermaid.test.ts` failed because `renderToSVGElement()` was called without render options.
- Targeted verification after implementation:
  - `npm test -- tests/xmermaid.test.ts` passed.
  - `npm run typecheck` passed.
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. The fix keeps `render()` as the compatibility path and only changes the helper to use the existing render API internally.
