# xmermaid 设计方案

> 基于 Rust WASM 实现的高性能 Mermaid Web 渲染工具

## 项目定位

**xmermaid** 是一个完全兼容 Mermaid DSL 语法的下一代图表渲染引擎，旨在解决现有 mermaid.js 在渲染速度、内存占用、解析速度和加载时间四个维度的性能问题。

### 核心目标

- **渲染速度** — 加速大型/复杂图表渲染
- **内存占用** — 更轻量的内存消耗，支持图表密集场景
- **解析速度** — DSL 文本解析速度提升 2-5 倍
- **加载时间** — WASM 模块体积更小，初始下载更快

### 使用场景

1. **单页面嵌入** — 文档/博客中嵌入图表
2. **图表密集型应用** — 如 Notion 类工具，单页面 10-50 个图表
3. **实时编辑器** — 类似 Mermaid Live Editor，快速预览更新
4. **批量生成** — 服务端/CLI 批量渲染大量图表为 SVG/PNG

---

## 整体架构

xmermaid 采用四层模块化架构，各层独立可替换：

```
┌─────────────────────────────────────────────────┐
│                   应用层                          │
│  (Web SDK / CLI / Server SDK / Editor SDK)      │
├─────────────────────────────────────────────────┤
│                   渲染层                          │
│  (SVG Renderer / Canvas Renderer / PNG Export)  │
│                   [JS + WASM]                     │
├─────────────────────────────────────────────────┤
│                   布局层                          │
│  (Graph Layout / Diagram Layout / Coordinate)   │
│                   [纯 WASM]                       │
├─────────────────────────────────────────────────┤
│                   解析层                          │
│  (DSL Parser / AST Builder / Validator)         │
│                   [纯 WASM]                       │
└─────────────────────────────────────────────────┘
```

**核心设计原则：**

- 解析层和布局层完全用 Rust/WASM 实现，最大化性能优势
- 渲染层在 JS 中实现，充分利用浏览器 DOM/Canvas API
- 各层独立可替换，支持不同应用场景的组合使用
- 插件机制在渲染层扩展，用户可添加自定义图表渲染器

### 当前 Flowchart 解耦合同

当前已落地的 flowchart 主链路是 `parser -> layout -> renderer` 的类型合同：parser 输出纯 AST，layout 接收 AST 与 `LayoutConfig` 并返回 `LayoutResult`，renderer 只消费 `LayoutResult` 与 `RenderTheme` 生成 SVG。布局层不依赖 DOM，渲染层不再重新执行图布局。

`LayoutConfig` 是布局输入合同，包含节点尺寸、水平/垂直间距、padding 和方向。WASM `render_with_config(input, configJson)` 支持 partial config：未传方向时根据 DSL 方向补默认值，显式传 `direction` 时以 config 为准。

`LayoutResult` 包含 `nodes`、`edges` 和 `dimensions`。每个 `LayoutNode` 提供 `center`、`bounds`、`shape`、`label`；每个 `LayoutEdge` 提供中心点 `waypoints`、标签位置、边样式，以及 geometry v1 显式字段：`source_boundary`、`target_boundary`、`path_end`、`final_tangent_angle`、`label_anchor`。Renderer 优先使用 geometry v1 字段绘制 arrow tip、stroke endpoint 和 label anchor；缺字段时回退到 TS `computeEdgePath`。

SVG renderer 的主题合同是 `RenderTheme`，当前内置 `DEFAULT_THEME`、`DARK_THEME`、`MINIMAL_THEME`。主题控制颜色、箭头样式、曲线样式、edge gap、arrow size、圆角和字体。`XMermaidOptions` 暴露 `theme` 与 `layoutConfig`，`XMermaid.render()` 负责 WASM 初始化、布局调用、WASM enum 归一化和 DOM 替换。

公开 SDK 现在同时提供容器替换路径和可复用 SVG 输出路径。`XMermaid.render(input): Promise<void>` 保持兼容：清空 constructor 传入的 container 并插入 SVG。`XMermaid.renderToSVGElement(input, options?)` 是主输出 API，返回 `RenderResult`，包含 `diagramType`、`diagnostics`、`dimensions` 和 `svg: SVGSVGElement`；成功渲染 partial flowchart 时，support analyzer 发现的 unsupported syntax 会以 warning diagnostics 返回，unsupported diagram family 会在调用 WASM 前抛 `XMermaidError('UNSUPPORTED_DIAGRAM')`。`XMermaid.renderToSVGString(input, options?)` 是 element API 的序列化包装，不另走第二套渲染逻辑。`RenderOptions` 支持单次 `theme` 与 `layoutConfig`，并保留 `WasmInitOptions` 类型边界给后续自定义 WASM 加载；当前 loader 行为未改变。

