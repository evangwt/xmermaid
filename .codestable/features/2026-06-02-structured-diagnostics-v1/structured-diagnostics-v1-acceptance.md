---
doc_type: feature-acceptance
feature: 2026-06-02-structured-diagnostics-v1
status: accepted
summary: 验收 structured diagnostics v1
tags: [production, diagnostics, sdk]
---

# structured-diagnostics-v1 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-structured-diagnostics-v1/structured-diagnostics-v1-design.md

## 1. 接口契约核对

- [x] `XMermaidDiagnosticCode` / `SourceRange` / `XMermaidDiagnostic` 已落地在 `src/types/diagnostics.ts`。
- [x] `XMermaidError` 仍保留 `code` / `details`，并新增 `diagnostics: XMermaidDiagnostic[]`。
- [x] `RenderResult.diagnostics` 现在引用共享 `XMermaidDiagnostic[]`，不再是 `range: null` 的假类型。
- [x] root public API 导出 `SourceRange`、`XMermaidDiagnostic`、`XMermaidDiagnosticCode`。

## 2. 行为与决策核对

- [x] D1：diagnostics 类型从 `options.ts` 拆到 `src/types/diagnostics.ts`，SDK、error、editor 共用。
- [x] D2：`renderToSVGElement()` 先跑 support analyzer；unsupported diagram 在 WASM 前失败，unsupported flowchart syntax 作为 warning 返回。
- [x] D3：`XMermaidError` 携带 diagnostics；live editor 优先消费 `error.diagnostics`。
- [x] D4：WASM parse error 当前没有结构化 parser range，diagnostic range 保持 `null`，未从 message 伪造 column。
- [x] 挂载点反向核对：新增/修改命中均在 design 2.3 清单内：`src/types/diagnostics.ts`、`src/types/options.ts`、`src/types/error.ts`、`src/xmermaid.ts`、`src/editor/index.ts`、`src/editor/repair.ts`、`src/index.ts`、`src/types/index.ts`、目标测试和 consumer smoke。

## 3. 验收场景核对

- [x] S1：partial flowchart 成功渲染时返回 `unsupported_syntax` diagnostic。
  - 证据：`tests/xmermaid.test.ts` 新增 classDef warning 场景。
- [x] S2：unsupported diagram preflight 抛 `XMermaidError('UNSUPPORTED_DIAGRAM')`，并携带 `unsupported_diagram_type` diagnostic。
  - 证据：`tests/xmermaid.test.ts` 新增 sequence diagram 场景。
- [x] S3：WASM parse error 归一化为 `XMermaidError('PARSE_ERROR')`，并携带 `parse_error` diagnostic。
  - 证据：`tests/xmermaid.test.ts` 新增 parse error 场景。
- [x] S4：live editor 默认 render 显示 SDK diagnostics，同时 preview 仍保留 SVG。
  - 证据：`tests/live-editor.test.ts` 新增 default render diagnostics 场景。
- [x] S5：custom `renderDiagram` 抛带 diagnostics 的 `XMermaidError` 时，live editor 优先显示 error diagnostics。
  - 证据：`tests/live-editor.test.ts` 新增 error diagnostics 优先级场景。
- [x] S6：packed consumer typecheck 能 import diagnostics 类型。
  - 证据：`scripts/consumer-smoke.cjs` fixture 引用 `XMermaidDiagnosticCode`、`XMermaidDiagnostic`、`SourceRange`；`npm run smoke:consumer -- --json` 通过。

## 4. 术语一致性

- `XMermaidDiagnosticCode`、`XMermaidDiagnostic`、`SourceRange`、`unsupported_syntax`、`unsupported_diagram_type` 均与 roadmap contract 一致。
- editor 仍导出 `RenderDiagnostic` / `RenderDiagnosticCode` 作为 editor 表面类型，但底层继承共享 diagnostic contract。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已更新公开 SDK render diagnostics、共享 diagnostics 类型、`XMermaidError.diagnostics`、live editor diagnostics 消费、consumer smoke 类型门禁。
- [x] 已明确记录 Rust parser 未输出结构化 offset/column 时，不伪造 token range。

## 6. requirement 回写

- [x] `.codestable/requirements/production-support-contract.md` 已追加 `2026-06-02-structured-diagnostics-v1` 到 `implemented_by`。
- [x] 用户故事、解决方式、边界和变更日志已补充 structured diagnostics 当前能力。

## 7. roadmap 回写

- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 中 `structured-diagnostics-v1` 已改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 子 feature 清单已同步状态、feature 目录和备注。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- 候选：consumer smoke 依赖真实 Chrome/Chromium；CI 若无浏览器需要设置 `CHROME_BIN`。这属于后续 docs/release checklist 应落文档的运行环境要求，暂不写 attention。

## 9. 遗留

- structured diagnostics 不实现 security policy；`security_blocked_*` 仅为后续 `security-policy-v1` 保留诊断码。
- Rust parser 仍未输出结构化 offset/column；parse error diagnostic range 当前保持 `null`。

## 验证记录

- [x] `npm test -- tests/xmermaid.test.ts tests/live-editor.test.ts tests/consumer-smoke.test.ts`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run smoke:consumer -- --json`
- [x] `npm test`
- [x] YAML validation for structured diagnostics checklist and production-readiness items.
