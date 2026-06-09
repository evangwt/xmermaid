---
doc_type: issue-fix
issue: 2026-06-09-visual-label-roundtrip-drift
path: fast-track
fix_date: 2026-06-09
tags: [production, live-editor, visual-edit, roundtrip]
---

# Visual Label Roundtrip Drift 修复记录

## 1. 问题描述

Visual edit validation could accept serialized Mermaid source after real parsing changed the intended node label semantics.

## 2. 根因

`validateVisualEditResult()` treated parse success and render/layout success as sufficient proof. It never compared the parsed `FlowchartGraphModel` with the post-edit model that the live editor intended to commit.

## 3. 修复方案

- Add an optional `expectedModel` argument to `validateVisualEditResult()`.
- After parse succeeds, convert the parsed AST back to `FlowchartGraphModel` and compare semantic fields against `expectedModel`.
- Ignore generated edge ids during comparison because they are derived from parse order and are not Mermaid semantics.
- Return `visual_roundtrip_failed` and keep the original source when parsed semantics drift.
- Pass `nextModel` from `XMermaidLiveEditor.applyVisualEditNow()` into validation before committing source.
- Keep serializer behavior narrow; do not claim delimiter escaping support that the current parser cannot prove.

## 4. 改动文件清单

- `src/editor/flowchart.ts`
- `src/editor/index.ts`
- `tests/visual-roundtrip.test.ts`
- `tests/live-editor.test.ts`
- `.codestable/architecture/ARCHITECTURE.md`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/visual-roundtrip.test.ts tests/live-editor.test.ts` failed because validation returned `applied` and the live editor committed `A(Bad))`.
- Targeted verification after implementation:
  - `npm test -- tests/visual-roundtrip.test.ts tests/live-editor.test.ts` passed.
- Related CodeStable/docs verification:
  - `npm test -- tests/codestable-docs.test.ts tests/visual-roundtrip.test.ts tests/live-editor.test.ts` passed.
  - `npm run typecheck` passed.
- Full release verification:
  - `npm run verify:release` passed, including build, packed consumer smoke, docs sync, full JS tests, TypeScript, Rust tests, and diff whitespace.
- Built artifact spot check:
  - A Node script importing `./dist/xmermaid.esm.js` reproduced `A(Bad))` parsing back as `Bad`, and `validateVisualEditResult(..., expectedModel)` returned `blocked` with `visual_roundtrip_failed`.

## 6. 遗留事项

No blocker remains for this issue. Delimiter-containing labels that cannot be proven roundtrippable are intentionally blocked instead of being silently rewritten.