`src/types/diagnostics.ts` 是 SDK、错误对象、live editor 和 repair engine 共享的诊断合同。`XMermaidDiagnosticCode` 当前覆盖 `parse_error`、`unsupported_diagram_type`、`unsupported_syntax`、`layout_error`、`render_error`、`wasm_init_error` 以及后续 security policy 预留的 `security_blocked_url`、`security_blocked_html`、`security_blocked_click`。`SourceRange` 使用 JS string offset，line/column 为 1-based，endOffset/endColumn 为 exclusive。`XMermaidError` 仍保留 `code` 与 `details`，并新增 `diagnostics: XMermaidDiagnostic[]`；WASM parse/layout/render/init 失败会被归一化为相同诊断对象。Rust parser 当前没有输出结构化 offset/column，所以这类 WASM 错误的 diagnostic range 为 `null`，不从 message 中伪造 token 位置。

生产默认安全策略由 `src/security.ts` 定义并通过 root API 导出 `DEFAULT_SECURITY_POLICY`、`SecurityLevel`、`SecurityPolicy`。默认 `securityLevel` 是 `strict`：不可信 Mermaid input 中的 `click` callback/link、HTML label 和不在 allowlist 中的 URL protocol 会在 render preflight 阶段产生 `security_blocked_click`、`security_blocked_html`、`security_blocked_url` error diagnostics，并在调用 WASM 前阻断渲染。`loose` 只放宽 click/HTML 的 security blocking，让它们回到普通 unsupported syntax warning；危险 URL 仍然阻断。当前 allowlist 为 `http:`、`https:`、`mailto:`。v1 只做 source-level diagnostics，不执行 click callback，不把 HTML label 当 HTML 渲染，也不实现 sanitizer、CSP 或 sandbox。

---

## 解析层设计

**职责：将 Mermaid DSL 文本转换为结构化 AST**

```
输入: "graph TD\n  A-->B\n  B-->C"
输出: DiagramAST { type: "flowchart", nodes: [...], edges: [...] }
```

### 核心模块

| 模块 | 功能 | 说明 |
|------|------|------|
| `Lexer` | 词法分析 | 识别 DSL 语法元素（关键字、标识符、箭头、标签等） |
| `Parser` | 语法分析 | 构建 AST，处理嵌套结构、子图、样式定义 |
| `Validator` | 语义验证 | 检查语法错误、不支持的特性，生成错误信息 |
| `AST Normalizer` | AST 标准化 | 统一不同图表类型的 AST 结构，便于下游处理 |

### 支持的图表类型（15+ 种）

**核心图表：**
- flowchart / graph
- sequenceDiagram
- classDiagram
- stateDiagram
- erDiagram

**扩展图表：**
- gantt
- pie
- mindmap
- timeline
- kanban
- gitgraph
- journey
- quadrant
- requirement
- treemap
- block

### 技术选型

- Rust 解析器框架：`nom`（组合子解析器）或手写递归下降解析器
- AST 用 Rust 结构体表示，通过 `serde` 序列化为 JS 可用的 JSON

### 性能目标

- 解析速度：比 mermaid.js 快 2-5 倍
- 支持 streaming 解析（大图表增量处理）

---

## 布局层设计

**职责：根据 AST 计算各元素的坐标位置**

```
输入: DiagramAST { nodes: [A, B, C], edges: [...] }
输出: LayoutResult { positions: {A: {x,y}, B: {x,y}}, dimensions: {width, height} }
```

### 核心模块

| 模块 | 功能 | 说明 |
|------|------|------|
| `GraphLayoutEngine` | 图结构布局 | flowchart、class、state 等图结构，处理节点定位、边路径 |
| `SequenceLayout` | 时序图布局 | 特殊的垂直布局，处理生命线、消息箭头 |
| `TimelineLayout` | 时间轴布局 | gantt、timeline 等时间相关的水平布局 |
| `GeometryUtils` | 几何计算 | 线段交叉检测、箭头路径计算、文本尺寸估算 |
| `ConstraintSolver` | 约束求解 | 处理对齐、间距、避免重叠等布局约束 |

### 布局算法策略

**流程图/图结构：**
- 改进的分层布局算法（类似 dagre）
- 支持方向：TB/TD（从上到下）、BT（从下到上）、LR/RL（从左到右/从右到左）
- 子图嵌套布局支持

