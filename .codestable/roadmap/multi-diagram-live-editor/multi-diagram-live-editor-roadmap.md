---
doc_type: roadmap
slug: multi-diagram-live-editor
status: active
created: 2026-05-25
last_reviewed: 2026-05-25
tags: [editor, preview, markdown, multi-diagram, visual-editing]
related_requirements: []
related_architecture: [ARCHITECTURE]
---

# Multi-Diagram Live Editor Roadmap

## 1. 背景

目标是提供一个类似 mermaid.live 的在线编辑预览工具，但面向“文档里有多个图表”的工作流：用户可以粘贴 Mermaid 代码，也可以粘贴 Markdown/文档内容，系统自动抽取多个图表，提供图表切换、实时编辑预览、错误提示、语法修复，并逐步支持可视化编辑后反向更新 Mermaid 源码。

这不是单图渲染能力，而是 xmermaid 的应用层工作台。第一阶段优先做无后端静态 MVP，验证文档多图抽取、切换和预览闭环；后续再扩展分享、导出、语法修复和可视化反写。

## 2. 范围与明确不做

### 本 roadmap 覆盖

- 静态在线 live editor：文档输入、图表抽取、图表列表、实时预览。
- 多图 source map：记录每个图表在原文中的位置，支持切换和替换。
- 错误定位与语法修复建议。
- SVG/PNG 导出、主题/布局配置、分享链接。
- Flowchart 可视化编辑 v1，并反向更新选中图表 Mermaid 片段。

### 明确不做

- 第一版不做账号、云端保存、多人协作。
- 第一版不承诺完整 Mermaid 全图表类型；以 flowchart 为主。
- 第一版视觉编辑不保证保留用户原始排版、注释和空白格式。
- 不把 LLM 修复作为基础依赖；先做确定性规则修复。
- 不做完整 Markdown WYSIWYG 编辑器，只处理文档文本中的 Mermaid 图表块。

## 3. 模块拆分（概设）

```text
multi-diagram-live-editor
├── document-extractor：从文档文本中识别 Mermaid 图表块并生成 source ranges
├── editor-state：维护文档文本、图表列表、当前选中图表、诊断和编辑模式
├── preview-runtime：调用 xmermaid 渲染选中图表并展示错误
├── repair-engine：生成语法诊断和可应用修复建议
├── visual-flowchart-editor：可视化编辑 flowchart，并生成 Mermaid 更新
├── sharing-export：导出 SVG/PNG、复制代码、URL hash 分享
└── app-shell：在线工具 UI，组合编辑器、列表、预览和工具栏
```

### document-extractor · 文档图表抽取

- **职责**：从 Markdown fenced code block 和裸 Mermaid 文本中识别图表，生成 `DiagramDocument`、`DiagramBlock` 和可替换 source range。
- **承载的子 feature**：`live-editor-static-mvp`, `diagram-source-map-contract`
- **触碰的现有代码 / 模块**：全新应用层模块；会消费现有 `XMermaid.render()` 能力。

### editor-state · 编辑器状态

- **职责**：维护原始文档文本、抽取后的图表索引、当前选中图表、实时编辑内容、诊断、修复建议和视觉编辑模式状态。
- **承载的子 feature**：`live-editor-static-mvp`, `diagram-source-map-contract`, `syntax-repair-rules-v1`, `visual-flowchart-editor-v1`
- **触碰的现有代码 / 模块**：全新应用层状态模块。

### preview-runtime · 预览运行时

- **职责**：接收选中图表源码，初始化 WASM，调用 xmermaid 渲染，并把 parse/layout/render 错误规范化为诊断结果。
- **承载的子 feature**：`live-editor-static-mvp`, `preview-diagnostics-panel`
- **触碰的现有代码 / 模块**：`src/xmermaid.ts`, `src/wasm.ts`, `src/types/error.ts`, `src/renderer/svg.ts`。

### repair-engine · 语法修复引擎

