---
doc_type: feature-design
feature: 2026-06-02-structured-diagnostics-v1
requirement: production-support-contract
roadmap: production-readiness
roadmap_item: structured-diagnostics-v1
status: approved
summary: 从 support analyzer/WASM 到 SDK/live editor 贯通结构化诊断和 line/column range
tags: [production, diagnostics, sdk]
---

# structured-diagnostics-v1 design

## 0. 术语约定

- **XMermaidDiagnostic**：SDK、错误对象、live editor 和 repair engine 共用的结构化诊断对象。
- **XMermaidDiagnosticCode**：公开诊断码枚举；本 feature 启用 parse/render/layout/wasm/unsupported 诊断，security 诊断码只作为后续 security policy 的保留码。
- **SourceRange**：包含 offset、line、column 的源码范围；offset 使用 JS string offset，line/column 1-based，end 为 exclusive。
- **Diagnostic preflight**：渲染前用 support analyzer 识别 unsupported diagram/syntax，并把结果转换为 diagnostics。

## 1. 决策与约束

### 需求摘要

当前 `RenderResult.diagnostics` 永远为空，live editor 只在 render 抛错时把错误字符串映射成私有诊断。生产上这会让用户无法区分 unsupported syntax、unsupported diagram、parse error 和 render error，也拿不到具体 line/column range。

成功标准：

- root public API 导出 `XMermaidDiagnosticCode`、`XMermaidDiagnostic` 和共享 `SourceRange`。
- `renderToSVGElement()` 成功渲染 partial flowchart 时，返回 support analyzer 发现的 `unsupported_syntax` warning diagnostics。
- unsupported diagram 在 render 前被 preflight 识别并抛 `XMermaidError('UNSUPPORTED_DIAGRAM')`，错误 details 中包含 `unsupported_diagram_type` diagnostic 和 source range。
- WASM/render 失败继续抛 `XMermaidError`，但 details 中包含统一 diagnostic，供 editor 消费。
- live editor 默认渲染路径消费 SDK diagnostics；unsupported syntax 不再显示成 “No diagnostics”。
- live editor repair rules 继续只消费 diagnostic code；不新增错误字符串正则。

明确不做：

- 不改 Rust parser 的错误结构；parse error 若 WASM 没给 column/offset，本 feature 不伪造 token 精确 range。
- 不实现 security policy 行为；`security_blocked_*` 只作为类型保留码。
- 不把 unsupported syntax 当 fatal error；v1 仍允许已能渲染的 partial flowchart 输出 SVG，同时返回 warning diagnostics。
- 不新增 Mermaid 语法支持。
- 不实现 custom WASM URL loader。

### 复杂度档位

走“公开 SDK 错误合同 + editor 消费”档位。偏离点：这会改变对外类型和 live editor 显示行为，因此必须同时用 SDK 单测、editor 单测、typecheck 和 packed consumer smoke 验证。

### 关键决策

- **D1：诊断类型从 `options.ts` 拆到共享 diagnostics 类型文件。** `options.ts` 只引用诊断类型，editor 与 repair engine 也引用同一合同。
- **D2：support analyzer diagnostics 是 preflight 结果。** unsupported diagram 在调用 WASM 前失败；unsupported flowchart syntax 作为 warning 附加到成功 `RenderResult`。
- **D3：错误对象携带 diagnostics。** `XMermaidError.details` 保持 unknown 兼容，但新增 `diagnostics` 字段，editor 优先读取结构化 diagnostics。
- **D4：range fallback 诚实。** 对没有精确 range 的 WASM 错误，用整图 range 或 null；不根据错误 message 硬猜 column。

### 前置依赖

roadmap item `support-analyzer-v1` 和 `render-svg-api` 已完成，分别提供 unsupported feature range 与 SVG render result。

## 2. 名词与编排

### 2.1 名词层

#### 现状

- `src/types/options.ts` 内的 `XMermaidDiagnostic.code` 是 `string`，`range` 固定为 `null`。
- `src/editor/index.ts` 自定义 `RenderDiagnosticCode` 与 `SourceRange`，且 range 没有 column。
- `src/types/error.ts` 的 `XMermaidError` 只有 `code` 和 `details`，没有可直接读取的 diagnostics。

#### 变化

新增共享诊断类型：

```ts
type XMermaidDiagnosticCode =
  | 'parse_error'
  | 'unsupported_diagram_type'
  | 'unsupported_syntax'
  | 'layout_error'
  | 'render_error'
  | 'wasm_init_error'
  | 'security_blocked_url'
  | 'security_blocked_html'
  | 'security_blocked_click';

interface SourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface XMermaidDiagnostic {
  code: XMermaidDiagnosticCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  range: SourceRange | null;
  featureId?: string;
}
```

`XMermaidError` 追加：

```ts
class XMermaidError extends Error {
  code: XMermaidErrorCode;
  details?: unknown;
  diagnostics: XMermaidDiagnostic[];
}
```

### 2.2 编排层

```mermaid
flowchart TD
  A[renderToSVGElement(input)] --> B[analyzeSupport / detectUnsupportedFeatures]
  B -->|unsupported diagram| C[throw XMermaidError with unsupported_diagram_type diagnostic]
  B -->|flowchart warnings| D[continue render]
  D --> E[WASM render]
  E --> F[SVGRenderer.render]
  F --> G[RenderResult.diagnostics = preflight warnings]
  E -->|throws| H[normalize error to XMermaidError + diagnostics]
  I[live editor default render] --> A
  I --> J[render SVG and show result diagnostics]
  H --> K[live editor reads error.diagnostics]
```