**时序图：**
- 垂直生命线 + 水平消息
- 处理：参与者顺序、消息序号、激活框位置、循环/条件框嵌套

**特殊图表：**
- gantt：水平时间轴 + 任务条
- mindmap：树状放射布局
- pie：圆形分布

### 技术选型

- 使用 Rust 的几何计算库处理坐标运算
- 可选集成 `petgraph` 作为图数据结构基础

### 性能目标

- 1000+ 节点图表布局计算在 100ms 内完成
- 支持增量布局更新（节点变化时局部重算）

---

## 渲染层设计

**职责：将布局结果转换为可视化输出（SVG/Canvas/PNG）**

```
输入: LayoutResult + DiagramAST
输出: SVG DOM / Canvas 绘制 / PNG 二进制
```

### 核心模块

| 模块 | 功能 | 技术栈 |
|------|------|--------|
| `SVGRenderer` | SVG 渲染 | JS + DOM API，生成 SVG 元素树 |
| `CanvasRenderer` | Canvas 渲染 | JS + Canvas 2D API，高性能批量绘制 |
| `PNGExporter` | PNG 导出 | WASM + Canvas toBlob，支持高分辨率 |
| `StyleEngine` | 样式处理 | JS，处理主题、自定义样式、CSS 类 |
| `InteractionHandler` | 交互处理 | JS，处理点击、悬停、拖拽等用户交互 |

### SVG 渲染器特点

- 输出标准 SVG DOM，可被 CSS 样式化
- 支持主题切换（default、dark、forest、neutral 等）
- 每个 node/edge 有唯一 ID，便于 JS 操作
- 支持响应式缩放（viewBox 设置）

### Canvas 渲染器特点

- 高性能批量渲染，适合图表密集场景
- 内存占用更低，适合长时间运行的页面
- 支持离屏渲染，减少主线程压力
- 输出为 bitmap，不支持 DOM 操作和 CSS 样式

### PNG 导出流程

1. 渲染到 Canvas（可指定高分辨率倍数）
2. WASM 端处理图像数据（可选压缩优化）
3. 导出为 PNG Blob/File

### 插件扩展点

- 自定义渲染器：用户可注册新的图表类型渲染逻辑
- 自定义样式：提供样式定义 API，扩展主题系统
- 自定义交互：支持为特定元素添加交互行为

---

## 应用层设计

**职责：面向不同使用场景的 SDK/API 封装**

### Web SDK（浏览器端）

```typescript
import { XMermaid } from 'xmermaid';

const xm = new XMermaid({
  renderer: 'svg',
  theme: 'default'
});

// 渲染到 DOM
xm.render('graph TD\n  A-->B', document.getElementById('container'));

// 获取 SVG/Canvas 输出
const svg = xm.renderToSVG('graph TD\n  A-->B');
const canvas = xm.renderToCanvas('graph TD\n  A-->B');
const png = xm.exportPNG('graph TD\n  A-->B', { scale: 2 });
```

### CLI SDK（命令行工具）

```bash
# 单文件渲染
xmermaid render input.mmd -o output.svg

# 批量渲染
xmermaid batch ./diagrams/ -o ./output/ --format png --scale 2

# Markdown 文件中提取并渲染
xmermaid extract README.md -o ./images/
```

### Server SDK（Node.js 端）

```javascript
import { XMermaidServer } from 'xmermaid/server';

const xm = new XMermaidServer();

app.post('/render', async (req, res) => {
  const svg = await xm.renderSVG(req.body.dsl);
  res.send(svg);
});
```

### Editor SDK（实时编辑器）

```typescript
import { XMermaidEditor } from 'xmermaid/editor';

const editor = new XMermaidEditor({
  container: '#editor',
  preview: '#preview',
  syncDelay: 100
});

editor.on('rendered', (result) => {
  console.log('渲染完成', result.duration);
});
```

### 当前静态 Live Editor MVP

源码中当前已落地一个轻量应用层入口 `XMermaidLiveEditor`（`src/editor/index.ts`），并通过 `src/index.ts` 公开导出。它不是完整 Editor SDK，而是无后端静态 live editor 工作台：`extractDiagrams(text)` 从 Markdown fenced block 或纯 Mermaid 文本抽取 flowchart 图表，编辑器维护 document text、diagram list、selected diagram source、toolbar state、diagnostics 和 visual edit panel，并把选中源码交给现有 `XMermaid.render()` 生成 SVG preview。

