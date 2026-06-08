---
doc_type: roadmap
slug: production-readiness
status: completed
created: 2026-06-02
last_reviewed: 2026-06-02
tags: [production, release, compatibility, sdk, security]
related_requirements: []
related_architecture: [ARCHITECTURE]
---

# Production Readiness Roadmap

## 1. 背景

当前 xmermaid 已经有 flowchart MVP、静态 live editor、SVG 渲染、WASM 构建和 release verification 基线，但距离“生产落地”仍有一个硬缺口：仓库内测试通过不等于真实用户能安装、编译、加载 WASM、渲染并理解失败原因。

本 roadmap 只处理第一阶段生产发布就绪：把项目收敛成一个诚实、可安装、可验证、可文档化的 browser SDK。图表类型扩张、Server/CLI 生态、hosted editor 产品化不混进本路线，避免把发布底线和产品愿望绑死。

## 2. 范围与明确不做

### 本 roadmap 覆盖

- 公开支持范围：支持哪些 diagram / syntax、哪些 partial、哪些 unsupported。
- 真实消费者门禁：`npm pack`、临时项目安装、TypeScript 类型解析、ESM/CJS 入口、浏览器加载 WASM 并渲染最小 flowchart 和 live editor preview。
- 稳定 SVG 输出 API：从 DOM-only render 收敛出可复用的 SVG element/string API。
- 支持分析与结构化诊断：unsupported diagram / unsupported syntax 不再靠字符串猜测。
- 安全策略 v1：strict 默认，明确 URL/click/html label/CSP 相关边界。
- 生产文档与 release checklist：README、限制清单、安装说明、排错说明与发布门禁同步。

### 明确不做

- 不新增 sequenceDiagram/class/state/ER/gantt/pie/mindmap 等图表类型；这些后续走 compatibility expansion roadmap。
- 不做 Server SDK、CLI 批量渲染或 Node PNG 输出；第一阶段只承诺 browser SDK。
- 不做账号、云端保存、多人协作或 hosted editor 产品化。
- 不承诺完整 Mermaid 兼容；本路线的目标是把“支持边界”说清楚并用 diagnostics 表达。
- 不重写 layout 算法；兼容测试暴露的问题只在对应 feature 中定点处理。
- 不默认允许任意 click callback、HTML label 或不可信 URL。

## 3. 模块拆分（概设）

```text
production-readiness
├── release-support-matrix：公开支持范围、限制清单和文档同步
├── package-consumer-gate：真实 npm tarball 消费者安装与浏览器渲染门禁
├── public-render-api：稳定 SVG 输出 API 和结果合同
├── support-analyzer：在 render 前识别 diagram/syntax 支持状态
├── diagnostics-runtime：结构化错误、source range 和 live editor 诊断消费
├── security-policy：strict/loose 安全策略、URL/click/html 阻断
└── production-docs：README、API 文档、排错说明和 release checklist
```

### release-support-matrix

- **职责**：定义生产发布时对外承诺什么、不承诺什么；同步 README、package 描述和机器可读支持矩阵。
- **承载的子 feature**：`release-support-matrix`
- **触碰的现有代码 / 模块**：`package.json`、README/文档、support matrix 新模块。

### package-consumer-gate

- **职责**：保证发布包能被真实消费者安装、类型解析、加载 ESM/CJS 入口、加载 WASM，并渲染最小 flowchart 与 live editor preview。
- **承载的子 feature**：`pack-install-render-smoke`
- **触碰的现有代码 / 模块**：`package.json` exports/files、`src/wasm.ts`、`dist/*.d.ts`、`scripts/verify-release.cjs`。

### public-render-api

- **职责**：把当前 DOM-only `XMermaid.render()` 扩成稳定 SVG 输出 API，并保留兼容路径。
- **承载的子 feature**：`render-svg-api`
- **触碰的现有代码 / 模块**：`src/xmermaid.ts`、`src/index.ts`、`src/renderer/svg.ts`、类型声明。

### support-analyzer

- **职责**：在 parser/render 前给出 diagram type 与 syntax capability 判断，供 diagnostics、docs、repair engine 共用。
- **承载的子 feature**：`support-analyzer-v1`
- **触碰的现有代码 / 模块**：Rust parser/WASM 或 TS support module、tests、live editor diagnostics。

### diagnostics-runtime

- **职责**：用结构化诊断替代字符串匹配和整图范围错误。
- **承载的子 feature**：`structured-diagnostics-v1`
- **触碰的现有代码 / 模块**：parser errors、WASM bindings、`XMermaidError`、live editor diagnostics。

### security-policy

