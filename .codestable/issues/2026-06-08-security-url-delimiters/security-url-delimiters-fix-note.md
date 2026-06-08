---
doc_type: issue-fix
issue: 2026-06-08-security-url-delimiters
path: fast-track
fix_date: 2026-06-08
tags: [production, security, url-policy]
---

# Security URL Delimiters 修复记录

## 1. 问题描述

Security URL preflight missed dangerous protocols inside Mermaid label delimiters.

## 2. 根因

`unsafeUrls()` only considered start-of-line, whitespace, quotes, `(`, and `<` as protocol token boundaries. Mermaid labels commonly introduce text with `[`, so `A[javascript:...]` never matched the protocol scanner.

## 3. 修复方案

- Extend the source-level protocol scanner's boundary set to include Mermaid label/edge delimiters.
- Stop URL token capture at matching closing Mermaid/HTML delimiters.
- Add a render-level regression for `A[javascript:alert(1)]`.

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

No remaining blocker for this issue. URL detection remains source-level preflight and still does not claim full Mermaid link grammar parsing.