`DiagramBlock.range` 是安全回写合同：Markdown fence 模式下指向 fence 内部源码区域，raw Mermaid 模式下指向 trim 后源码区域，offset 使用 JS string offset 且 `endOffset` 为 exclusive。`replaceDiagramSource(text, diagramId, nextSource, document)` 是 selected source edit、repair apply 和 visual edit 共享的单图替换入口；它只替换 matched diagram 的 range，保留文档上下文，替换后重新 `extractDiagrams`，找不到 id 时返回原文并追加 `diagram_not_found` diagnostic。

Preview diagnostics use the same `XMermaidDiagnostic` / `SourceRange` contract as the SDK. The default live editor render path calls `renderToSVGElement()` so successful partial renders can still show `unsupported_syntax` warnings while preserving the SVG preview. Render failures prefer diagnostics carried by `XMermaidError.diagnostics`; when no structured diagnostic exists, the editor falls back to a single diagnostic with the selected `DiagramBlock.range`. `XMermaidError` codes map to `parse_error`, `layout_error`, `render_error`, `wasm_init_error`, or `unsupported_diagram_type`, and unsupported diagram errors must not be presented as parse errors. The live editor sequences async renders so stale slow requests cannot overwrite a newer preview/diagnostic state; render failures keep the last successful preview visible and add an error state.

Syntax repair is local and deterministic. `suggestRepairs(source, diagnostics)` returns `RepairSuggestion` records for high-confidence fixes such as adding a missing `flowchart TD` header, correcting common direction typos, replacing common arrow typos, and closing simple label brackets. `applyRepair(source, suggestion)` prefers an exact `SourceRange` replacement when supplied and falls back to the first exact `before` fragment for legacy suggestions; unsupported diagram diagnostics produce a low-confidence hint and no one-click rewrite. There is no LLM or network repair path in the current system.

`src/editor/share.ts` 提供 browser-only 分享和导出工具：`encodeShareState` / `decodeShareState` 使用 URL hash 保存本地 document text 和 selected diagram id；`XMermaidLiveEditor` mount 时优先从有效 `#xm=` hash 恢复 document text 和 selected diagram。`exportDiagram` 使用当前 preview SVG 导出 SVG 或通过 canvas 导出 PNG，不重新渲染。

`src/editor/flowchart.ts` 提供 flowchart visual edit 的 AST-backed graph model 合同。可信入口是 `analyzeFlowchartForVisualEdit(source, options?)`：默认通过 `initWasm()` + `getWasm().parse_dsl()` 调用 Rust/WASM parser，把 `FlowchartAst` 转为 `FlowchartGraphModel`；测试或宿主可注入等价 `parseDsl` 函数。`FlowchartGraphModel` 保留 direction、node `shape`、edge `style`、edge label、`min_length` 和 `subgraphs`，`applyVisualEdit(model, edit)` 只做纯 model 变换，`serializeFlowchart(model)` 输出规范 Mermaid 片段并保留当前支持的 shape/style/subgraph 语义。`parseFlowchartToGraph(source)` 仍保留为 legacy/simple helper，但 live editor visual rewrite 不再把它当语义权威。

Live editor 的 visual edit path 是异步编排：analysis 成功后应用 edit、serialize next source，再用 `validateVisualEditResult(nextSource, options?)` 做 parser-level validation；失败时显示 `visual_parse_failed` / `visual_roundtrip_failed` diagnostics 并保留原 source。`analyzeFlowchartForVisualEdit()` 先复用 production support analyzer `detectUnsupportedFeatures(source)` 做 safety gate；命中当前 support matrix 声明 unsupported 的 flowchart syntax 时返回 `read-only` + `visual_unsupported_syntax`，不构造 graph model、不执行 rewrite。因为 analysis/validation 走 async parser，`XMermaidLiveEditor` 串行化 visual edit 操作，保证连续点击 add node / add edge 时按用户操作顺序反写。

方向控制分成两条路径：toolbar 的 `data-xm-layout-direction` select 是 preview-only layout override，只影响下一次 render request 的 `layoutConfig.direction`，不修改 selected source 或 document text；`data-xm-apply-source-direction` button 才触发 source direction edit，复用同一 AST-backed analysis/validation/replace pipeline。`validateVisualEditResult()` 在 parse 成功且 AST type 为 flowchart 后还会执行 render/layout validation；失败时返回 `visual_render_failed` 并阻断 source commit。`tests/visual-roundtrip.test.ts` 是 visual edit 的真实 WASM 合同测试：直接初始化 `pkg/xmermaid_wasm.js` + `pkg/xmermaid_wasm_bg.wasm`，验证 supported shape/style/label rename、subgraph rename、source direction edit 都能重新 parse/render，并验证 `classDef` 这类 blocked unsupported syntax 不产生 rewrite。当前仍只支持选中 flowchart，不保留原始注释、空白或格式。