- **职责**：定义生产默认安全级别，处理 click、URL、HTML label、share hash 和 SVG 输出安全。
- **承载的子 feature**：`security-policy-v1`
- **触碰的现有代码 / 模块**：parser metadata、renderer、editor share/export、SDK options。

### production-docs

- **职责**：让用户知道怎么装、怎么用、哪些不支持、如何升级、如何排错。
- **承载的子 feature**：`production-docs-release-checklist`
- **触碰的现有代码 / 模块**：README、docs、package metadata、API declaration docs。

## 4. 模块间接口契约 / 共享协议（架构层详设）

### 4.1 Support Matrix Contract

**方向**：release-support-matrix / support-analyzer → public-render-api / diagnostics-runtime / production-docs
**形式**：机器可读数据结构 + 查询函数

```ts
type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'pie'
  | 'mindmap'
  | 'unknown';

type SupportStatus = 'supported' | 'partial' | 'unsupported';

interface SyntaxCapability {
  id: string;
  label: string;
  status: SupportStatus;
  diagnosticCode?: XMermaidDiagnosticCode;
  notes?: string;
}

interface DiagramSupportEntry {
  diagramType: DiagramType;
  status: SupportStatus;
  supportedSyntax: SyntaxCapability[];
  unsupportedSyntax: SyntaxCapability[];
}

interface SupportMatrix {
  version: string;
  entries: DiagramSupportEntry[];
}

interface SupportReport {
  diagramType: DiagramType;
  status: SupportStatus;
  diagnostics: XMermaidDiagnostic[];
}

function getSupportMatrix(): SupportMatrix;
function analyzeSupport(source: string): SupportReport;
```

**约束**：

- `package.json.description`、README headline 和 support matrix 不能互相矛盾。
- `unsupported` 不能静默降级为空图或普通 parse error。
- `partial` 必须列出 unsupported syntax；warning-level syntax 可随 render diagnostics 返回，error-level syntax 必须在 render preflight 阶段阻断。

### 4.2 Public SVG Render API Contract

**方向**：public-render-api → renderer / WASM runtime
**形式**：公开 TypeScript API

```ts
interface RenderOptions {
  theme?: Partial<RenderTheme>;
  layoutConfig?: Partial<LayoutConfig>;
  securityLevel?: 'strict' | 'loose';
  wasm?: WasmInitOptions;
}

interface RenderResult {
  diagramType: DiagramType;
  diagnostics: XMermaidDiagnostic[];
  dimensions: Dimensions;
  svg: SVGSVGElement;
}

class XMermaid {
  render(input: string): Promise<void>; // existing DOM replacement path remains
  renderToSVGElement(input: string, options?: RenderOptions): Promise<RenderResult>;
  renderToSVGString(input: string, options?: RenderOptions): Promise<string>;
}
```

**约束**：

- 现有 `render(input): Promise<void>` 不在本 roadmap 第一阶段破坏。
- `renderToSVGElement` 是主输出；`renderToSVGString` 是其序列化包装。
- PNG export 不属于本 feature；避免 Canvas/Blob 环境差异拖垮基础 SDK 合同。
- 新 API 必须返回结构化 diagnostics 或抛 `XMermaidError`，不能只写 DOM 文本。

### 4.3 Support Analyzer Contract

**方向**：support-analyzer → diagnostics-runtime / repair engine / docs
**形式**：轻量语法扫描协议

```ts
type UnsupportedFeatureId =
  | 'diagram.sequence'
  | 'diagram.class'
  | 'diagram.state'
  | 'diagram.er'
  | 'flowchart.class'
  | 'flowchart.classDef'
  | 'flowchart.style'
  | 'flowchart.click'
  | 'flowchart.htmlLabel'
  | 'flowchart.markdownLabel'
  | 'flowchart.invalidDirection'
  | 'flowchart.expandedShape'
  | 'flowchart.stadiumShape'
  | 'flowchart.cylinderShape'
  | 'flowchart.thickLineEdge'
  | 'flowchart.extendedLineEdge'
  | 'flowchart.extendedThickEdge'
  | 'flowchart.bidirectionalEdge'
  | 'flowchart.circleEdge'
  | 'flowchart.crossEdge'
  | 'flowchart.inlineEdgeLabel'
  | 'flowchart.edgeId'
  | 'flowchart.inlineClass'
  | 'flowchart.linkStyle';

interface UnsupportedFeature {
  id: UnsupportedFeatureId;
  range: SourceRange | null;
  severity: 'warning' | 'error';
  message: string;
}

function detectUnsupportedFeatures(source: string): UnsupportedFeature[];
```

**约束**：

