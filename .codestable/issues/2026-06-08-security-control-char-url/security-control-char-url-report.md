---
doc_type: issue-report
issue: 2026-06-08-security-control-char-url
status: fixed
severity: P1
summary: Security URL preflight missed dangerous protocols split by ASCII control whitespace.
tags: [production, security, url-policy]
---

# Security Control Character URL Issue Report

## 1. 问题现象

The URL preflight missed `javascript:` when ASCII control whitespace appeared inside the scheme, for example `java\tscript:alert(1)`. Browser URL parsing normalizes tab/newline/carriage-return inside the scheme to `javascript:`, so the source-level security check was weaker than the runtime URL model.

## 2. 复现步骤

1. Render `graph TD\n  A[java\tscript:alert(1)] --> B`.
2. Use `securityLevel: 'loose'` so click/HTML blocking does not mask the URL check.
3. Observe rendering succeeds and no `security_blocked_url` diagnostic is emitted.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：Dangerous URL protocols split by tab/newline/carriage-return are normalized and blocked before render.

**实际行为**：The scanner only matched contiguous protocol text and missed control-character-split schemes.

## 4. 环境信息

- 涉及模块 / 功能：SDK security preflight, URL protocol scanner
- 相关文件 / 函数：`src/security.ts`, `unsafeUrls()`
- 运行环境：browser SDK render preflight
- 其他上下文：Node URL parser evidence: `new URL('java\\tscript:alert(1)', base).protocol === 'javascript:'`

## 5. 严重程度

**P1** — A trivial control character made the source-level security policy weaker than browser URL normalization.