示例入口是 `examples/live-editor.html`。页面直接加载构建后的 `dist/xmermaid.esm.js`，提供文档输入、多图列表、选中源码编辑区、预览区域、diagnostics/repair panel、toolbar、主题/方向控制、复制、SVG/PNG 导出、URL hash 分享和表单式 visual editor。

### 当前生产支持合同

源码中当前已落地 `src/support.ts`，并通过 `src/index.ts` 公开导出 `getSupportMatrix()`、`getDiagramSupport(diagramType)` 和 `analyzeSupport(source)`。这组 API 是生产发布合同的机器可读入口：它描述当前支持范围，而不是增加新的 parser/render 能力。

当前合同把 `flowchart` 标为 `partial`：基础 `graph` / `flowchart` 声明、基础节点和有向边、常见标签、核心 shape 和部分 subgraph parse 属于支持范围；`class`、`classDef`、`style`、`click`、HTML label 和 Markdown label 明确列为 unsupported 或 partial。`sequenceDiagram`、`classDiagram`、`stateDiagram`、`erDiagram`、`gantt`、`pie` 和 `mindmap` 当前仍是 unsupported diagram family。

`analyzeSupport(source)` 仍不替代 Rust parser，但现在会携带 `unsupportedFeatures`。`detectUnsupportedFeatures(source)` 是轻量 production support analyzer：unsupported diagram family 返回 `diagram.*` feature，flowchart 中的 `class`、`classDef`、`style`、`click`、HTML label 和 Markdown label 返回对应 `flowchart.*` feature。`SupportSourceRange` 使用 JS string offset，line/column 为 1-based，endOffset/endColumn 为 exclusive。Analyzer 只读 source，不调用 WASM，不修改 render path；它的 feature id 必须映射到 support matrix 的 unsupported syntax id，后续 diagnostics/runtime 只能消费这些结构化输出，不能靠字符串猜。

发布门禁现在包含 packed consumer smoke 和 docs support matrix sync。`scripts/verify-release.cjs` 的默认矩阵在 `npm run build` 之后执行 `consumer-pack-install`，命令为 `npm run --silent smoke:consumer -- --json`。该 gate 由 `scripts/consumer-smoke.cjs` 负责：在临时目录运行 `npm pack`、校验 tarball 中存在 `dist/index.d.ts`、`dist/support.d.ts`、ESM/CJS bundle、`dist/xmermaid_wasm_bg.wasm`、README 和 package metadata，再把 tarball 安装进临时消费者项目执行 TypeScript typecheck、root ESM import smoke，并通过 headless Chrome 加载 installed package 的 ESM bundle 与 WASM asset 渲染最小 flowchart SVG。JSON summary 记录 package size 和 browser render duration；第一阶段只记录基线，不设硬阈值。

`docs-support-matrix-sync` 命令为 `node scripts/verify-release.cjs --check-docs`，在默认矩阵中紧跟 `consumer-pack-install`。它读取 `README.md`、`package.json` 和 `docs/production-release-checklist.md`，检查 package description 仍声明 flowchart/partial，README 仍说明 partial Mermaid support、unsupported diagram families、diagnostics、默认 strict security、consumer smoke 和 Chrome/`CHROME_BIN`，并检查 release checklist 列出默认矩阵所有 command id。该 gate 不跑 build/test，不访问网络，只防止生产承诺和机器可读支持合同漂移。

消费者类型声明不能泄漏 `pkg/` 构建目录。`src/wasm.ts` 对外导出 `XMermaidWasmModule` 作为 WASM wrapper 的稳定 TypeScript 边界，`dist/wasm.d.ts` 不再引用 `../pkg/xmermaid_wasm`。root ESM bundle 允许被 Node/SSR/构建工具解析，但不承诺在 Node 环境执行 DOM 渲染；SVG renderer 的 canvas measurement 因此只能懒访问 `document`，不能在模块加载期触碰 browser globals。