- analyzer 不替代 parser；只负责 production support 状态识别。
- 能定位的 unsupported syntax 必须提供 `SourceRange`。
- analyzer 输出必须能映射到 support matrix 的 `SyntaxCapability.id`。

### 4.4 Structured Diagnostics Contract

**方向**：parser / support-analyzer / WASM → SDK / live editor / repair engine
**形式**：共享错误类型

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

**约束**：

- parser 能定位的错误必须带 line/column；不能只返回整图 range。
- `unsupported_diagram_type` 与 `unsupported_syntax` 必须区分。
- live editor repair rules 只消费结构化 code，不再依赖错误字符串正则。

### 4.5 WASM / Package Loading Contract

**方向**：package-consumer-gate → wasm runtime / release verification
**形式**：初始化配置 + 包结构协议

```ts
interface WasmInitOptions {
  wasmUrl?: string | URL;
  fetch?: typeof globalThis.fetch;
}

async function initWasm(options?: WasmInitOptions): Promise<void>;
function isWasmReady(): boolean;
```

**包导出约束**：

```json
{
  "exports": {
    ".": { "import": "./dist/xmermaid.esm.js", "require": "./dist/xmermaid.cjs", "types": "./dist/index.d.ts" },
    "./editor": { "import": "./dist/editor/index.js", "types": "./dist/editor/index.d.ts" }
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

**约束**：

- `npm pack --dry-run` 结果中所有 `.d.ts` 引用路径必须存在于包内。
- 真实消费者项目必须通过 `npm install <tarball>`、`tsc --noEmit`、浏览器 smoke render。
- WASM asset resolution 必须支持 bundler 默认路径；自定义 `wasmUrl` 用于 CDN/特殊部署。

### 4.6 Security Policy Contract

**方向**：security-policy → support-analyzer / renderer / editor / public SDK
**形式**：SDK option + diagnostics

```ts
interface ThreatModel {
  inputTrust: 'trusted' | 'untrusted';
  outputEmbedding: 'same-origin-app' | 'third-party-content';
}

interface SecurityPolicy {
  securityLevel: 'strict' | 'loose';
  allowedUrlProtocols: string[];
  allowHtmlLabels: boolean;
  allowClickCallbacks: boolean;
  sanitizeSvg: boolean;
}

const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  securityLevel: 'strict',
  allowedUrlProtocols: ['http:', 'https:', 'mailto:'],
  allowHtmlLabels: false,
  allowClickCallbacks: false,
  sanitizeSvg: true
};
```

**约束**：

- 默认 threat model 是 untrusted Mermaid input embedded in a same-origin app.
- strict 模式下不执行 click callback。
- URL protocol 不在 allowlist 时生成 `security_blocked_url` diagnostic。
- HTML label 在 strict 模式下按纯文本处理或报 `security_blocked_html`。
- share hash 只保存本地状态，不代表云端权限或隐私保护。

### 4.7 Production Release Verification Extension

**方向**：production-readiness → existing `verify:release`
**形式**：命令矩阵扩展

```ts
type ProductionVerificationCommandId =
  | 'consumer-pack-install'
  | 'browser-smoke-render'
  | 'type-declaration-pack'
  | 'docs-support-matrix-sync';