#### 现状

SDK render path does not expose analyzer findings. Live editor only builds diagnostics in catch blocks, losing analyzer range and making successful partial renders look clean.

#### 变化

- `renderToSVGElement()` creates preflight diagnostics from `analyzeSupport(input).unsupportedFeatures`.
- If any preflight diagnostic has `unsupported_diagram_type`, throw before WASM.
- Successful render returns warning diagnostics from unsupported syntax.
- Failed render throws `XMermaidError` with normalized diagnostic.
- Live editor default render calls `renderToSVGElement()` directly, appends SVG, and renders returned diagnostics.
- Live editor custom `renderDiagram` remains supported; custom thrown `XMermaidError` diagnostics are consumed if present, otherwise fallback mapping is preserved.

流程级约束：

- `unsupported_diagram_type` and `unsupported_syntax` must remain distinct.
- `render(input): Promise<void>` still only mutates the container and does not expose diagnostics directly.
- Existing repair suggestions consume `RenderDiagnostic.code` only.
- Unsupported syntax warnings must not block SVG output in this feature.

### 2.3 挂载点清单

- `src/types/diagnostics.ts`：新增共享诊断类型和 helper type boundary.
- `src/types/options.ts`：引用共享 `XMermaidDiagnostic`。
- `src/types/error.ts`：`XMermaidError` 携带 diagnostics。
- `src/xmermaid.ts`：preflight diagnostics、error diagnostics 和 render result diagnostics。
- `src/editor/index.ts`：使用共享 diagnostic/range 类型并显示 SDK diagnostics。
- `src/editor/repair.ts`：继续消费共享 `RenderDiagnostic` code。
- `src/index.ts` / `src/types/index.ts`：导出新诊断类型。
- `tests/xmermaid.test.ts` / `tests/live-editor.test.ts` / `scripts/consumer-smoke.cjs`：覆盖 SDK、editor 和 packed declarations。

### 2.4 推进策略

1. RED 测试：新增 SDK diagnostics、error diagnostics、live editor diagnostics 和 consumer typecheck 期望。
   退出信号：目标测试因 diagnostics 仍为空或类型缺失失败。
2. 名词层实现：新增共享 diagnostics 类型，改 `XMermaidError` 与导出。
   退出信号：typecheck 能识别新类型。
3. SDK 编排实现：support analyzer → diagnostics、unsupported diagram preflight、WASM error diagnostics。
   退出信号：`tests/xmermaid.test.ts` 目标用例通过。
4. Editor 消费实现：默认 render 使用 element API result diagnostics，error fallback 读取 `XMermaidError.diagnostics`。
   退出信号：`tests/live-editor.test.ts` 目标用例通过。
5. 发布门禁接入：consumer smoke typecheck 引用 `XMermaidDiagnosticCode` 与 non-null range 合同。
   退出信号：`npm run build && npm run smoke:consumer -- --json` 通过。
6. 回归验证：跑相关单测、全量 JS 测试、typecheck、build、consumer smoke。
   退出信号：验证命令全部通过。

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `src/types/options.ts`：继续塞 diagnostics 会让 options/result 类型和错误合同混杂。
- 文件级 — `src/editor/index.ts`：当前已有私有 diagnostic 类型，继续扩展会制造第二套合同。
- 目录级 — `src/types/`：已有 error/options/layout/theme，新增 `diagnostics.ts` 符合同类类型模块组织。

##### 结论：做微重构（拆文件）

新增 `src/types/diagnostics.ts`，把公开 diagnostic code/range/object 类型放进去；`options.ts`、`error.ts`、editor 类型都引用它。验证方式：typecheck + 现有 diagnostics/editor tests 通过。该拆分是类型搬迁与共享，不改变渲染行为。

## 3. 验收契约

关键场景：

- **S1**：`renderToSVGElement('graph TD\n  A-->B\n  classDef hot fill:#fff')` → 返回 SVG，同时 diagnostics 含 `unsupported_syntax`、`featureId: 'flowchart.classDef'` 和 line/column range。
- **S2**：`renderToSVGElement('sequenceDiagram\n  A->>B: Hi')` → 抛 `XMermaidError('UNSUPPORTED_DIAGRAM')`，error diagnostics 含 `unsupported_diagram_type` 与第一行 range。
- **S3**：WASM 抛 parse error → 抛 `XMermaidError('PARSE_ERROR')`，error diagnostics 含 `parse_error`；无精确 parser range 时 range 为 null。
- **S4**：live editor 默认 render 遇到 unsupported flowchart syntax → preview 仍显示 SVG，diagnostics panel 显示 `unsupported_syntax` 和对应行号。
- **S5**：custom `renderDiagram` 抛带 diagnostics 的 `XMermaidError` → live editor 显示 error.diagnostics，而不是整图 fallback range。
- **S6**：packed consumer typecheck 能 import `XMermaidDiagnosticCode`、`XMermaidDiagnostic` 和 `SourceRange`。

反向核对项：

- 不实现 security policy 行为。
- 不新增 Mermaid diagram/render 支持。
- 不把 unsupported syntax 变成 fatal error。
- 不伪造 parser token column。
- 不改变 `render(input): Promise<void>` 兼容行为。

## 4. 与项目级架构文档的关系

acceptance 阶段需要把共享 diagnostics contract、preflight analyzer 接入、error diagnostics 和 live editor 消费路径写入 `ARCHITECTURE.md` 当前 Flowchart 解耦合同 / 生产支持合同位置，并回写 `production-support-contract` requirement 与 production-readiness roadmap。
