# xmermaid

[English](README.md) | [简体中文](README.zh-CN.md)

[![npm 版本](https://img.shields.io/npm/v/%40evangwt%2Fxmermaid?label=npm&logo=npm)](https://www.npmjs.com/package/@evangwt/xmermaid)
[![npm 下载量](https://img.shields.io/npm/dm/%40evangwt%2Fxmermaid?label=downloads&logo=npm)](https://www.npmjs.com/package/@evangwt/xmermaid)
[![发布状态](https://img.shields.io/github/actions/workflow/status/evangwt/xmermaid/publish-npm.yml?label=release&logo=github)](https://github.com/evangwt/xmermaid/actions/workflows/publish-npm.yml)
[![许可证：MIT](https://img.shields.io/badge/license-MIT-0b7a53.svg)](LICENSE)
[![在线编辑器](https://img.shields.io/badge/try-live%20editor-0b7a53?logo=githubpages)](https://evangwt.github.io/xmermaid-live/)

**基于 Rust/WASM 的浏览器 Mermaid SVG 渲染器。** xmermaid 以流程图为核心，为部分支持的 Mermaid 图表提供明确、可编程查询的兼容性边界：能渲染的稳定渲染，暂不支持的给出清晰诊断。

<p>
  <a href="https://evangwt.github.io/xmermaid-live/"><strong>在线体验</strong></a>
  &nbsp;|&nbsp;
  <a href="https://www.npmjs.com/package/@evangwt/xmermaid"><strong>npm 包页面</strong></a>
</p>

## 特性

- **浏览器原生 SVG：** 使用 Rust/WASM 解析、布局和渲染，无需独立渲染服务。
- **明确的兼容性：** `getSupportMatrix()` 和 `analyzeSupport()` 可区分已支持、部分支持、计划中和被安全策略阻止的输入。
- **默认安全：** 对不受信任 Mermaid 输入使用严格安全策略，并清理生成的 SVG。
- **易于集成：** 可直接使用 `XMermaid`，也可从 `@evangwt/xmermaid/editor` 导入静态编辑器。

## 快速开始

```bash
npm install @evangwt/xmermaid
```

xmermaid 是面向浏览器的 SDK。根 ESM 包可被 Node 或 SSR 工具解析，但实际 DOM 渲染需要浏览器或类浏览器环境。

## 浏览器使用

```ts
import { XMermaid, analyzeSupport } from '@evangwt/xmermaid';

const source = 'graph TD\n  A[Start] --> B[End]';
const report = analyzeSupport(source);

const container = document.getElementById('diagram');
if (!container) throw new Error('Missing diagram container');

const renderer = new XMermaid({ container });
await renderer.render(source);
```

## 在线编辑器 API

静态在线编辑器 API 从 `@evangwt/xmermaid/editor` 子路径导入：

```ts
import { XMermaidLiveEditor } from '@evangwt/xmermaid/editor';

const editor = new XMermaidLiveEditor({
  root: document.getElementById('editor')!,
  initialText: '```mermaid\nflowchart TD\n  A --> B\n```',
});

await editor.mount();
```

## SVG API

当宿主应用需要自行挂载、序列化、存储或后处理时，请使用 `renderToSVGElement()`：

```ts
import { XMermaid } from '@evangwt/xmermaid';

const renderer = new XMermaid({ container: document.createElement('div') });

const result = await renderer.renderToSVGElement('graph TD\n  A-->B');
document.body.appendChild(result.svg);

const svgText = await renderer.renderToSVGString('graph TD\n  A-->B');
```

`RenderResult` 包含 `diagramType`、`diagnostics`、`dimensions` 和 `svg`。

## 图表主题

xmermaid 提供 `LIGHT_THEME` 和 `DARK_THEME` 主题预设，同时保留 `DEFAULT_THEME` 作为兼容默认值。可为渲染器或单次渲染传入预设或部分 `RenderTheme`。

`edgeGap` 是箭头标记与目标节点间的间距。渲染器会依据当前标记样式、尺寸与线宽计算可见线段终点，使其和标记自然连接。

## 当前支持范围

xmermaid 专注于 Mermaid 流程图的浏览器端 SVG 渲染，支持基础 `graph` / `flowchart` 声明、基础节点和有向边、常见标签、核心形状与部分子图解析。它还为 Sequence、Class、State、ER、User Journey、Gantt、Pie、Mindmap、Timeline、Requirement、GitGraph、C4、ZenUML、XY Chart、Sankey、Quadrant、Architecture、Block、Kanban、Treemap、Radar、Packet、Venn、Swimlane、Ishikawa、Event Modeling、Wardley Map 和 Cynefin 提供了精心限定的原生子集。

这不是完整的 Mermaid 兼容实现。其余 Mermaid 图表族会在 `getSupportMatrix()` 中明确标记为 `planned`，并在 WASM 渲染前拒绝。请使用 `getSupportMatrix()` 或 `analyzeSupport(source)` 查询当前生产支持边界。

流程图支持 `classDef <名称>` 和 `class <节点 ID>[,<节点 ID>...] <名称>`。定义仅可包含 `fill`、`stroke` 和 `color`，且颜色必须是三位或六位十六进制颜色。一个节点分配多个类时按字段级联，后分配的值优先。在序列化能够无损保留这些声明之前，包含 `classDef` 或 `class` 的源码在可视化编辑中保持只读。

当前不支持或仅部分支持的流程图语法包括无效方向、`style`、`click`、`linkStyle`、HTML 或 Markdown 标签、引号标签、实体编码标签、FontAwesome 图标标签、扩展形状、粗线或延长边、双向/圆形/交叉边端点、内联边标签、边 ID、连接到子图 ID 的边、带连字符的节点 ID 和内联类分配。

## 诊断

不支持但可继续渲染的流程图语法会以 `unsupported_syntax` 警告报告；如无效流程图方向等错误级不支持语法会在 WASM 渲染前阻止。未支持的图表族会报 `unsupported_diagram_type`。

WASM 解析、布局或渲染失败会被标准化为带结构化诊断的 `XMermaidError`。Rust 解析错误目前可能缺少精确的 token 偏移/列范围。

## 安全策略

嵌入同源应用的非受信任 Mermaid 输入默认使用 `strict` 安全策略。它会在渲染前阻止 `click` 回调或链接、HTML 标签以及不在 `http:`、`https:`、`mailto:` 白名单中的 URL 协议。

默认也会启用 `sanitizeSvg: true`，在返回或挂载 SVG 前清除 `script`、`foreignObject`、内联事件处理器以及危险 `href`。xmermaid 不执行 click 回调，也不将 HTML 标签渲染为 HTML。

## WASM 与打包

发布包包含 JavaScript bundle、TypeScript 声明和 `dist/xmermaid_wasm_bg.wasm`。默认加载器会从构建后的 JS 入口相邻路径解析该资源；自定义资源路径的宿主应在第一次渲染时通过 `wasm.wasmUrl` 显式指定 URL。

WASM 初始化是进程全局的。首次初始化后，后续渲染会复用同一实例；请在第一次渲染前而不是中途改变 `wasmUrl` 或 `fetch`。

## 常见问题

- `Chrome executable not found`：安装 Chrome/Chromium，或设置 `CHROME_BIN`。
- `unsupported_diagram_type`：该图表族不在当前生产支持范围内。
- `unsupported_syntax`：输入使用了当前渲染器已识别但尚未实现的 Mermaid 语法。
- `security_blocked_*`：严格安全策略在渲染前阻止了风险构造。
- WASM 资源加载失败：确认包内包含 `dist/xmermaid_wasm_bg.wasm`，且应用会随构建后的 JS bundle 提供该资源。

## 许可证

MIT。完整文本见 [LICENSE](LICENSE)。
