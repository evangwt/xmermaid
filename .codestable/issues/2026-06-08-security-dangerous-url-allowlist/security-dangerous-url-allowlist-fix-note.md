---
doc_type: issue-fix
issue: 2026-06-08-security-dangerous-url-allowlist
path: fast-track
fix_date: 2026-06-08
tags: [production, security, url-policy]
---

# Security Dangerous URL Allowlist 修复记录

## 1. 问题描述

Custom URL allowlists could permit dangerous protocols that the security policy contract says remain blocked.

## 2. 根因

`unsafeUrls()` returned early when the protocol was present in `policy.allowedUrlProtocols`. That allowed `javascript:`, `data:`, or `vbscript:` to be treated as safe if a caller put them in the allowlist.

## 3. 修复方案

- Evaluate dangerous protocols before the allowlist.
- Always emit `security_blocked_url` for dangerous protocols.
- Preserve allowlist behavior for non-dangerous URL protocols.
- Add a render-level regression proving `javascript:` is still blocked when a custom allowlist includes it.

## 4. 改动文件清单

- `src/security.ts`
- `tests/xmermaid.test.ts`

## 5. 验证结果

- Red test observed before implementation:
  - `npm test -- tests/xmermaid.test.ts` failed because render resolved instead of rejecting with `security_blocked_url`.
- Targeted verification after implementation:
  - `npm test -- tests/xmermaid.test.ts` passed.
  - `npm run typecheck` passed.
  - `git diff --check -- HEAD` passed.
- Full verification:
  - `npm run verify:release` passed.

## 6. 遗留事项

No remaining blocker for this issue. URL detection remains source-level preflight and still does not claim full Mermaid link grammar parsing.
