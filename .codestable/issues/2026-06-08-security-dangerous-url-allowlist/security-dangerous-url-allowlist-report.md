---
doc_type: issue-report
issue: 2026-06-08-security-dangerous-url-allowlist
status: confirmed
severity: P1
summary: Custom URL allowlists could permit dangerous protocols that the security contract says remain blocked.
tags: [production, security, url-policy]
---

# Security Dangerous URL Allowlist Issue Report

## 1. 问题现象

`security-policy-v1` promises that dangerous URL protocols such as `javascript:` and `data:` remain blocked, including in loose mode. The implementation let `securityPolicy.allowedUrlProtocols` allow those protocols, so a custom allowlist could bypass `security_blocked_url`.

## 2. 复现步骤

1. Render source containing `click A javascript:alert(1)`.
2. Use `securityLevel: 'loose'` so click itself is not the blocking diagnostic.
3. Pass `securityPolicy: { allowedUrlProtocols: ['javascript:', 'https:'] }`.
4. Observe that rendering succeeds with only unsupported syntax diagnostics instead of blocking on `security_blocked_url`.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：Dangerous URL protocols are blocked regardless of custom URL allowlist configuration.

**实际行为**：The URL detector checked the allowlist before checking whether the protocol was intrinsically dangerous.

## 4. 环境信息

- 涉及模块 / 功能：SDK security preflight, URL policy
- 相关文件 / 函数：`src/security.ts`, `unsafeUrls()`
- 运行环境：browser SDK render preflight
- 其他上下文：found while auditing the completed `security-policy-v1` roadmap item against design D3

## 5. 严重程度

**P1** — The security policy looked enforceable while a public option could punch a hole through the dangerous-protocol invariant.
