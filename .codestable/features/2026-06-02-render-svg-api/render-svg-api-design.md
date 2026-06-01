---
doc_type: feature-design
feature: 2026-06-02-render-svg-api
requirement: production-support-contract
roadmap: production-readiness
roadmap_item: render-svg-api
status: approved
summary: 补齐 renderToSVGElement、renderToSVGString 和 RenderResult 公开 API
tags: [production, sdk, render-api]
---

# render-svg-api design

## 0. 术语约定

- **RenderResult**：公开渲染结果对象，包含 diagram type、diagnostics、dimensions 和 SVG element。
- **RenderOptions**：单次 SVG 输出 API 的可选渲染参数；本 feature 覆盖 theme 与 layoutConfig，WASM 自定义加载保留为类型边界但不改变当前 loader 行为。
- **DOM replacement path**：现有 `XMermaid.render(input): Promise<void>`，负责把渲染结果写入 constructor 传入的 container。

## 1. 决策与约束

### 需求摘要

本 feature 把当前只能写入 DOM container 的 SDK 扩展为可复用 SVG 输出 API，让消费者可以拿到 `SVGSVGElement` 或 serialized SVG string，而不必须先准备一个容器并让 xmermaid 清空它。

成功标准：

- `XMermaid.renderToSVGElement(input, options?)` 返回 `RenderResult`，包含 `diagramType`、`diagnostics`、`dimensions` 和 `svg`。
- `XMermaid.renderToSVGString(input, options?)` 返回 serialized SVG 字符串。
- 现有 `render(input): Promise<void>` 继续替换原 container 内容，不破坏 live editor。
- root public API 导出 `RenderOptions`、`RenderResult` 和 `WasmInitOptions` 类型。
- packed consumer smoke 的 TypeScript 入口能解析新类型和新方法。

明确不做：

- 不新增 PNG / Canvas / Blob export。
- 不实现 custom `wasmUrl` 加载；`WasmInitOptions` 只作为后续 loader 合同的类型占位。
- 不实现 source-range diagnostics；成功渲染返回空 diagnostics，失败仍抛现有 `XMermaidError`。
- 不新增 diagram type、security policy 或 unsupported syntax analyzer。
- 不改变 `SVGRenderer.render(layout)` 的输入合同。

### 复杂度档位

走“小型公开 SDK API”档位。偏离点：新增 public API 和 declarations 会进入 packed tarball，因此必须由单测、typecheck 和 consumer smoke 同时验证。

### 关键决策

- **D1：抽出共享渲染管线。** `render()`、`renderToSVGElement()` 和 `renderToSVGString()` 复用同一条 WASM layout + enum normalize + SVGRenderer 路径，避免三份行为漂移。
- **D2：单次 options 优先于 constructor options。** `renderToSVGElement(input, { theme, layoutConfig })` 可以为这一调用创建临时 renderer/layout config，不改变实例后续 `render()` 的默认状态。
- **D3：失败继续抛 `XMermaidError`。** 结构化 diagnostics runtime 是后续 roadmap；本 feature 不把错误吞进 DOM 文本或半成品 result。
- **D4：`renderToSVGString()` 是 element API 的序列化包装。** 主 API 是 `renderToSVGElement()`，字符串 API 不另走渲染逻辑。

### 前置依赖

roadmap item `release-support-matrix` 已完成。`pack-install-render-smoke` 已完成并会在发布门禁中验证 packed declarations 与浏览器最小渲染路径。

## 2. 名词与编排

### 2.1 名词层

#### 现状

- `src/xmermaid.ts` 只有 `render(input): Promise<void>`，它把 SVG 写进 `this.container`。
- `src/types/options.ts` 的 `XMermaidOptions.container` 是必填，导致即便只想拿 SVG string 也要提供 DOM container。
- `src/index.ts` 未导出 render result 相关类型。

#### 变化

新增公开类型：

```ts
interface WasmInitOptions {
  wasmUrl?: string | URL;
  fetch?: typeof globalThis.fetch;
}

interface RenderOptions {
  theme?: Partial<RenderTheme>;
  layoutConfig?: Partial<LayoutConfig>;
  wasm?: WasmInitOptions;
}

interface XMermaidDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  range: null;
  featureId?: string;
}

interface RenderResult {
  diagramType: DiagramType;
  diagnostics: XMermaidDiagnostic[];
  dimensions: Dimensions;
  svg: SVGSVGElement;
}
```

新增公开方法：

```ts
class XMermaid {
  render(input: string): Promise<void>;
  renderToSVGElement(input: string, options?: RenderOptions): Promise<RenderResult>;
  renderToSVGString(input: string, options?: RenderOptions): Promise<string>;
}
```

示例：

```ts
const renderer = new XMermaid({ container });
const result = await renderer.renderToSVGElement('graph TD\n  A-->B');
result.svg instanceof SVGSVGElement; // true
result.diagramType; // 'flowchart'

const svg = await renderer.renderToSVGString('graph TD\n  A-->B');
svg.startsWith('<svg'); // true
```

### 2.2 编排层