packed consumer smoke 的 TypeScript fixture 会 import `RenderOptions`、`RenderResult`、`WasmInitOptions`、`XMermaidDiagnosticCode`、`XMermaidDiagnostic` 和 `SourceRange`，并调用 `renderToSVGElement()` / `renderToSVGString()`，因此新 SVG API 与 diagnostics 声明必须随 `dist/index.d.ts` 正确进入 tarball。

packed consumer smoke 的 TypeScript fixture 也会 import `DEFAULT_SECURITY_POLICY`、`SecurityLevel`、`SecurityPolicy` 并把 `securityPolicy` 传入 `RenderOptions`，因此安全策略公开类型和值必须随 package declarations 发布。

---

## 工程证据治理

项目使用 CodeStable 文档作为长期工程证据来源，`.codestable/roadmap/**`、`.codestable/features/**`、`.codestable/audits/**`、`.codestable/architecture/**` 和 `.codestable/reference/**` 属于应提交的规格与验收材料。

本地 agent/session 状态和可再生成缓存不属于架构事实来源：`.omx/**` 归为 private log，`.codegraph/**` 归为 runtime cache。临时截图和根目录 `cdp-*` 浏览器诊断脚本默认不提交；只有被提升为明确 baseline、fixture 或维护脚本后才进入仓库。具体路径策略见 `docs/evidence-governance.md`。

---

## Layout / Renderer Edge Geometry Contract

布局层现在为每条 `LayoutEdge` 输出 versioned geometry v1 字段：`source_boundary`、`target_boundary`、`path_end`、`final_tangent_angle`、`label_anchor` 和 `geometry_version`。`target_boundary` 表示箭头尖端落在目标节点边界的点，`path_end` 表示可见 stroke 结束点，二者不能被混用。

SVG renderer 的消费顺序是：完整 `geometry_version=1` 字段存在时优先使用 explicit geometry；缺字段或旧 payload 时回退到 `waypoints` + node bounds 的现有 `computeEdgePath` 计算。label 定位优先级为 `label_anchor` → `label_position` → path fallback。

SVG 几何行为由 `tests/edge.test.ts`、`tests/renderer.test.ts` 和 `tests/svg-geometry-regression.test.ts` 共同守护。新增 regression suite 使用 jsdom 断言实际 SVG DOM，覆盖复杂 path、中间 routing point、label fallback、diamond/circle/stadium boundary truncation 和五种 arrow style 的 DOM 形态。截图仍按 `docs/evidence-governance.md` 默认不提交。

---

## 插件系统设计

**职责：支持用户扩展图表类型和渲染能力**

### 插件类型

| 类型 | 功能 | 用户能力 |
|------|------|----------|
| **JS Plugin** | 渲染扩展 | 用 JS 实现新图表的渲染逻辑 |
| **DSL Extension** | 语法扩展 | 定义新 DSL 语法规则 + AST 结构 |
| **Style Plugin** | 主题扩展 | 定义新主题、自定义样式映射 |

### JS 插件机制

```typescript
XMermaid.registerPlugin({
  name: 'my-custom-diagram',
  type: 'renderer',

  render: (ast, layout, container) => {
    // 用户自定义渲染逻辑
  },

  layout: (ast) => {
    // 自定义布局（可选）
  },

  defaultStyle: {
    nodeColor: '#4A90D9',
    edgeColor: '#333'
  }
});
```

### DSL 扩展机制

```typescript
XMermaid.registerDSLExtension({
  name: 'my-syntax',

  grammar: {
    keyword: 'MYGRAPH',
    rules: [
      'MYGRAPH direction',
      'node definition: ID [label]',
      'edge definition: A --> B'
    ]
  },

  astTransform: (tokens) => {
    // 将解析的 tokens 转换为 AST 结构
  },

  renderer: 'my-custom-diagram'
});
```

### 内置插件示例

- `xmermaid-plugin-math`：支持数学公式渲染（集成 KaTeX）
- `xmermaid-plugin-icons`：支持图标库（FontAwesome 等）
- `xmermaid-plugin-interactive`：增强交互能力（拖拽节点、折叠子图）

### 插件生命周期

```
注册 → 验证 → 初始化 → 加载 → 激活 → 使用 → 卸载
```

---

## 错误处理与日志系统

**职责：提供清晰的错误信息，便于用户调试**

### 错误类型

| 错误类型 | 来源 | 用户可见信息 |
|---------|------|-------------|
| **SyntaxError** | 解析层 | 行号、列号、预期语法 |
| **ValidationError** | 解析层 | 不支持的特性、缺失元素 |
| **LayoutError** | 布局层 | 节点/边 ID、约束冲突原因 |
| **RenderError** | 渲染层 | 资源加载失败、内存不足 |
| **PluginError** | 插件层 | 插件名称、具体错误信息 |

