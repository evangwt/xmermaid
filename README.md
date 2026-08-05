# xmermaid

[English](README.md) | [Chinese](README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/%40evangwt%2Fxmermaid?label=npm&logo=npm)](https://www.npmjs.com/package/@evangwt/xmermaid)
[![npm downloads](https://img.shields.io/npm/dm/%40evangwt%2Fxmermaid?label=downloads&logo=npm)](https://www.npmjs.com/package/@evangwt/xmermaid)
[![Publish to npm](https://img.shields.io/github/actions/workflow/status/evangwt/xmermaid/publish-npm.yml?label=release&logo=github)](https://github.com/evangwt/xmermaid/actions/workflows/publish-npm.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0b7a53.svg)](LICENSE)
[![Live editor](https://img.shields.io/badge/try-live%20editor-0b7a53?logo=githubpages)](https://evangwt.github.io/xmermaid-live/)

**A Rust/WASM-powered browser renderer for native Mermaid SVG diagrams.** xmermaid focuses on flowcharts while exposing explicit, programmatic support boundaries for partial Mermaid families - so browser applications can render what is supported and explain what is not.

<p>
  <a href="https://evangwt.github.io/xmermaid-live/"><strong>Try the live editor</strong></a>
  &nbsp;|&nbsp;
  <a href="https://www.npmjs.com/package/@evangwt/xmermaid"><strong>View on npm</strong></a>
</p>

## Highlights

- **Native browser SVG:** Rust/WASM parsing, layout, and rendering without a rendering service.
- **Truthful compatibility:** `getSupportMatrix()` and `analyzeSupport()` distinguish supported, partial, planned, and blocked input.
- **Safe by default:** strict handling for untrusted Mermaid input and sanitized SVG output.
- **Composable API:** use `XMermaid` directly or import the static editor from `@evangwt/xmermaid/editor`.

## Quick Start

```bash
npm install @evangwt/xmermaid
```

xmermaid is a browser SDK. The root ESM bundle can be parsed by Node and SSR tooling, but DOM rendering requires a browser-like environment.

## Browser Usage

```ts
import { XMermaid, analyzeSupport } from '@evangwt/xmermaid';

const source = 'graph TD\n  A[Start] --> B[End]';
const report = analyzeSupport(source);

const container = document.getElementById('diagram');
if (!container) throw new Error('Missing diagram container');

const renderer = new XMermaid({ container });
await renderer.render(source);
```

## Live Editor Usage

The static live editor API is available from the `@evangwt/xmermaid/editor` subpath.

```ts
import { XMermaidLiveEditor } from '@evangwt/xmermaid/editor';

const editor = new XMermaidLiveEditor({
  root: document.getElementById('editor')!,
  initialText: '```mermaid\nflowchart TD\n  A --> B\n```',
});

await editor.mount();
```

## SVG API

Use `renderToSVGElement()` when the host app owns mounting, serialization, storage, or post-processing.

```ts
import { XMermaid } from '@evangwt/xmermaid';

const renderer = new XMermaid({ container: document.createElement('div') });

const result = await renderer.renderToSVGElement('graph TD\n  A-->B');
document.body.appendChild(result.svg);

const svgText = await renderer.renderToSVGString('graph TD\n  A-->B');
```

`RenderResult` contains:

- `diagramType`
- `diagnostics`
- `dimensions`
- `svg`

## Diagram Themes

xmermaid publishes paired `LIGHT_THEME` and `DARK_THEME` presets while keeping `DEFAULT_THEME` as the compatibility default. Pass a preset or any partial `RenderTheme` per renderer or per render:

```ts
import { DARK_THEME, XMermaid, type RenderTheme } from '@evangwt/xmermaid';

const customTheme: Partial<RenderTheme> = {
  ...DARK_THEME,
  colors: {
    ...DARK_THEME.colors,
    nodeStroke: '#67e8f9',
    arrowFill: '#fbbf24',
  },
  arrowStyle: 'open',
  curveStyle: 'step',
  edgeGap: 2,
  arrowSize: 12,
};

await renderer.renderToSVGElement(source, { theme: customTheme });
```

`edgeGap` is the clearance between the marker and target node. The renderer derives the visible line endpoint from the active marker style, size, and stroke width so the line joins the marker without a visible gap.

## Current Support

xmermaid currently focuses on browser-side SVG rendering for Mermaid flowcharts. It supports basic `graph` / `flowchart` declarations, basic nodes and directed edges, common labels, core shapes, and partial subgraph parsing. It also renders deliberately small subsets of Sequence, Class, State, Entity Relationship, User Journey, Gantt, Pie, Mindmap, Timeline, Requirement, GitGraph, C4, ZenUML, XY Chart, Sankey, Quadrant, Architecture, Block, Kanban, Treemap, Radar, Packet, Venn, Swimlane, Ishikawa, Event Modeling, Wardley Map, and Cynefin diagrams.

This is partial Mermaid support, not full Mermaid compatibility.

All remaining Mermaid catalog families are explicitly marked `planned` in `getSupportMatrix()` and rejected before WASM rendering.

`sequenceDiagram` is partial: explicit `participant` / `actor` declarations (including `as` display aliases), labeled direct messages (including dashed `--x` cross endings), bare `autonumber`, `activate` / `deactivate` (and message `+` / `-` suffixes), single-line `Note left/right/over`, validated `rect rgb(red, green, blue)` frames, and nested `loop`, `alt` / `else`, `opt`, `par` / `and`, `critical` / `option`, and `break` blocks render through a native timeline layout. `create` / `destroy`, `box`, links, multi-line notes, and advanced autonumber or rect forms remain unsupported. `getSupportMatrix()` or `analyzeSupport(source)` exposes that boundary programmatically.

`classDiagram` is partial: named classes plus inheritance (`<|--`) and directed relations (`-->`) render as a relationship layout; members, namespaces, composition, aggregation, and dependency relation styles remain unsupported.

`stateDiagram` is partial: named states and directed transitions with optional labels render as a relationship layout; start/end pseudostates and composite states remain unsupported.

`erDiagram` is partial: labeled `||--o{` crow’s-foot relationships render as a relationship layout; entity attribute blocks and extended cardinalities remain unsupported.

`gantt` is partial: sectioned tasks with ISO start dates and `Nd` durations render as a timeline; task states, dependencies, milestones, and custom date formats remain unsupported.

`pie` is partial: numeric labeled slices render as a pie chart; `showData`, custom themes, and advanced formatting remain unsupported.

`mindmap` is partial: space-indented hierarchies render as connected nodes; Markdown, icons, and custom shapes remain unsupported.

`timeline` is partial: ordered period/event entries render as connected nodes; advanced styling and event metadata remain unsupported.

`requirementDiagram` is partial: typed requirement blocks and labeled relationships render as connected nodes; custom styling and advanced relation syntax remain unsupported.

`gitGraph` is partial: commits, branches, checkouts, merges, IDs, tags, and types render as a history graph; cherry-picks, custom ordering, and advanced commit options remain unsupported.

`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, and `C4Deployment` are partial: people, systems, containers, components, external elements, and labeled relationships render as connected nodes; boundaries, deployment nodes, styling, and advanced relationship macros remain unsupported.

`architecture-beta` is partial: top-level `service id(icon)[label]` declarations and direct port-to-port `--` / `-->` relationships render as a left-to-right service layout. Groups, junctions, service membership, `align`, configuration, icon glyphs, and bidirectional arrows remain unsupported.

`block-beta` is partial: flat rows of named blocks, optional positive `columns N`, `id["Label"]`, `id:N` spans, `space` placeholders, and direct `--` / `-->` relationships render as a native grid. Nested blocks, block arrows, custom shapes, classes, styles, configuration, and edge labels remain unsupported.

`packet` is partial: optional titles, ordered absolute `start-end: "Label"` fields, and sequential `+width: "Label"` fields render as a native 32-bit SVG grid. Overlapping/out-of-order fields, YAML configuration, classes, styles, and accessibility directives remain unsupported.

`venn-beta` is partial: named `set` declarations, optional display labels, labeled unions of declared sets, and titles render as native overlapping SVG circles. Set/union sizes, text annotations, YAML configuration, classes, styles, and accessibility directives remain unsupported.

`kanban` is partial: ordered bare or bracket-labeled columns with space-indented bare or bracket-labeled tasks render as a native board. Task metadata, ticket configuration, YAML, styles, and advanced syntax remain unsupported.

`zenuml` is partial: labeled `->` calls and `-->` returns render as distinct solid and dashed arrows; blocks, declarations, async messages, and advanced control syntax remain unsupported.

`xychart-beta` is partial: quoted titles, categorical `x-axis [label, ...]`, numeric `y-axis [label] min --> max`, and ordered `bar` / `line` series render as native SVG axes, bars, and polylines. Numeric x-axes, horizontal orientation, and advanced directives remain unsupported.

`sankey` and `sankey-beta` are partial: acyclic three-column CSV `source,target,value` records (including quoted commas and blank lines) render as native weighted SVG bands. Cycles, non-positive values, YAML/config directives, and custom Sankey configuration remain unsupported.

Flowcharts support `classDef <name>` and `class <node-id>[,<node-id>...] <name>` when definitions contain only `fill`, `stroke`, and `color` with three- or six-digit hexadecimal values. Multiple class assignments cascade by field, with later values winning. Visual editing is read-only for sources with either statement until it can preserve those declarations. Supported FontAwesome 4 labels such as `A[fa:fa-car Delivery]` are embedded as portable SVG icons; unknown icon names remain diagnosed. Unsupported or partial flowchart syntax includes invalid `graph` / `flowchart` directions, `style`, `click`, `linkStyle`, HTML labels, Markdown labels, quoted labels, entity-code labels, expanded/stadium/cylinder shape syntax, thick/extended edge forms, bidirectional/circle/cross edge endings, inline edge labels, edge IDs, edges to subgraph ids, hyphenated node ids, and inline class assignments. Use `getSupportMatrix()` or `analyzeSupport(source)` to inspect the current production support contract from code.

## Diagnostics

```ts
import { XMermaidError, type XMermaidDiagnostic } from '@evangwt/xmermaid';

try {
  const result = await renderer.renderToSVGElement('graph TD\n  A-->B\n  style A fill:#fff');
  const diagnostics: XMermaidDiagnostic[] = result.diagnostics;
  console.log(diagnostics);
} catch (error) {
  if (error instanceof XMermaidError) {
    console.error(error.code, error.diagnostics);
  }
}
```

Unsupported flowchart syntax is reported as `unsupported_syntax` warnings when rendering can continue. Error-severity unsupported syntax, such as invalid flowchart directions, blocks before WASM rendering. Unsupported diagram families fail before WASM rendering with `unsupported_diagram_type`.

WASM parse/layout/render failures are normalized into `XMermaidError` with structured diagnostics. Rust parser errors do not yet expose token-accurate offset/column ranges, so those diagnostics may have `range: null`.

The DOM scan helper `XMermaid.run()` keeps its compatibility behavior of writing an error message into failed `.mermaid` elements, and also exposes `data-xmermaid-error-code` plus JSON `data-xmermaid-diagnostics` on that element.

## Security Policy

The default security policy is `strict` for untrusted Mermaid input embedded in a same-origin app.

Strict mode blocks before rendering when it sees:

- Mermaid `click` callbacks or links: `security_blocked_click`
- HTML labels: `security_blocked_html`
- URL protocols outside the allowlist: `security_blocked_url`

The default URL protocol allowlist is `http:`, `https:`, and `mailto:`.

```ts
await renderer.renderToSVGElement(source, {
  securityLevel: 'loose',
});
```

`loose` only removes the security blocking for `click` and HTML labels. Those features are still unsupported by the current renderer and remain diagnostics. Dangerous URL protocols such as `javascript:` and `data:` remain blocked.

The default policy also sets `sanitizeSvg: true`. Generated SVG output is walked before return/mount; `script` and `foreignObject` elements, inline event handler attributes, and dangerous `href` values are removed. xmermaid does not execute click callbacks, does not render HTML labels as HTML, and does not provide CSP or a sandbox.

## WASM And Packaging

The published package includes the JS bundles, TypeScript declarations, and `dist/xmermaid_wasm_bg.wasm`.

By default, the bundled loader resolves that asset next to the built JS entry. Hosts with a custom asset base path can pass an explicit URL on the render that first initializes WASM:

```ts
await renderer.renderToSVGElement(source, {
  wasm: {
    wasmUrl: new URL('/assets/xmermaid_wasm_bg.wasm', window.location.href),
    fetch: window.fetch.bind(window),
  },
});
```

WASM initialization is process-global. After the module is initialized, later renders reuse the same WASM instance; change `wasmUrl` / `fetch` before the first render, not between renders.

The package also publishes the `@evangwt/xmermaid/editor` subpath for live editor imports. The packed tarball includes `README.md` and `LICENSE` alongside the runtime bundles.

Release verification uses a packed-package consumer smoke test. It runs `npm pack`, installs the tarball into a temporary project, typechecks the public API and `@evangwt/xmermaid/editor` subpath, imports the installed ESM entries, requires the installed CommonJS entries, and opens headless Chrome to render a minimal SVG through the default bundle-relative WASM asset resolution. The same Chrome smoke imports the live editor through `@evangwt/xmermaid/editor` and runs a live editor workflow: multi-diagram selection, visual rename, preview-only direction control, source direction edit, unsupported visual edit blocking, share hash generation, and SVG export readiness.

The browser smoke requires Chrome or Chromium. Set `CHROME_BIN` when CI does not expose a default Chrome executable.

```bash
CHROME_BIN=/path/to/chrome npm run smoke:consumer -- --json
```

## Troubleshooting

- `Chrome executable not found`: install Chrome/Chromium or set `CHROME_BIN`.
- `unsupported_diagram_type`: the diagram family is outside the current production support contract.
- `unsupported_syntax`: the input uses Mermaid syntax that is known but not implemented in xmermaid yet.
- `security_blocked_*`: strict security policy blocked a risky construct before rendering.
- WASM asset load failures: confirm the package tarball includes `dist/xmermaid_wasm_bg.wasm` and the app serves it with the built JS bundle.
- Missing package metadata: confirm the packed tarball includes `README.md`, `LICENSE`, and the `@evangwt/xmermaid/editor` export.

## Release Readiness

Maintainers should run the production release checklist in `docs/production-release-checklist.md`. The default release matrix includes build, packed consumer smoke, docs support matrix sync, JS tests, TypeScript, Rust tests, and whitespace checks.
