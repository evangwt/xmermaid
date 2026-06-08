---
doc_type: issue-report
issue: 2026-06-08-security-url-delimiters
status: confirmed
severity: P1
summary: Security URL preflight missed dangerous protocols inside Mermaid label delimiters.
tags: [production, security, url-policy]
---

# Security URL Delimiters Issue Report

## 1. 问题现象

The source-level URL detector blocked `javascript:` when it appeared after whitespace or quote-like separators, but missed the same protocol inside Mermaid label delimiters such as `A[javascript:alert(1)]`.

## 2. 复现步骤

1. Render `graph TD\n  A[javascript:alert(1)] --> B`.
2. Use the default strict security policy.
3. Observe rendering succeeds and no `security_blocked_url` diagnostic is emitted.

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：Dangerous URL protocols should be detected when they appear in common Mermaid label/link delimiter contexts.

**实际行为**：The scanner's protocol prefix regex did not treat `[` as a URL boundary.

## 4. 环境信息

- 涉及模块 / 功能：SDK security preflight, URL protocol scanner
- 相关文件 / 函数：`src/security.ts`, `unsafeUrls()`
- 运行环境：browser SDK render preflight
- 其他上下文：found while auditing `security-policy-v1`; v1 only promises source-level protocol preflight, but this delimiter is common Mermaid source syntax

## 5. 严重程度

**P1** — The documented security policy blocked a bare `javascript:` but missed the same token in normal diagram label syntax.
