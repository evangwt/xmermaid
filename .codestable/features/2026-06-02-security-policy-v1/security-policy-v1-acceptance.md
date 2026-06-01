---
doc_type: feature-acceptance
feature: 2026-06-02-security-policy-v1
status: accepted
summary: 验收 security policy v1
tags: [production, security, diagnostics]
---

# security-policy-v1 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-security-policy-v1/security-policy-v1-design.md

## 1. 接口契约核对

- [x] `SecurityLevel`、`SecurityPolicy`、`DEFAULT_SECURITY_POLICY` 已落地在 `src/security.ts` 并通过 root public API 导出。
- [x] `RenderOptions` 已追加 `securityLevel?: SecurityLevel` 与 `securityPolicy?: Partial<SecurityPolicy>`。
- [x] `detectSecurityDiagnostics()` 输出 `security_blocked_click`、`security_blocked_html`、`security_blocked_url` 三类结构化 diagnostics。
- [x] packed consumer typecheck fixture 已 import security API 并把 `securityPolicy` 传入 `RenderOptions`。

## 2. 行为与决策核对

- [x] D1：默认 strict：`DEFAULT_SECURITY_POLICY.securityLevel === 'strict'`。
- [x] D2：security diagnostics 独立于 support diagnostics；strict 下 click/HTML 会产生 security diagnostics，loose 下保留 unsupported syntax warning。
- [x] D3：危险 URL 不随 loose 放开，`javascript:` 仍产生 `security_blocked_url`。
- [x] D4：v1 只做 source preflight；未执行 click callback，未渲染 HTML label，未实现 sanitizer/CSP。
- [x] 挂载点反向核对：新增/修改命中均在 design 2.3 清单内：`src/security.ts`、`src/types/options.ts`、`src/xmermaid.ts`、`src/index.ts`、`src/types/index.ts`、目标测试和 consumer smoke。

## 3. 验收场景核对

- [x] S1：默认 click + `javascript:` URL 被阻断。
  - 证据：`tests/xmermaid.test.ts` 覆盖 `security_blocked_click` 和 `security_blocked_url`。
- [x] S2：默认 HTML label 被阻断。
  - 证据：`tests/xmermaid.test.ts` 覆盖 `security_blocked_html`。
- [x] S3：loose 模式下 click/HTML 不产生 security diagnostics，但仍保留 unsupported syntax warning。
  - 证据：`tests/xmermaid.test.ts` 覆盖 loose HTML warning。
- [x] S4：loose 模式下危险 URL 仍被阻断。
  - 证据：`tests/xmermaid.test.ts` 覆盖 loose + `javascript:`。
- [x] S5：live editor 默认 render 显示 security diagnostics。
  - 证据：`tests/live-editor.test.ts` 覆盖 default render path strict diagnostics。
- [x] S6：packed consumer typecheck 能 import `SecurityLevel` / `SecurityPolicy` / `DEFAULT_SECURITY_POLICY`。
  - 证据：`scripts/consumer-smoke.cjs` fixture 引用 security API；`npm run smoke:consumer -- --json` 通过。

## 4. 术语一致性

- `SecurityPolicy`、`SecurityLevel`、`DEFAULT_SECURITY_POLICY`、`security_blocked_url`、`security_blocked_html`、`security_blocked_click` 均与 roadmap contract 一致。
- `loose` 的含义已限定为放宽 click/HTML security blocking，不表示信任所有 URL。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已写入默认 strict policy、有限 loose、URL allowlist、security diagnostics 和不执行 click/HTML、不实现 sanitizer/CSP 的边界。

## 6. requirement 回写

- [x] `.codestable/requirements/production-support-contract.md` 已追加 `2026-06-02-security-policy-v1` 到 `implemented_by`。
- [x] 用户故事、解决方式、边界和变更日志已补充 security policy 当前能力。

## 7. roadmap 回写

- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 中 `security-policy-v1` 已改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 子 feature 清单已同步状态、feature 目录和备注。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- 无新的 attention 候选。Chrome/`CHROME_BIN` 仍属于 production docs/release checklist 要补的发布环境说明。

## 9. 遗留

- v1 不实现 sanitizer/CSP/sandbox。
- v1 不执行 click callback、不渲染 HTML label、不新增 URL/link 渲染能力。
- URL detection 是 source-level protocol preflight，不承诺完整 Mermaid link grammar。

## 验证记录

- [x] `npm test -- tests/xmermaid.test.ts`
- [x] `npm test -- tests/live-editor.test.ts`
- [x] `npm test -- tests/consumer-smoke.test.ts`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run smoke:consumer -- --json`
- [x] YAML validation for security-policy checklist and production-readiness items.