- **职责**：基于渲染诊断和源码内容生成高置信、可审查、可一键应用的修复建议。
- **承载的子 feature**：`syntax-repair-rules-v1`
- **触碰的现有代码 / 模块**：全新应用层模块；可能需要 parser 错误信息增强。

### visual-flowchart-editor · 可视化 flowchart 编辑

- **职责**：把 flowchart Mermaid 源码转换为可编辑图模型，支持有限视觉编辑，并序列化回 Mermaid 片段。
- **承载的子 feature**：`visual-flowchart-model-v1`, `visual-flowchart-editor-v1`
- **触碰的现有代码 / 模块**：parser AST、layout output、全新视觉编辑模块。

### sharing-export · 分享与导出

- **职责**：导出 SVG/PNG，复制当前图表或文档，使用 URL hash 保存可分享的本地状态。
- **承载的子 feature**：`share-export-workbench`, `online-tool-polish`
- **触碰的现有代码 / 模块**：`SVGRenderer` 输出、浏览器端导出工具。

### app-shell · 在线工具界面

- **职责**：组合文本编辑区、图表列表、预览面板、诊断/修复面板、工具栏和视觉编辑入口。
- **承载的子 feature**：`live-editor-static-mvp`, `preview-diagnostics-panel`, `share-export-workbench`, `visual-flowchart-editor-v1`, `online-tool-polish`
- **触碰的现有代码 / 模块**：全新前端应用入口。

## 4. 模块间接口契约 / 共享协议（架构层详设）

### 4.1 文档抽取协议

**方向**：app-shell / editor-state → document-extractor
**形式**：函数调用

```ts
type DiagramOrigin = 'markdown-fence' | 'raw-mermaid-block';

interface SourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
}

interface DocumentDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  range: SourceRange | null;
}

interface DiagramBlock {
  id: string;
  index: number;
  title: string | null;
  source: string;
  origin: DiagramOrigin;
  language: 'mermaid' | 'xmermaid' | null;
  range: SourceRange;
  diagramType: 'flowchart' | 'unsupported' | 'unknown';
}

interface DiagramDocument {
  text: string;
  diagrams: DiagramBlock[];
  diagnostics: DocumentDiagnostic[];
}

function extractDiagrams(text: string): DiagramDocument;
```

**约束**：

- Markdown fenced block 优先于裸 Mermaid block。
- `range` 必须指向可替换的完整图表源码区域；fence 模式只替换 fence 内部内容。
- 未识别到图表时返回空 `diagrams`，不抛异常。
- `id` 在同一次抽取结果内必须稳定唯一；跨编辑后的长期稳定性不作为 v1 合同。

### 4.2 文档回写协议

**方向**：editor-state / visual-flowchart-editor → document-extractor
**形式**：函数调用

```ts
function replaceDiagramSource(
  text: string,
  diagramId: string,
  nextSource: string,
  document: DiagramDocument,
): { text: string; document: DiagramDocument };
```

**约束**：

- 普通文本上下文必须保持不变。
- 回写后必须重新抽取 source ranges，避免旧 range 失效。
- v1 只保证替换选中图表块，不做跨图表批量重排。
- 找不到 `diagramId` 时返回原文并产生 `diagram_not_found` 诊断，不静默覆盖。

### 4.3 预览渲染协议

**方向**：editor-state → preview-runtime → xmermaid
**形式**：异步函数调用

```ts
interface RenderDiagnostic {
  code:
    | 'parse_error'
    | 'unsupported_diagram_type'
    | 'layout_error'
    | 'render_error'
    | 'wasm_init_error';
  message: string;
  severity: 'error' | 'warning';
  range: SourceRange | null;
}

interface RenderRequest {
  diagramId: string;
  source: string;
  themeId: string;
  layoutConfig?: Partial<LayoutConfig>;
}

interface RenderResult {
  diagramId: string;
  status: 'ok' | 'error';
  svg?: SVGSVGElement;
  diagnostics: RenderDiagnostic[];
}

async function renderDiagram(request: RenderRequest): Promise<RenderResult>;
```

