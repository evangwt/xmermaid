---
doc_type: feature-acceptance
feature: 2026-06-02-release-support-matrix
status: accepted
summary: 验收生产支持矩阵、公开定位和支持范围文档收敛
tags: [production, support, release]
---

# release-support-matrix 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-release-support-matrix/release-support-matrix-design.md

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `getDiagramSupport('flowchart')?.status` → `partial`
  - 代码实际行为：`src/support.ts` 提供 `getDiagramSupport`，`tests/support-matrix.test.ts` 覆盖 flowchart entry 为 `partial`。
- [x] `analyzeSupport('sequenceDiagram\n  A->>B: Hi')` → unsupported sequence report
  - 代码实际行为：`src/support.ts` 的 `detectDiagramType` 识别 `sequenceDiagram`，`tests/support-matrix.test.ts` 覆盖 `diagramType: 'sequence'` + `status: 'unsupported'`。

**名词层"现状 → 变化"逐项核对**：

- [x] `SupportMatrix` / `DiagramSupportEntry` / `SyntaxCapability` / `SupportReport` 已新增：`src/support.ts`。
- [x] root public API 已导出 support matrix 函数和类型：`src/index.ts`。
- [x] package 描述已从泛 Mermaid renderer 收敛为 flowchart-focused partial support：`package.json`。
- [x] README 已新增当前支持范围和限制：`README.md`。

**流程图核对**：

- [x] Consumer imports xmermaid → `src/index.ts` 导出 `getSupportMatrix` / `analyzeSupport`。
- [x] `analyzeSupport(source)` → `detectDiagramType` → partial/unsupported report：`src/support.ts`。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] root public API 导出 support matrix 查询能力：`tests/support-matrix.test.ts` 从 `../src/index` import 并调用。
- [x] package 描述不再暗示完整 Mermaid 替代：测试断言 description 包含 `flowchart` / `partial`，且不匹配 `fully compatible|complete mermaid`。
- [x] README 存在并明确当前支持范围、限制和下一步：测试读取 `README.md` 并断言 partial Mermaid support、unsupported diagram family。
- [x] 支持矩阵区分 flowchart partial 与 sequence unsupported：测试覆盖 S1-S3。

**明确不做逐项核对**：

- [x] 未实现新的 diagram type：grep 显示新增非 flowchart diagram 名称只出现在 `src/support.ts`、README 和测试/文档；Rust parser/layout/renderer 未新增实现。
- [x] 未实现 flowchart class/style/click 等 unsupported syntax：support matrix 仅声明 unsupported，未改 parser/render 行为。
- [x] 未做 source-range 级 support analyzer：`SupportReport` 只有 diagram-level 字段。
- [x] 未改 renderer/layout/parser 行为：本 feature 新增 `src/support.ts`、README、测试和导出/描述；未触碰 `crates/**` 或 `src/renderer/**`。

**关键决策落地**：

- [x] D1：support matrix 用 TS 常量落地：`src/support.ts`。
- [x] D2：README/package/support matrix 同步测试：`tests/support-matrix.test.ts`。
- [x] D3：只做 diagram-level report：`SupportReport` 无 range / syntax detail 字段。

**编排层"现状 → 变化"逐项核对**：

- [x] public API 增加 support matrix 查询函数：`src/index.ts`。
- [x] README 使用同一组术语描述当前能力：`README.md`。
- [x] package description 改为 partial/flowchart-focused 表述：`package.json`。
- [x] 新增测试约束 API、README、package 描述：`tests/support-matrix.test.ts`。

**流程级约束核对**：

- [x] `getSupportMatrix()` 返回拷贝，避免消费者修改模块级常量：`src/support.ts` 的 `cloneEntry`。
- [x] `analyzeSupport()` 不抛异常：未知和空输入走 `unknown` unsupported report。
- [x] package 描述不宣称完整 Mermaid 替代：测试反向断言。

**挂载点反向核对（可卸载性）**：

- [x] root public API：删除 `src/index.ts` 的 support 导出后 feature 对外消失。
- [x] package metadata：删除 `package.json.description` 改动后生产定位收敛消失。
- [x] root documentation：删除 `README.md` 后用户文档支持范围消失。
- [x] 反向 grep：`getSupportMatrix` / `analyzeSupport` 命中仅在 `src/support.ts`、`src/index.ts`、README、测试和 CodeStable specs。
- [x] 拔除沙盘：删除 `src/support.ts`、`src/index.ts` 导出、README 和 support test 后，本 feature 无残留运行时入口。

## 3. 验收场景核对

- [x] **S1**：调用 `getSupportMatrix()` → 返回版本和 entries，且 flowchart entry 是 `partial`。
  - 证据来源：`npm test -- tests/support-matrix.test.ts`。
  - 结果：通过。
- [x] **S2**：调用 `analyzeSupport('graph TD\n  A-->B')` → 返回 `diagramType: 'flowchart'` 和 `status: 'partial'`。
  - 证据来源：`tests/support-matrix.test.ts`。
  - 结果：通过。
- [x] **S3**：调用 `analyzeSupport('sequenceDiagram\n  A->>B: Hi')` → 返回 `diagramType: 'sequence'` 和 `status: 'unsupported'`，不抛异常。
  - 证据来源：`tests/support-matrix.test.ts`。
  - 结果：通过。
- [x] **S4**：读取 `package.json.description` 和 README → 都明确 flowchart/partial Mermaid support，不宣称完整 Mermaid 兼容。
  - 证据来源：`tests/support-matrix.test.ts`。
  - 结果：通过。
- [x] **S5**：消费者可从 root public API import support matrix 函数和类型。
  - 证据来源：`tests/support-matrix.test.ts` 从 `../src/index` 导入；`npm run typecheck` 通过。
  - 结果：通过。

## 4. 术语一致性

- Support matrix：命中 `src/support.ts`、`src/index.ts`、README、测试和本 feature specs，含义一致。
- Support report：仅在 `src/support.ts` 和 design/acceptance 中使用，含义一致。
- Production contract：用于 README/package/support matrix 同步语境，没有与 release verification 混用。
- 防冲突：未发现既有同名实现被覆盖。

## 5. 架构归并

- [x] `ARCHITECTURE.md`：已新增“当前生产支持合同”小节，记录 `src/support.ts`、root exports、flowchart partial support、unsupported diagram family 和 analyzer 边界。

## 6. requirement 回写

- [x] `requirement` 为空且本次新增用户可感能力：已 backfill `.codestable/requirements/production-support-contract.md`，状态为 `current`。
- [x] 已新增 `.codestable/requirements/VISION.md` 索引，列出 current requirement。

## 7. roadmap 回写

- [x] design frontmatter 含 `roadmap: production-readiness` / `roadmap_item: release-support-matrix`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 对应条目已从 `in-progress` 改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 第 5 节对应条目已同步为 done。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- [x] 本 feature 未暴露需要补入 attention.md 的环境 / 工具 / 工作流信息。`python` 命令不可用、需用 `python3` 是本轮操作发现，但 `.codestable/tools/*.py` shebang 已是 python3，后续不一定会重复踩。

## 9. 遗留

- `pack-install-render-smoke` 仍需验证真实 packed package 的类型声明、WASM 资产和浏览器渲染。
- `support-analyzer-v1` 仍需做 source-range 级 unsupported syntax 分析。
- `ARCHITECTURE.md` 仍含远期 Web/CLI/Server/Editor SDK 愿景描述，和当前 browser SDK 实现存在张力；已在 production-readiness roadmap 观察项记录。
