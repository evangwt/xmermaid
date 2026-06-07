---
doc_type: roadmap
slug: multi-diagram-live-editor
status: completed
created: 2026-05-25
last_reviewed: 2026-06-07
tags: [editor, preview, markdown, multi-diagram, visual-editing, visual-contract]
related_requirements: [production-support-contract]
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
- Visual flowchart 编辑合同硬化：前端 visual model 必须和 Rust/WASM parser 支持面一致。
- Visual 编辑安全门禁：遇到不能可靠 roundtrip 的语法时阻断反写并给诊断，不静默降级。
- 方向控制分离：区分“只改预览 layoutConfig”和“修改 Mermaid source direction”。
- Visual roundtrip 契约测试：用真实 Rust/WASM parser/render 证明编辑后源码仍可闭环。

### 明确不做

- 第一版不做账号、云端保存、多人协作。
- 第一版不承诺完整 Mermaid 全图表类型；以 flowchart 为主。
- 第一版视觉编辑不保证保留用户原始排版、注释和空白格式。
- 不把 LLM 修复作为基础依赖；先做确定性规则修复。
- 不做完整 Markdown WYSIWYG 编辑器，只处理文档文本中的 Mermaid 图表块。
- 本次 update 不承诺完整 Mermaid 全语法 visual editing；只覆盖当前 flowchart 支持合同。
- 本次 update 不做拖拽式画布编辑器，只修当前表单式 visual editor 的数据合同和反写安全。
- 本次 update 不承诺保留原始注释、空白和用户排版；仍允许输出规范化 Mermaid，但不得丢失已声明支持的 AST 语义。

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

- **职责**：把 Rust/WASM parser 认可的 flowchart AST 转为可编辑图模型，执行有限 visual edit，并在反写前验证 next source 仍可被 Rust/WASM parser/render 接受。不能可靠 roundtrip 的源码必须进入只读/阻断态，不能用 regex parser 静默丢语义。
- **承载的子 feature**：`visual-flowchart-model-v1`, `visual-flowchart-editor-v1`, `visual-flowchart-ast-contract`, `visual-edit-safety-gate`, `visual-roundtrip-contract-tests`
- **触碰的现有代码 / 模块**：`src/editor/flowchart.ts`, `src/editor/index.ts`, `src/types/ast.ts`, `src/wasm.ts`, `crates/xmermaid-wasm/src/lib.rs`, parser/layout tests。

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
**形式**：AST-backed 图模型转换 + edit operation + 反写验证

```ts
type VisualSourceCapability = 'editable' | 'read-only' | 'unsupported';

interface VisualEditDiagnostic {
  code:
    | 'visual_unsupported_syntax'
    | 'visual_roundtrip_failed'
    | 'visual_parse_failed'
    | 'visual_render_failed';
  message: string;
  severity: 'warning' | 'error';
  range: SourceRange | null;
}

interface VisualSourceAnalysis {
  capability: VisualSourceCapability;
  model: FlowchartGraphModel | null;
  diagnostics: VisualEditDiagnostic[];
}

interface FlowchartGraphNode {
  id: string;
  label: string;
  shape: NodeShape;
}

interface FlowchartGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
  min_length: number;
}

interface FlowchartGraphModel {
  direction: 'TD' | 'TB' | 'BT' | 'LR' | 'RL';
  nodes: FlowchartGraphNode[];
  edges: FlowchartGraphEdge[];
  subgraphs: Subgraph[];
}

type VisualEdit =
  | { type: 'rename-node'; nodeId: string; label: string }
  | { type: 'add-node'; nodeId: string; label: string }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'add-edge'; from: string; to: string; label?: string }
  | { type: 'remove-edge'; edgeId: string }
  | { type: 'set-direction'; direction: FlowchartGraphModel['direction'] };

interface VisualEditApplyResult {
  status: 'applied' | 'blocked';
  source: string;
  model: FlowchartGraphModel | null;
  diagnostics: VisualEditDiagnostic[];
}

async function analyzeFlowchartForVisualEdit(source: string): Promise<VisualSourceAnalysis>;
function applyVisualEdit(model: FlowchartGraphModel, edit: VisualEdit): FlowchartGraphModel;
function serializeFlowchart(model: FlowchartGraphModel): string;
async function validateVisualEditResult(nextSource: string): Promise<VisualEditApplyResult>;
```

**约束**：