**约束**：

- 渲染失败不得清空上一张成功预览，UI 层可以保留 stale preview 并显示错误态。
- 所有错误必须进入 `diagnostics`，不能只写 console。
- `unsupported_diagram_type` 不能伪装成 parse error；它决定后续修复建议是否可生成。

### 4.4 语法修复协议

**方向**：preview-runtime / editor-state → repair-engine
**形式**：函数调用

```ts
interface RepairSuggestion {
  id: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  range: SourceRange | null;
  before: string;
  after: string;
  reason: string;
}

function suggestRepairs(source: string, diagnostics: RenderDiagnostic[]): RepairSuggestion[];
function applyRepair(source: string, suggestion: RepairSuggestion): string;
```

**v1 修复范围**：

- 缺少 `graph TD` / `flowchart TD`。
- 常见方向拼写错误。
- 常见箭头 typo。
- 未闭合 label 括号的简单情况。
- unsupported diagram type 给出转换/不支持提示，不伪修复。

**约束**：

- `confidence: high` 才允许一键应用默认高亮。
- 修复必须可 diff；不能直接覆盖整份文档。
- LLM 修复不属于 v1 合同。

### 4.5 可视化编辑反写协议

**方向**：visual-flowchart-editor → editor-state
**形式**：图模型转换 + edit operation

```ts
interface FlowchartGraphModel {
  direction: 'TD' | 'TB' | 'BT' | 'LR' | 'RL';
  nodes: Array<{ id: string; label: string; shape?: NodeShape }>;
  edges: Array<{ id: string; from: string; to: string; label?: string; style?: EdgeStyle }>;
}

type VisualEdit =
  | { type: 'rename-node'; nodeId: string; label: string }
  | { type: 'add-node'; nodeId: string; label: string }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'add-edge'; from: string; to: string; label?: string }
  | { type: 'remove-edge'; edgeId: string }
  | { type: 'set-direction'; direction: FlowchartGraphModel['direction'] };

function parseFlowchartToGraph(source: string): FlowchartGraphModel;
function applyVisualEdit(model: FlowchartGraphModel, edit: VisualEdit): FlowchartGraphModel;
function serializeFlowchart(model: FlowchartGraphModel): string;
```

**约束**：

- v1 以“生成规范 Mermaid 片段”为目标，不保证保留原始格式。
- 视觉编辑只支持 flowchart。
- 反写只更新当前选中图表，不修改其它图表。
- 删除节点必须同时删除相关边；这是 model 层约束，不交给 UI 猜。

### 4.6 分享与导出协议

**方向**：app-shell → sharing-export
**形式**：浏览器函数调用

```ts
interface ExportRequest {
  diagramId: string;
  source: string;
  svg: SVGSVGElement;
  format: 'svg' | 'png';
  fileName?: string;
}

function exportDiagram(request: ExportRequest): Promise<Blob>;
function encodeShareState(documentText: string, selectedDiagramId: string | null): string;
function decodeShareState(hash: string): { documentText: string; selectedDiagramId: string | null } | null;
```

**约束**：

- URL hash 分享只做本地编码，不上传服务器。
- PNG 导出依赖浏览器 canvas 能力；失败时返回可展示诊断。
- SVG 导出必须使用当前实际预览 SVG，而不是重新渲染一遍。

## 5. 子 feature 清单

1. **live-editor-static-mvp** — 静态页面跑通文档输入、多图抽取、列表切换和选中图表实时预览。
   - 所属模块：app-shell / document-extractor / preview-runtime
   - 依赖：无
   - 状态：done
   - 对应 feature：2026-05-25-live-editor-static-mvp
   - 备注：最小闭环已验收；静态示例页面可加载含两个 flowchart 的 Markdown，切换 selected source，并渲染 SVG preview。