```mermaid
flowchart TD
  A[renderToSVGElement(input, options)] --> B[initWasm]
  B --> C[wasm render/render_with_config]
  C --> D[normalize WASM enum payload]
  D --> E[SVGRenderer.render(layout)]
  E --> F[RenderResult]
  G[render(input)] --> A
  G --> H[replace container children]
  I[renderToSVGString(input, options)] --> A
  I --> J[XMLSerializer.serializeToString]
```

#### 现状

渲染管线嵌在 `render(input)` 里，导致 DOM replacement、WASM 调用、payload 归一化和 SVG 创建耦合在同一个方法中。

#### 变化

- `renderToSVGElement()` 承担主渲染管线并返回 `RenderResult`。
- `render()` 调用 `renderToSVGElement()`，再执行 container replace。
- `renderToSVGString()` 调用 `renderToSVGElement()`，再用 `XMLSerializer` 序列化。
- `diagramType` 先取 `analyzeSupport(input).diagramType`；后续 structured diagnostics 可替换为更精确来源。

流程级约束：

- `render()` 仍返回 `Promise<void>`，且仍清空并替换 constructor container。
- `renderToSVGElement()` 不修改 constructor container。
- `renderToSVGString()` 不额外调用 WASM 第二次。
- `RenderResult.diagnostics` 成功路径当前为空数组；失败路径抛 `XMermaidError`。
- 单次 `RenderOptions` 不改变实例 `setTheme()` 和 constructor layoutConfig 状态。

### 2.3 挂载点清单

- `src/xmermaid.ts`：新增方法和共享渲染管线。
- `src/types/options.ts`：新增 render API 公开类型。
- `src/index.ts`：导出新类型。
- `tests/xmermaid.test.ts`：覆盖新 API、旧 `render()` 行为和失败语义。
- `scripts/consumer-smoke.cjs`：消费者 typecheck smoke 引用新类型和方法。

### 2.4 推进策略

1. RED 测试：新增 `renderToSVGElement` / `renderToSVGString` / consumer typecheck API 期望。
   退出信号：目标测试因方法或类型缺失失败。
2. 名词层实现：新增 RenderOptions / RenderResult / XMermaidDiagnostic / WasmInitOptions 类型并导出。
   退出信号：typecheck 能识别类型。
3. 编排实现：抽共享渲染管线，新增 element/string API，保留 `render()` DOM replacement。
   退出信号：目标单测通过。
4. 发布门禁接入：consumer smoke typecheck 引用新 API，确认 packed declarations 可用。
   退出信号：`npm run build && npm run smoke:consumer -- --json` 通过。
5. 回归验证：跑相关单测、全量 JS 测试、typecheck、build、consumer smoke。
   退出信号：验证命令全部通过。

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `src/xmermaid.ts`：当前方法短但渲染管线和 DOM replacement 混在一起；本 feature 需要抽私有 helper，但仍留在同文件，避免 API 横切扩散。
- 文件级 — `src/types/options.ts`：当前只放 `XMermaidOptions`，新增 RenderOptions/RenderResult 仍属 SDK option/result 合同，可暂时共存。
- 目录级 — `src/types/`：已有 options/layout/theme/error 分层，新增单个 render result 类型不需要新目录。

##### 结论：不做微重构

本 feature 只需要在 `XMermaid` 内部抽共享渲染方法，不做文件搬迁或 renderer/layout 重组。若后续 structured diagnostics 增长，应另拆 diagnostics 类型文件。

## 3. 验收契约

关键场景：

- **S1**：调用 `renderToSVGElement('graph TD\n  A-->B')` → 返回 `RenderResult`，包含 SVG element、dimensions、`diagramType: 'flowchart'` 和空 diagnostics。
- **S2**：调用 `renderToSVGString('graph TD\n  A-->B')` → 返回以 `<svg` 开头且包含 `xmermaid-diagram` 的字符串。
- **S3**：调用现有 `render(input)` → 仍清空并替换 constructor container，返回 `undefined`。
- **S4**：调用 `renderToSVGElement(input, { layoutConfig })` → 使用 `render_with_config`，但不修改实例后续无 options 调用。
- **S5**：WASM 抛 unsupported diagram error → 新 API 和旧 `render()` 都抛 `XMermaidError('UNSUPPORTED_DIAGRAM')`。
- **S6**：packed consumer typecheck 能 import `RenderOptions` / `RenderResult` 并调用新方法。

反向核对项：

- 不新增 PNG/canvas/blob export。
- 不实现 custom wasm URL 加载。
- 不改变 `render(input): Promise<void>` 行为。
- 不新增 diagram/parser/renderer 支持能力。

## 4. 与项目级架构文档的关系

本 feature 新增公开 SDK 渲染输出合同。acceptance 阶段需要把 `renderToSVGElement()`、`renderToSVGString()`、`RenderResult`、成功路径 diagnostics 为空和失败路径抛 `XMermaidError` 写入 `ARCHITECTURE.md` 当前生产支持合同 / Flowchart 解耦合同相关位置，并回写 production-readiness roadmap。