```

**约束**：

- `consumer-pack-install` 是生产最小闭环门禁。
- package size 和 smoke render duration 作为 `consumer-pack-install` summary 字段记录；第一阶段只记录基线，不设硬阈值。
- support matrix 与 README/package 描述不一致时 release 失败。

## 5. 子 feature 清单

1. **release-support-matrix** — 收敛公开定位、支持矩阵、README/package 描述和限制清单。
   - 所属模块：release-support-matrix
   - 依赖：无
   - 状态：done
   - 对应 feature：2026-06-02-release-support-matrix
   - 备注：已新增 `src/support.ts`、README 支持范围说明和 package 描述收敛；公开合同声明 flowchart 为 partial support，非 flowchart diagram family 当前 unsupported。

2. **pack-install-render-smoke** — 增加真实 `npm pack` 消费者安装、类型解析、WASM 加载和浏览器最小渲染门禁。
   - 所属模块：package-consumer-gate
   - 依赖：`release-support-matrix`
   - 状态：done
   - 对应 feature：2026-06-02-pack-install-render-smoke
   - 备注：已新增 `scripts/consumer-smoke.cjs` 和 `consumer-pack-install` release gate；packed tarball consumer typecheck、Node ESM import、CommonJS require、Chrome/WASM render smoke 和 live editor preview smoke 已通过。

3. **render-svg-api** — 补齐 `renderToSVGElement`、`renderToSVGString` 和 `RenderResult` 公开 API。
   - 所属模块：public-render-api
   - 依赖：`release-support-matrix`
   - 状态：done
   - 对应 feature：2026-06-02-render-svg-api
   - 备注：已新增 `renderToSVGElement()`、`renderToSVGString()`、`RenderResult`、`RenderOptions`、`WasmInitOptions`，并保持现有 `render(input)` DOM replacement 行为。

4. **support-analyzer-v1** — 建立 diagram/syntax support analyzer，输出 unsupported feature 列表与 source range。
   - 所属模块：support-analyzer
   - 依赖：`release-support-matrix`
   - 状态：done
   - 对应 feature：2026-06-02-support-analyzer-v1
   - 备注：已新增 `detectUnsupportedFeatures()`、`UnsupportedFeature`、`SupportSourceRange`，覆盖 unsupported diagram family 与 flowchart class/classDef/style/click/linkStyle/HTML/Markdown label、invalid direction、expanded/stadium/cylinder shape syntax、thick/extended edge forms、unsupported edge endings、inline edge labels、edge IDs 和 inline class assignments 的轻量识别。

5. **structured-diagnostics-v1** — 从 support analyzer/WASM 到 SDK/live editor 贯通结构化诊断和 line/column range。
   - 所属模块：diagnostics-runtime
   - 依赖：`support-analyzer-v1`, `render-svg-api`
   - 状态：done
   - 对应 feature：2026-06-02-structured-diagnostics-v1
   - 备注：已新增共享 diagnostics 类型、render preflight diagnostics、`XMermaidError.diagnostics`、DOM scan failure data attributes 和 live editor diagnostics 消费；Rust parser 未输出结构化位置时不伪造 token column。

6. **security-policy-v1** — 落地 strict/loose 安全策略、URL/click/html label 处理和安全 diagnostics。
   - 所属模块：security-policy
   - 依赖：`structured-diagnostics-v1`
   - 状态：done
   - 对应 feature：2026-06-02-security-policy-v1
   - 备注：已新增默认 strict security policy、有限 loose、URL allowlist 和 `security_blocked_*` diagnostics；v1 不执行 click、不渲染 HTML label、不实现 sanitizer/CSP。

7. **production-docs-release-checklist** — 补齐 README、API 文档、限制清单、排错说明、changelog 和 release checklist。
   - 所属模块：production-docs
   - 依赖：`pack-install-render-smoke`, `structured-diagnostics-v1`, `security-policy-v1`
   - 状态：done
   - 对应 feature：2026-06-02-production-docs-release-checklist
   - 备注：README 已覆盖安装、SVG API、support matrix、diagnostics、安全策略、WASM/Chrome smoke 和排错；新增 `docs/production-release-checklist.md`；默认 release matrix 已新增 `docs-support-matrix-sync`。

**最小闭环**：第 2 条 `pack-install-render-smoke` 完成后，真实消费者能安装 packed tarball、TypeScript 能解析类型、ESM/CJS 入口可加载、浏览器能加载 WASM 并渲染最小 flowchart 与 live editor preview。这比“文档写得诚实”更接近生产事实。

## 6. 排期思路

本 roadmap 已按依赖顺序完成：先做 `release-support-matrix`，避免承诺和实现不一致；随后做 `pack-install-render-smoke`，证明不是“仓库里能跑”，而是“用户装了能跑”；`render-svg-api`、`support-analyzer-v1`、`structured-diagnostics-v1` 和 `security-policy-v1` 补齐 SDK 结果合同、诊断合同和默认安全边界；最后用 docs/release checklist 把这些事实变成可发布流程。

技术依赖之外的产品优先级未在这里强行拍板：非 flowchart 图表扩张、Server/CLI 和 live editor 产品化都被放入观察项，避免干扰第一阶段发布底线。

## 7. 观察项

- `ARCHITECTURE.md` 的当前定位已修正为 flowchart-focused partial Mermaid support；后续不要把完整 Mermaid 兼容或 CLI/Server/Canvas/插件生态写成当前事实。
- 现有 `visual-rendering-readiness` 和 `multi-diagram-live-editor` 均已 completed，本 roadmap 不回写它们。
- `pack-install-render-smoke` 已修复 `dist/wasm.d.ts` 泄漏 `../pkg/xmermaid_wasm` 内部构建路径的问题；后续不要重新把 `pkg/` 类型路径暴露给消费者。
- requirements 目录目前没有生产发布愿景文档；如果要长期维护产品定位，建议另起 `cs-req` 补 `production-release` 能力愿景。
- sequenceDiagram/class/state/ER/gantt/pie/mindmap 等扩展应另起 compatibility expansion roadmap。
- Server SDK / CLI foundation 应在 browser SDK 发布闭环稳定后另起 ecosystem roadmap。