2. **diagram-source-map-contract** — 抽取器补齐 source range、fence/raw block 区分和安全回写。
   - 所属模块：document-extractor / editor-state
   - 依赖：`live-editor-static-mvp`
   - 状态：done
   - 对应 feature：2026-05-25-diagram-source-map-contract
   - 备注：已新增 `replaceDiagramSource`；fenced/raw range 合同和 missing id diagnostic 有单测覆盖。

3. **preview-diagnostics-panel** — 把 parse/layout/render 错误映射到选中图表和文档位置。
   - 所属模块：preview-runtime / app-shell
   - 依赖：`diagram-source-map-contract`
   - 状态：done
   - 对应 feature：2026-05-25-preview-diagnostics-panel
   - 备注：已新增 `RenderDiagnostic` 类型、错误归一化和 diagnostics panel；普通 `Error`、`XMermaidError` 与 unsupported diagram 映射有测试覆盖。

4. **syntax-repair-rules-v1** — 提供确定性语法修复建议和一键应用。
   - 所属模块：repair-engine / editor-state
   - 依赖：`preview-diagnostics-panel`
   - 状态：done
   - 对应 feature：2026-05-25-syntax-repair-rules-v1
   - 备注：已新增本地 deterministic repair engine；missing header、direction typo、arrow typo、label bracket 和 unsupported hint 有测试覆盖。

5. **share-export-workbench** — 支持复制图表、导出 SVG/PNG、URL hash 分享当前文档。
   - 所属模块：sharing-export / app-shell
   - 依赖：`live-editor-static-mvp`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：与修复/视觉编辑并行价值高，但技术上只依赖 MVP。

6. **visual-flowchart-model-v1** — 建立 flowchart graph model 与 Mermaid serialize 协议。
   - 所属模块：visual-flowchart-editor
   - 依赖：`diagram-source-map-contract`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：v1 不保证保留原始 Mermaid 格式。

7. **visual-flowchart-editor-v1** — 支持可视化增删节点和边、改 label、改方向，并反写 Mermaid。
   - 所属模块：visual-flowchart-editor / editor-state / app-shell
   - 依赖：`visual-flowchart-model-v1`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：只支持当前选中 flowchart。

8. **online-tool-polish** — 补齐主题、布局配置、快捷操作、空状态和错误态。
   - 所属模块：app-shell / sharing-export
   - 依赖：`syntax-repair-rules-v1`, `share-export-workbench`
   - 状态：planned
   - 对应 feature：未启动
   - 备注：技术依赖之外的产品优先级待确认。

**最小闭环**：第 1 条 `live-editor-static-mvp` 做完后，用户可以打开静态页面，粘贴一份含多个 flowchart 的 Markdown 文档，选择任意图表并实时预览。

## 6. 排期思路

先做 `live-editor-static-mvp`，因为它是最窄端到端路径，能最快验证“文档多图预览”是不是好用。随后补 `diagram-source-map-contract` 和 `preview-diagnostics-panel`，因为语法修复、视觉反写都依赖准确定位和安全回写。

`syntax-repair-rules-v1` 和 `share-export-workbench` 都能在 MVP 后提供明显产品价值，其中修复依赖 diagnostics，导出分享只依赖 MVP。可视化编辑放在后半段，因为它需要稳定 graph model 和 serialize 协议，否则会污染前面的编辑器状态设计。

`online-tool-polish` 放在最后统一处理，避免在核心协议未稳定前消耗过多 UI 微调成本。

## 7. 观察项

- 当前 parser 主要支持 flowchart；如果要支持 sequence/class/state 等，需要另起语法支持 roadmap 或作为本 roadmap 后续 update。
- 视觉反写若要保留原格式和注释，需要 parser 产生 token/source span，并建立 roundtrip printer；这可能成为独立 compiler-roadmap。
- 如果未来要接 LLM 修复，需要新增安全边界：用户代码不默认出站、修复结果必须 diff 可审查。
- 架构文档中已有 Editor SDK 构想，但源码还没有对应应用层入口；本 roadmap 落地后需要由 acceptance 阶段回写 architecture。