### 错误信息结构

```typescript
interface XMermaidError {
  code: string;           // 如 'PARSE_SYNTAX_001'
  type: 'syntax' | 'validation' | 'layout' | 'render' | 'plugin';
  message: string;
  location?: {
    line: number;
    column: number;
    snippet: string;
  };
  suggestion?: string;
  context?: object;
}
```

### 错误提示示例

```
❌ Syntax Error [PARSE_SYNTAX_001]

  Line 3, Column 8:
  │  A ==> B
  │        ↑

  Unexpected token '==>'. Expected '-->', '---', or '--'.

  Suggestion: Use '-->' for arrow connection:
  │  A --> B
```

### 性能监控

```typescript
const result = xm.render('graph TD\n  A-->B');

console.log(result.performance);
// {
//   parse: { duration: 2, units: 'ms' },
//   layout: { duration: 15, units: 'ms' },
//   render: { duration: 8, units: 'ms' },
//   total: { duration: 25, units: 'ms' }
// }
```

---

## 测试策略

### 测试层次

| 层次 | 测试内容 | 工具 |
|------|---------|------|
| **单元测试** | 各模块内部逻辑正确性 | Rust: `cargo test`，JS: `vitest` |
| **集成测试** | 跨层协作、API 正确性 | `wasm-bindgen-test` |
| **兼容性测试** | 与 mermaid.js 输出对比 | 视觉对比工具 |
| **性能测试** | 各阶段耗时、内存占用 | Benchmark suite |
| **浏览器测试** | 多浏览器兼容性 | Playwright |

### 兼容性测试策略

- 建立测试用例库：收集 100+ 真实 mermaid 图表
- 视觉对比：确保渲染结果视觉一致（95% 相似度）
- AST 对比：确保解析输出语义一致

---

## 构建与发布策略

### 输出产物

| 产物 | 格式 | 使用场景 | 目标大小 |
|------|------|---------|---------|
| **xmermaid.wasm** | WASM 模块 | Web/Node.js | < 500KB（gzip） |
| **xmermaid.js** | JS SDK | Web 前端 | < 50KB（gzip） |
| **xmermaid.esm.js** | ES Module | 现代打包工具 | < 50KB（gzip） |
| **xmermaid/server.js** | Node.js 模块 | 服务端渲染 | 包含 WASM inline |
| **xmermaid-cli** | 可执行二进制 | CLI 工具 | < 5MB |

### WASM 构建优化

- LTO（Link Time Optimization）启用
- `panic = abort` 减小二进制体积
- 只导出必要的 JS 绑定函数
- 使用 `wasm-opt` 和 `wasm-gc` 优化

### 发布渠道

| 渠道 | 内容 |
|------|------|
| **npm** | Web SDK、Server SDK |
| **crates.io** | Rust 核心库 |
| **GitHub Releases** | CLI 二进制、源码 |
| **CDN** | WASM + JS 文件 |

---

## 技术栈选型

### Rust 侧依赖

| 依赖 | 用途 |
|------|------|
| `wasm-bindgen` | WASM/JS 桥接 |
| `serde` + `serde_json` | 数据序列化 |
| `nom` | DSL 解析（组合子解析器） |
| `petgraph` | 图数据结构 |
| `thiserror` | 错误类型定义 |

可选：
- `rayon`：并行计算
- `wee_alloc`：WASM 专用内存分配器

### JavaScript 侧依赖

| 依赖 | 用途 |
|------|------|
| TypeScript | 类型系统 |
| Vitest | 单元测试 |
| Rollup / Vite | 打包工具 |
| Playwright | 浏览器测试 |

### 构建工具链

| 工具 | 用途 |
|------|------|
| `cargo` | Rust 编译管理 |
| `wasm-pack` | WASM 打包与 npm 发布 |
| `wasm-opt` | WASM 二进制优化 |
| GitHub Actions | CI/CD 自动化 |

---

## API 设计

### Core API

```typescript
class XMermaid {
  constructor(options?: XMermaidOptions);

  render(dsl: string, container: HTMLElement): Promise<RenderResult>;
  renderToSVG(dsl: string): Promise<string>;
  renderToCanvas(dsl: string, options?: CanvasOptions): Promise<HTMLCanvasElement>;
  exportPNG(dsl: string, options?: ExportOptions): Promise<Blob>;
  parse(dsl: string): Promise<ParseResult>;
  layout(ast: DiagramAST): Promise<LayoutResult>;
  destroy(): void;
}
```