- v1 以“生成规范 Mermaid 片段”为目标，不保证保留原始格式。
- 视觉编辑只支持 flowchart。
- 反写只更新当前选中图表，不修改其它图表。
- 删除节点必须同时删除相关边；这是 model 层约束，不交给 UI 猜。
- visual editor 的 model 来源必须是 Rust/WASM parser AST 或由该 AST 派生的等价结构；不能再由独立 regex parser 决定支持面。
- serializer 必须保留当前 support matrix 声明支持的 node shape、edge style、edge label、direction 和 subgraph 字段；暂不支持的语法必须阻断反写。
- “方向下拉”必须明确走两条路径之一：preview-only layout override 或 source direction edit；source edit 必须经过 visual roundtrip validation。
- apply 后必须执行 `nextSource -> Rust/WASM parse -> render/layout` 验证；失败时保留原 source 并返回 diagnostics。

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
   - 状态：done
   - 对应 feature：2026-05-29-live-editor-roadmap-completion
   - 备注：已新增 toolbar 复制当前图表/文档、SVG/PNG 导出、URL hash share state；导出使用当前 preview SVG。

6. **visual-flowchart-model-v1** — 建立 flowchart graph model 与 Mermaid serialize 协议。
   - 所属模块：visual-flowchart-editor
   - 依赖：`diagram-source-map-contract`
   - 状态：done
   - 对应 feature：2026-05-29-live-editor-roadmap-completion
   - 备注：已新增 `parseFlowchartToGraph`、`applyVisualEdit`、`serializeFlowchart`；v1 输出规范 Mermaid 片段，不保留原始格式。

7. **visual-flowchart-editor-v1** — 支持可视化增删节点和边、改 label、改方向，并反写 Mermaid。
   - 所属模块：visual-flowchart-editor / editor-state / app-shell
   - 依赖：`visual-flowchart-model-v1`
   - 状态：done
   - 对应 feature：2026-05-29-live-editor-roadmap-completion
   - 备注：已新增当前选中 flowchart 的表单式 visual editor；支持增删节点/边、重命名节点、改方向并回写文档。

8. **online-tool-polish** — 补齐主题、布局配置、快捷操作、空状态和错误态。
   - 所属模块：app-shell / sharing-export
   - 依赖：`syntax-repair-rules-v1`, `share-export-workbench`
   - 状态：done
   - 对应 feature：2026-05-29-live-editor-roadmap-completion
   - 备注：已新增主题/方向控制、复制快捷按钮、导出错误诊断、异步 render 防 stale 覆盖和失败保留上一张成功 preview。

9. **visual-flowchart-ast-contract** — 用 Rust/WASM AST 作为 visual graph model 的唯一语义来源，覆盖已支持 node shape、edge style、direction 和 subgraph 字段。
   - 所属模块：visual-flowchart-editor / preview-runtime
   - 依赖：`visual-flowchart-editor-v1`
   - 状态：done
   - 对应 feature：2026-06-07-visual-flowchart-ast-contract
   - 备注：已新增 AST-backed visual source analysis、FlowchartAst -> graph model 转换、parser-level validation 和 shape/style/subgraph-preserving serializer；已有 sync helper 保留为 legacy/simple helper，但 visual editor 不再依赖它判定可编辑性。

10. **visual-edit-safety-gate** — 对不能可靠 roundtrip 的源码禁用反写或返回诊断，并把方向控制拆成 preview-only 与 source-edit 两种明确模式。
   - 所属模块：visual-flowchart-editor / editor-state / app-shell
   - 依赖：`visual-flowchart-ast-contract`
   - 状态：done
   - 对应 feature：2026-06-07-visual-edit-safety-gate
   - 备注：已接入 support analyzer safety gate；unsupported source 的 visual rewrite 返回 `visual_unsupported_syntax` 并保留原文；方向下拉改为 preview-only，显式 Apply direction 才改 source。

11. **visual-roundtrip-contract-tests** — 建立真实 Rust/WASM parse/render 契约测试，证明 visual edit 后的 Mermaid source 能闭环且不丢已支持 AST 语义。
   - 所属模块：visual-flowchart-editor / preview-runtime / test-suite
   - 依赖：`visual-flowchart-ast-contract`, `visual-edit-safety-gate`
   - 状态：done
   - 对应 feature：2026-06-07-visual-roundtrip-contract-tests
   - 备注：已新增 `tests/visual-roundtrip.test.ts`；真实 `pkg/xmermaid_wasm.js` + `pkg/xmermaid_wasm_bg.wasm` parse/render fixture 覆盖 supported shapes、edge styles、labels、subgraph、direction edit 和 blocked `classDef` safety gate；runtime `validateVisualEditResult()` 补齐 render/layout validation。

