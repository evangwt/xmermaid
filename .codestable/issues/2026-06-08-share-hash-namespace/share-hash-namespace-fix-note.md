---
doc_type: issue-fix
issue: 2026-06-08-share-hash-namespace
path: fast-track
fix_date: 2026-06-08
tags: [production, live-editor, share-state, url-hash]
---

# Share Hash Namespace 修复记录

## 1. 问题描述

Live editor share restore could consume non-xmermaid URL hashes when they happened to be encoded JSON with a `documentText` field.

## 2. 根因

`decodeShareState()` used `hash.startsWith('#xm=') ? hash.slice(4) : hash.replace(/^#/, '')`, which made the `#xm=` namespace optional. That contradicts `encodeShareState()`, which always emits `#xm=...`.

## 3. 修复方案

- Require `decodeShareState()` input to start with `#xm=`.
- Return `null` for un-prefixed hashes, even if their payload is valid JSON.
- Add helper-level and live-editor mount regressions proving unrelated hashes do not override `initialText`.

## 4. 改动文件清单

- `src/editor/share.ts`
- `tests/live-editor.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/live-editor.test.ts` failed because non-prefixed JSON was decoded and mounted as share state.
- Targeted verification after implementation:
  - `npm test -- tests/live-editor.test.ts` passed.
  - `npm run typecheck` passed.
  - `git diff --check -- HEAD` passed.
- Full verification:
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. The fix preserves the existing `#xm=` share format and only rejects unrelated hash payloads.
