---
doc_type: feature-acceptance
feature: 2026-06-02-support-analyzer-v1
status: accepted
summary: 验收 support analyzer v1 的 unsupported feature 与 source range 输出
tags: [production, support, diagnostics]
---

# support-analyzer-v1 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-support-analyzer-v1/support-analyzer-v1-design.md

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `detectUnsupportedFeatures('sequenceDiagram\n  A->>B: Hi')` 返回 `diagram.sequence` error，range 指向第一行。
  - 证据来源：`tests/support-matrix.test.ts`。
- [x] flowchart `class`、`classDef`、`style`、`click` 返回对应 `flowchart.*` feature。
  - 证据来源：`tests/support-matrix.test.ts`。
- [x] HTML label / Markdown label 返回 `flowchart.htmlLabel` / `flowchart.markdownLabel`。
  - 证据来源：`tests/support-matrix.test.ts`。

**名词层"现状 → 变化"逐项核对**：

- [x] 新增 `UnsupportedFeatureId`、`SupportSourceRange`、`UnsupportedFeature`。
- [x] `SupportReport` 追加 `unsupportedFeatures`，保留旧 `diagramType`、`status`、`message` 字段。
- [x] root public API 导出 `detectUnsupportedFeatures` 和 analyzer 类型。

**流程图核对**：

- [x] `detectUnsupportedFeatures` → diagram type 检测 → unsupported diagram 或 flowchart line scan → `UnsupportedFeature[]`。
- [x] `analyzeSupport` 调用 analyzer 并返回 `unsupportedFeatures`。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] root public API 已导出 analyzer。
- [x] unsupported diagram family 有 feature id 和 range。
- [x] flowchart unsupported syntax 有 feature id 和 line range。
- [x] 基础 supported flowchart 返回空 unsupported features。
- [x] packed consumer smoke typecheck 已 import analyzer API。

**明确不做逐项核对**：

- [x] 未替代 Rust parser：`src/support.ts` 未调用 WASM/parser。
- [x] 未实现新的 diagram/render 支持能力。
- [x] 未接入 live editor diagnostics。
- [x] 未做 security policy 判断。
- [x] 未做跨行复杂 HTML/Markdown label 完整解析。

**关键决策落地**：

- [x] D1：扫描器位于 `src/support.ts`。
- [x] D2：range 使用 JS offset、1-based line/column、exclusive end。
- [x] D3：同一行可产生多个 feature。
- [x] D4：`analyzeSupport()` 追加字段，不删旧字段。

## 3. 验收场景核对

- [x] **S1**：unsupported diagram family 返回 `diagram.*` feature 和第一行 range。
  - 证据：`npm test -- tests/support-matrix.test.ts`。
- [x] **S2**：flowchart class/classDef/style/click 返回对应 unsupported feature 和行 range。
  - 证据：`tests/support-matrix.test.ts`。
- [x] **S3**：HTML label / Markdown label 返回对应 unsupported feature。
  - 证据：`tests/support-matrix.test.ts`。
- [x] **S4**：`analyzeSupport` 返回 `unsupportedFeatures` 且保留旧字段。
  - 证据：`tests/support-matrix.test.ts`。
- [x] **S5**：基础 supported flowchart 返回空数组。
  - 证据：`tests/support-matrix.test.ts`。
- [x] **S6**：packed consumer typecheck 能 import analyzer API。
  - 证据：`npm run build && npm run smoke:consumer -- --json`；package size `236608` bytes，browser render duration `1392ms`。

## 4. 术语一致性

- Support analyzer：只指轻量 production support scanner，不是 parser。
- UnsupportedFeature：只描述当前 support contract 不支持的 feature。
- SupportSourceRange：只用于 support analyzer 输出；后续 diagnostics 再做统一转换。

## 5. 架构归并

- [x] `ARCHITECTURE.md`：已更新当前生产支持合同，记录 `detectUnsupportedFeatures()`、`SupportSourceRange` range 语义、id 与 support matrix 的映射约束，以及“不调用 WASM/不改 render path”的边界。

## 6. requirement 回写

- [x] `production-support-contract` 已更新：新增具体 unsupported feature + line range 的用户故事、解决方式和边界。

## 7. roadmap 回写

- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 对应条目已从 `in-progress` 改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 第 5 节对应条目已同步为 done。

## 8. attention.md 候选盘点

- [x] 无新增 attention 候选。Chrome/`CHROME_BIN` 候选已由 pack smoke 记录。

## 9. 遗留

- Analyzer 输出尚未接入 live editor diagnostics；后续 `structured-diagnostics-v1` 处理。
- Analyzer 不做完整 Mermaid parse，跨行复杂 label 和 security URL 判断不在 v1。
