---
doc_type: feature-design
feature: 2026-06-02-support-analyzer-v1
requirement: production-support-contract
roadmap: production-readiness
roadmap_item: support-analyzer-v1
status: approved
summary: 建立 diagram/syntax support analyzer，输出 unsupported feature 列表与 source range
tags: [production, support, diagnostics]
---

# support-analyzer-v1 design

## 0. 术语约定

- **Support analyzer**：轻量 TypeScript 扫描器，识别当前生产支持合同里已经声明 unsupported 的 diagram family 和 flowchart syntax。
- **UnsupportedFeature**：一次扫描发现的 unsupported 能力项，包含 `id`、`severity`、`message` 和可定位的 `SupportSourceRange`。
- **SupportSourceRange**：support analyzer 使用的源码范围，包含 offset、line 和 column；后续 `structured-diagnostics-v1` 再和 live editor 的 diagnostic range 统一。

## 1. 决策与约束

### 需求摘要

当前 `analyzeSupport(source)` 只能告诉消费者 diagram-level 状态。生产上这仍然太粗：用户写了 `classDef`、`click`、HTML label 或 sequence diagram 时，系统应该明确指出具体 unsupported feature 和源码位置。

成功标准：

- root public API 导出 `detectUnsupportedFeatures(source)` 及相关类型。
- unsupported diagram family 输出 `diagram.*` feature，range 指向第一行 diagram declaration。
- flowchart 中的 `class`、`classDef`、`style`、`click`、HTML label 和 Markdown label 输出对应 `flowchart.*` feature。
- 可定位的 unsupported syntax 返回 `SupportSourceRange`，包含 start/end offset、line、column。
- `analyzeSupport(source)` 携带 `unsupportedFeatures`，但不改变 parser/render 行为。

明确不做：

- 不替代 Rust parser，不判断完整 Mermaid 语法正确性。
- 不实现新的 diagram/render 支持能力。
- 不把 analyzer 输出接入 live editor diagnostics；那是 `structured-diagnostics-v1`。
- 不做 security policy 判断；`click` / URL / HTML 的安全语义由 `security-policy-v1` 完成。
- 不支持跨行复杂 HTML/Markdown label 的完整解析；v1 只扫描单行常见模式。

### 复杂度档位

走“小型 SDK 分析器”档位。偏离点：输出会成为后续 diagnostics/runtime 的输入，因此 id 必须和 support matrix 的 unsupported syntax id 对齐。

### 关键决策

- **D1：先在 `src/support.ts` 内实现轻量扫描。** 该模块已经承载 production support contract，v1 没必要新建 parser 子系统。
- **D2：range 使用 1-based line/column，offset 使用 JS string offset，endOffset/endColumn 为 exclusive。** 这和后续 diagnostics contract 对齐，避免下游二次猜。
- **D3：同一行可产生多个 feature。** 例如 HTML label 和 markdown label 扫描不互斥；消费者可自行去重或展示。
- **D4：`analyzeSupport()` 追加字段，不删旧 `message`。** 保持 release-support-matrix 已有调用兼容。

### 前置依赖

roadmap item `release-support-matrix` 已完成，提供 support matrix id 列表；`render-svg-api` 已完成但本 feature 不依赖其实现。

## 2. 名词与编排

### 2.1 名词层

#### 现状

- `SupportReport` 只有 `diagramType`、`status`、`message`。
- `SupportMatrix.flowchart.unsupportedSyntax` 已列出 unsupported id，但代码没有扫描这些 id 是否在 source 里出现。

#### 变化

新增类型：

```ts
type UnsupportedFeatureId =
  | 'diagram.sequence'
  | 'diagram.class'
  | 'diagram.state'
  | 'diagram.er'
  | 'diagram.gantt'
  | 'diagram.pie'
  | 'diagram.mindmap'
  | 'flowchart.class'
  | 'flowchart.classDef'
  | 'flowchart.style'
  | 'flowchart.click'
  | 'flowchart.htmlLabel'
  | 'flowchart.markdownLabel';

interface SupportSourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface UnsupportedFeature {
  id: UnsupportedFeatureId;
  range: SupportSourceRange | null;
  severity: 'warning' | 'error';
  message: string;
}

function detectUnsupportedFeatures(source: string): UnsupportedFeature[];
```

`SupportReport` 追加：

```ts
interface SupportReport {
  diagramType: DiagramType;
  status: SupportStatus;
  message: string;
  unsupportedFeatures: UnsupportedFeature[];
}
```