### Config API

```typescript
interface XMermaidOptions {
  renderer: 'svg' | 'canvas' | 'auto';
  theme: 'default' | 'dark' | 'forest' | 'neutral' | 'custom';
  themeConfig?: ThemeConfig;
  securityLevel: 'loose' | 'strict';
  performance: {
    streaming: boolean;
    incremental: boolean;
    cacheSize: number;
  };
  plugins?: PluginConfig[];
}
```

### Plugin API

```typescript
interface PluginDefinition {
  name: string;
  version: string;
  type: 'renderer' | 'dsl-extension' | 'style' | 'interactive';

  render?: (ast, layout, options) => RenderOutput;
  layout?: (ast) => LayoutResult;
  grammar?: GrammarDefinition;
  astTransform?: (tokens) => DiagramAST;
  styles?: StyleDefinition;

  hooks?: {
    beforeParse?: (dsl) => string;
    afterParse?: (ast) => DiagramAST;
    beforeLayout?: (ast) => void;
    afterLayout?: (layout) => LayoutResult;
    beforeRender?: (layout) => void;
    afterRender?: (output) => RenderOutput;
  };
}
```

---

## 项目里程碑

### Phase 1：核心基础（MVP）— 2-3 月

| 任务 | 产出 | 优先级 |
|------|------|--------|
| WASM 基础框架搭建 | 编译环境、JS 桥接 | P0 |
| 解析层实现（flowchart、sequence） | DSL 解析器 | P0 |
| 布局层实现（基础布局算法） | 布局引擎 | P0 |
| SVG 渲染器 | 基础渲染 | P0 |
| Web SDK 基础 API | npm 包 | P0 |
| 单元测试框架 | 测试基础设施 | P1 |
| 文档（快速开始） | README + 示例 | P1 |

**里程碑：v0.1.0 — 支持 flowchart 和 sequence 图的 SVG 渲染**

### Phase 2：图表扩展 — 2-3 月

| 任务 | 产出 | 优先级 |
|------|------|--------|
| 解析层扩展（class、state、er、gantt） | 更多图表解析 | P0 |
| 布局算法完善 | 完整布局支持 | P0 |
| Canvas 渲染器 | 高性能渲染选项 | P1 |
| PNG 导出功能 | 图片导出 | P1 |
| 主题系统 | 样式能力 | P1 |
| 兼容性测试 | 兼容性验证 | P1 |
| CLI 工具基础版本 | 命令行工具 | P2 |

**里程碑：v0.5.0 — 支持 10+ 图表类型，双渲染器，PNG 导出**

### Phase 3：高级功能 — 2-3 月

| 任务 | 产出 | 优先级 |
|------|------|--------|
| 插件系统框架 | 扩展能力 | P0 |
| JS 插件 API | 渲染扩展 | P0 |
| DSL 扩展 API | 语法扩展 | P1 |
| 剩余图表类型 | 完整图表支持 | P1 |
| Server SDK | 服务端渲染 | P1 |
| Editor SDK | 实时编辑器 | P2 |
| 性能优化 | 性能提升 | P1 |

**里程碑：v1.0.0 — 全功能版本，所有图表类型，插件系统**

### Phase 4：生态完善 — 持续迭代

| 任务 | 产出 | 优先级 |
|------|------|--------|
| 官方文档网站 | 完整文档体系 | P0 |
| 示例画廊 | 可视化示例库 | P1 |
| 内置插件 | 官方插件 | P1 |
| VS Code 插件 | 编辑器集成 | P2 |
| Playground 网站 | 在线体验 | P2 |
| 社区贡献指南 | 开源规范 | P2 |

---

## 总结

xmermaid 是一个雄心勃勃的项目，旨在通过 Rust WASM 技术全面提升 Mermaid 图表渲染的性能。核心设计理念包括：

1. **四层模块化架构** — 解析、布局、渲染、应用各层独立可替换
2. **全面兼容 Mermaid DSL** — 用户迁移零成本
3. **双渲染模式** — SVG 和 Canvas 支持不同场景需求
4. **完整生态** — Web SDK、CLI、Server SDK、Editor SDK 四种应用形式
5. **插件系统** — JS 插件为基础，DSL 扩展为高级选项
6. **清晰错误处理** — 结构化错误信息，便于调试

预计 6-9 个月达到 v1.0.0 全功能版本。