**最小闭环**：第 1 条 `live-editor-static-mvp` 做完后，用户可以打开静态页面，粘贴一份含多个 flowchart 的 Markdown 文档，选择任意图表并实时预览。

## 6. 排期思路

先做 `live-editor-static-mvp`，因为它是最窄端到端路径，能最快验证“文档多图预览”是不是好用。随后补 `diagram-source-map-contract` 和 `preview-diagnostics-panel`，因为语法修复、视觉反写都依赖准确定位和安全回写。

`syntax-repair-rules-v1` 和 `share-export-workbench` 都能在 MVP 后提供明显产品价值，其中修复依赖 diagnostics，导出分享只依赖 MVP。可视化编辑放在后半段，因为它需要稳定 graph model 和 serialize 协议，否则会污染前面的编辑器状态设计。

`online-tool-polish` 放在最后统一处理，避免在核心协议未稳定前消耗过多 UI 微调成本。

2026-06-07 update 后，新增 visual editing 合同硬化工作不回退已完成的 v1 条目，而是在 v1 之上补安全边界。先做 `visual-flowchart-ast-contract`，因为后续安全门禁和 roundtrip tests 都需要一个可信 graph model 来源；再做 `visual-edit-safety-gate`，把不能可靠反写的路径阻断；最后做 `visual-roundtrip-contract-tests`，把真实 Rust/WASM 闭环纳入回归证据。

## 7. 观察项

- 当前 parser 主要支持 flowchart；如果要支持 sequence/class/state 等，需要另起语法支持 roadmap 或作为本 roadmap 后续 update。
- 视觉反写若要保留原格式和注释，需要 parser 产生 token/source span，并建立 roundtrip printer；这可能成为独立 compiler-roadmap。
- 如果未来要接 LLM 修复，需要新增安全边界：用户代码不默认出站、修复结果必须 diff 可审查。
- 当前 `XMermaidLiveEditor` 仍是无后端静态工作台，不等同于架构草案里的完整 `XMermaidEditor` SDK。
- 当前 architecture 已记录 live editor v1 能力、visual edit safety gate 和真实 WASM roundtrip 测试门禁。未来若扩展到拖拽画布、完整 Mermaid 语法或格式保真，需要另开 roadmap/update。

## 8. 变更日志

- 2026-05-29：完成剩余 live editor roadmap 条目：分享/导出工作台、flowchart graph model、表单式 visual editor、主题/方向/快捷操作与错误态 polish。同步补强合同缺口：selected source 和 repair apply 回写文档模型、异步渲染 request sequencing、真实 unsupported diagram 错误映射、repair range 安全应用、WASM `compute_layout(ast_json)` 兼容 API 保留 AST 方向。
- 2026-06-07：重新打开 roadmap，追加 visual editing 契约硬化计划。接口契约变化：4.5 从 regex-based `parseFlowchartToGraph` 扩展为 AST-backed visual source analysis + edit validation 协议。受影响的已完成 feature：`visual-flowchart-model-v1`、`visual-flowchart-editor-v1`、`online-tool-polish`；它们的现状保留为 v1，但后续 visual editor feature 必须以新 4.5 合同为硬约束。
- 2026-06-07：完成 `visual-flowchart-ast-contract`。visual graph model 由 Rust/WASM flowchart AST 派生，保留 shape、edge style、edge label、direction、min_length 和 subgraph；live editor visual rewrite 改为 analysis -> edit -> serialize -> parser-level validation，并串行化 async visual edit 操作。
- 2026-06-07：完成 `visual-edit-safety-gate`。visual analysis 对 support analyzer 命中的 unsupported syntax fail-closed；direction toolbar 分离为 preview-only layout override 和显式 source direction edit。
- 2026-06-07：完成 `visual-roundtrip-contract-tests` 并关闭本 roadmap。真实 WASM fixture 证明 supported visual edit 输出可重新 parse/render，blocked unsupported syntax 不产生 rewrite；刻薄 review 后补齐 runtime render/layout validation gate，避免 parse-only commit。
