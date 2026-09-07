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

xmermaid 专注于 Mermaid 流程图的浏览器端 SVG 渲染，提供较为完整的原生流程图能力：`graph` / `flowchart` 声明与全部方向、链式与 `&` 组合语句（`A & B --> C & D`）、管道与内联边标签（`A -- text --> B`、`A -. text .-> B`、`A == text ==> B`）、圆形（`o`）、交叉（`x`）与双向（`<-->`、`o--o`、`x--x`）边端点、通过额外短横线/等号实现的延长边（`A---->B`），以及完整的核心形状集——矩形、圆角、体育场 `([t])`、圆柱/数据库 `[(t)]`、圆形、双圆形、菱形、六边形、平行四边形、梯形、子例程与非对称。安全的十六进制 `classDef`、`class`、`style` 语句可以为节点着色，FontAwesome 4 标签以 SVG 图标嵌入。

子图容器会渲染为带标签的容器框，边可以连接到容器 ID。安全的 `classDef`、`class`、`style`、`linkStyle` 语句接受十六进制与 CSS 命名颜色以及数值 `stroke-width` / `stroke-dasharray`；内联 `A:::className` 分配、带连字符的节点 ID、实体编码标签解码（`#9829;`）以及 `A@{ shape: stadium, label: "..." }` 扩展形状均可渲染。FontAwesome 4 标签以 SVG 图标嵌入。

它还为 Sequence、Class、State、ER、User Journey、Gantt、Pie、Mindmap、Timeline、Requirement、GitGraph、C4、ZenUML、XY Chart（分类与数值 x 轴、横向布局、轴标题）、Sankey、Quadrant（含点的直接样式与 classDef）、Architecture、Block、Kanban、Treemap、Radar（graticule 形状与 ticks 圈数）、Packet、Venn、Swimlane、Ishikawa、Event Modeling、Wardley Map 和 Cynefin 提供了精心限定的原生子集。User Journey、Gantt 与 Pie 当前为完全支持。

任意图表源都可以通过 Mermaid 的 `%%{init: {'theme': 'dark'}}%%` 指令选择主题；指令优先于程序传入的主题，与 Mermaid 的优先级一致。可识别的名称包括 `default`、`dark`、`neutral`、`light`、`forest`、`base` 和 `minimal`。

所有图表族都接受 `accTitle` / `accDescr` 指令与 `---` frontmatter，并作为 SVG 的可访问名称与描述呈现。

这不是完整的 Mermaid 兼容实现。其余 Mermaid 图表族会在 `getSupportMatrix()` 中明确标记为 `planned`，并在 WASM 渲染前拒绝。请使用 `getSupportMatrix()` 或 `analyzeSupport(source)` 查询当前生产支持边界。

`sequenceDiagram` 为部分支持：显式 `participant` / `actor` 声明（含 `as` 别名）、实线/虚线/交叉（`-x`、`--x`）与异步开放箭头（`-)`、`--)`) 消息、双向 `<->` 链接、`create` / `destroy` 生命周期（销毁的生命寿命以 ✕ 截止）、`box` 参与者分组、带起始与步进的 `autonumber`、`activate` / `deactivate`（含 `+` / `-` 后缀）、单行 `Note left/right/over`、`rgb()`、`rgba()` 或十六进制颜色的 `rect` 框，以及嵌套的 `loop`、`alt` / `else`、`opt`、`par` / `and`、`critical` / `option`、`break` 块。多行备注尚不支持。

`classDiagram` 为部分支持：完整关系语法原生渲染——继承（`<|--`、`--|>`）、组合（`*--`）、聚合（`o--`）、关联（`-->`、`<--`）、连接（`--`）、依赖（`..>`、`..`）与实现（`..|>`、`<|..`），支持关系标签与带引号的基数。类成员块（`class Foo { ... }`）、成员简写（`Foo : +int size`）与分类注解（`<<interface>>`）会渲染在类框内。`namespace` 命名空间容器渲染为带标签的容器框；`style` 指令（安全十六进制或 CSS 命名颜色、`stroke-width`、`stroke-dasharray`）可为类框着色。`classDef`、`cssClass` 与 `click` 指令尚不支持。

`stateDiagram` 为部分支持：命名状态、带标签转换、以圆点渲染的起止 `[*]` 伪状态、`<<choice>>` 菱形与 `<<fork>>`/`<<join>>` 条形、状态别名、渲染为附加备注框的左右备注，以及内部转换被扁平化为带标签容器的复合状态块。并发区可解析但渲染为单一合并图，并以警告诊断提示。

`erDiagram` 为部分支持：完整的鸦脚基数语法（左侧 `|o`、`||`、`}o`、`}|`；右侧 `o|`、`||`、`o{`、`|{`）以原生鸦脚图形在两端渲染，配合标识（`--`）与非标识（`..`）连接；实体属性块连同键标记（PK/FK/UK）与注释渲染在实体框内。

`gantt` 为完全支持：基于 `YYYY`、`MM`、`DD` 组合的 `dateFormat` 指令、ISO 开始日期、`Nd` / `Nw` / `Nh` 时长、显式结束日期、以颜色渲染的 `done` / `active` / `crit` 任务状态、以菱形渲染的里程碑、`after <task...>` 依赖（多重锚点在全部完成后开始），以及 `excludes weekends` / 星期 / 日期指令——时长会按工作日历展开。unix 时间戳通过 `dateFormat X`（秒）、`dateFormat x`（毫秒）与历史别名 `dateFormat unix` 支持。

`pie` 为完全支持：数值扇区、标题（独立 `title` 行或 `pie showData title ...` 组合头）、`showData` 数值表格与 `%%{init: {'theme': ...}}%%` 主题指令渲染为饼图。

`mindmap` 为部分支持：带方括号、圆角、圆形、体育场、圆柱、六边形与非对称形状的缩进层级，`::icon(fa fa-*)` 声明会渲染为 FontAwesome 图标（未知图标名会提前报错）。Markdown 字符串尚不支持。

流程图支持 `classDef <名称>`、`class <节点 ID>[,<节点 ID>...] <名称>` 与 `style <节点 ID>`。定义仅可包含 `fill`、`stroke` 和 `color`，且颜色必须是三位或六位十六进制颜色。一个节点应用多个类或样式时按字段级联，后应用的值优先。在序列化能够无损保留这些声明之前，包含 `classDef` 或 `class` 的源码在可视化编辑中保持只读。

当前不支持或仅部分支持的流程图语法包括无效方向、不安全的 `style` 或 `linkStyle` 属性值、`click`、HTML 或 Markdown 标签、边 ID，以及子图内的 `direction` 语句（会解析但布局忽略）。

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
