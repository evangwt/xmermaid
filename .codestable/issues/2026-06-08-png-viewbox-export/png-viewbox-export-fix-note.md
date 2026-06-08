---
doc_type: issue-fix
issue: 2026-06-08-png-viewbox-export
path: fast-track
fix_date: 2026-06-08
tags: [production, live-editor, export, png]
---

# PNG ViewBox Export 修复记录

## 1. 问题描述

PNG export could collapse valid viewBox-only SVGs to a 1x1 canvas when image natural dimensions were not available.

## 2. 根因

`exportPng()` resolved canvas dimensions with `image.naturalWidth || Number(svg.getAttribute('width')) || 1` and the matching height expression. It never considered `viewBox`, even though `viewBox` is a normal SVG sizing source and the public helper accepts arbitrary `SVGSVGElement` input.

## 3. 修复方案

- Add private PNG dimension resolution in `src/editor/share.ts`.
- Preserve priority for decoded natural image size.
- Fall back to numeric SVG `width` / `height` attributes.
- Fall back to `viewBox` width / height.
- Keep the final 1px minimum for truly dimensionless or invalid SVGs.

## 4. 改动文件清单

- `src/editor/share.ts`
- `tests/live-editor.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/live-editor.test.ts` failed because viewBox-only PNG export used `{ width: 1, height: 1 }` instead of `{ width: 640, height: 360 }`.
- Targeted verification after implementation:
  - `npm test -- tests/live-editor.test.ts` passed.
  - `npm run typecheck` passed.
  - `git diff --check -- HEAD` passed.
- Full verification:
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. This does not add a new PNG API; it makes the existing PNG export respect the existing SVG sizing contract.
