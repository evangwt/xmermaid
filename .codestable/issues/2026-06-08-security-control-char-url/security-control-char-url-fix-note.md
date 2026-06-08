---
doc_type: issue-fix
issue: 2026-06-08-security-control-char-url
path: fast-track
fix_date: 2026-06-08
tags: [production, security, url-policy]
---

# Security Control Character URL 修复记录

## 1. 问题描述

Security URL preflight missed dangerous protocols split by ASCII control whitespace inside the scheme.

## 2. 根因

`unsafeUrls()` only matched contiguous protocol characters before `:`. Browsers normalize tab/newline/carriage-return out of URL schemes, but the scanner did not normalize the protocol candidate before checking `javascript:`, `data:`, or `vbscript:`.

## 3. 修复方案

- Allow tab/newline/carriage-return in protocol candidates during source scanning.
- Normalize protocol candidates by removing those control characters before lowercasing.
- Keep ranges anchored to the original source token.
- Add a render-level regression for `java\tscript:`.

## 4. 改动文件清单

- `src/security.ts`
- `tests/xmermaid.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/xmermaid.test.ts` failed because render resolved and emitted no `security_blocked_url`.
- Targeted verification after implementation:
  - `npm test -- tests/xmermaid.test.ts` passed.
  - `npm run typecheck` passed.
  - `git diff --check -- HEAD` passed.
- Full verification:
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. URL detection remains source-level preflight and still does not claim full browser URL parsing or sanitization.