### 2.2 编排层

```mermaid
flowchart TD
  A[detectUnsupportedFeatures(source)] --> B[detect diagram type]
  B -->|known unsupported diagram| C[diagram feature on first line]
  B -->|flowchart| D[scan lines]
  D --> E[class/classDef/style/click]
  D --> F[HTML label / Markdown label]
  E --> G[UnsupportedFeature[]]
  F --> G
  H[analyzeSupport(source)] --> A
  H --> I[SupportReport with unsupportedFeatures]
```

#### 现状

`analyzeSupport()` 只做 first-line diagram detection。Unsupported flowchart syntax 只能从 README/support matrix 静态查，不能针对用户输入给出位置。

#### 变化

- `detectUnsupportedFeatures()` 对 unsupported diagram family 返回一个 error。
- flowchart 扫描逐行匹配常见 unsupported syntax。
- range helper 统一生成 offset/line/column。
- `analyzeSupport()` 调用 analyzer 并把结果带回。

流程级约束：

- 空输入和 unknown diagram 不抛异常。
- line/column 为 1-based，end 为 exclusive。
- analyzer 只读 source，不调用 WASM，不修改 render path。
- 所有 `UnsupportedFeature.id` 必须在 support matrix unsupported syntax 或 diagram unsupported id 中可追溯。

### 2.3 挂载点清单

- `src/support.ts`：新增 analyzer 类型、range helper 和检测函数。
- `src/index.ts`：导出 analyzer 函数和类型。
- `tests/support-matrix.test.ts`：覆盖 unsupported diagram、flowchart syntax 和 analyzeSupport 集成。
- `scripts/consumer-smoke.cjs`：临时消费者 typecheck 引用 `detectUnsupportedFeatures` 与类型。

### 2.4 推进策略

1. RED 测试：新增 analyzer 行为和 public API typecheck 期望。
   退出信号：测试因 `detectUnsupportedFeatures` 缺失失败。
2. 名词层实现：新增 UnsupportedFeatureId / SupportSourceRange / UnsupportedFeature / SupportReport 字段。
   退出信号：typecheck 通过。
3. 扫描实现：unsupported diagram + flowchart unsupported syntax line scanner。
   退出信号：support matrix analyzer 测试通过。
4. 发布门禁接入：consumer smoke typecheck 引用新 analyzer API。
   退出信号：`npm run build && npm run smoke:consumer -- --json` 通过。
5. 回归验证：跑相关单测、全量 JS 测试、typecheck、build、consumer smoke。
   退出信号：验证命令全部通过。

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `src/support.ts`：当前 support matrix 小而集中；新增 analyzer v1 后仍在生产支持合同边界内。
- 目录级 — `src/`：不新增 parser 子系统；后续 structured diagnostics 增长时再拆文件。
- 测试级 — `tests/support-matrix.test.ts` 当前就是 support contract 测试，新增 analyzer 行为仍属同一测试面。

##### 结论：不做微重构

v1 扫描器保持在 `src/support.ts`，避免过早创建平行 parser。若后续规则超过轻量扫描范围，再走专门的 analyzer/refactor。

## 3. 验收契约

关键场景：

- **S1**：`detectUnsupportedFeatures('sequenceDiagram\n  A->>B: Hi')` → 返回 `diagram.sequence` error，range 指向第一行。
- **S2**：flowchart 中 `class A foo` / `classDef foo fill:#fff` / `style A fill:#fff` / `click A callback` → 返回对应 `flowchart.*` features 和行 range。
- **S3**：flowchart 中 HTML label / Markdown label → 返回 `flowchart.htmlLabel` / `flowchart.markdownLabel`。
- **S4**：`analyzeSupport(source)` → 返回 `unsupportedFeatures`，且旧 `diagramType/status/message` 字段仍可用。
- **S5**：基础 supported flowchart → `detectUnsupportedFeatures()` 返回空数组。
- **S6**：packed consumer typecheck 能 import `detectUnsupportedFeatures`、`UnsupportedFeature`、`SupportSourceRange`。

反向核对项：

- 不调用 WASM 或 Rust parser。
- 不修改 render behavior。
- 不接入 live editor diagnostics。
- 不新增 security policy 判断。

## 4. 与项目级架构文档的关系

本 feature 新增 production support analyzer。acceptance 阶段需要把 analyzer 的轻量性质、id/range 合同、与 support matrix 的映射关系写入 `ARCHITECTURE.md`，并回写 roadmap / requirement。
