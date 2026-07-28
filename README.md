# xmermaid

Flowchart-focused Mermaid renderer with partial Mermaid support, powered by Rust WASM.

## Install

```bash
npm install xmermaid
```

xmermaid is a browser SDK. The root ESM bundle can be parsed by Node and SSR tooling, but DOM rendering requires a browser-like environment.

## Browser Usage

```ts
import { XMermaid, analyzeSupport } from 'xmermaid';

const source = 'graph TD\n  A[Start] --> B[End]';
const report = analyzeSupport(source);

const container = document.getElementById('diagram');
if (!container) throw new Error('Missing diagram container');

const renderer = new XMermaid({ container });
await renderer.render(source);
```

## Live Editor Usage

The static live editor API is available from the `xmermaid/editor` subpath.

```ts
import { XMermaidLiveEditor } from 'xmermaid/editor';

const editor = new XMermaidLiveEditor({
  root: document.getElementById('editor')!,
  initialText: '```mermaid\nflowchart TD\n  A --> B\n```',
});

await editor.mount();
```

## SVG API

Use `renderToSVGElement()` when the host app owns mounting, serialization, storage, or post-processing.

```ts
import { XMermaid } from 'xmermaid';

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
import { DARK_THEME, XMermaid, type RenderTheme } from 'xmermaid';

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

xmermaid currently focuses on browser-side SVG rendering for Mermaid flowcharts. It supports basic `graph` / `flowchart` declarations, basic nodes and directed edges, common labels, core shapes, and partial subgraph parsing. It also renders deliberately small subsets of Sequence, Class, State, Entity Relationship, User Journey, Gantt, Pie, Mindmap, Timeline, Requirement, GitGraph, C4, and ZenUML diagrams.

This is partial Mermaid support, not full Mermaid compatibility.

All remaining Mermaid catalog families are explicitly marked `planned` in `getSupportMatrix()` and rejected before WASM rendering.

`sequenceDiagram` is partial: activation bars, explicit participant aliases, notes, loops, and alternate branches remain unsupported. `getSupportMatrix()` or `analyzeSupport(source)` exposes that boundary programmatically.

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

`zenuml` is partial: labeled `->` calls and `-->` returns render as distinct solid and dashed arrows; blocks, declarations, async messages, and advanced control syntax remain unsupported.

Unsupported or partial flowchart syntax includes invalid `graph` / `flowchart` directions, `class`, `classDef`, `style`, `click`, `linkStyle`, HTML labels, Markdown labels, quoted labels, entity-code labels, FontAwesome icon labels, expanded/stadium/cylinder shape syntax, thick/extended edge forms, bidirectional/circle/cross edge endings, inline edge labels, edge IDs, edges to subgraph ids, hyphenated node ids, and inline class assignments. Use `getSupportMatrix()` or `analyzeSupport(source)` to inspect the current production support contract from code.

## Diagnostics

```ts
import { XMermaidError, type XMermaidDiagnostic } from 'xmermaid';

try {
  const result = await renderer.renderToSVGElement('graph TD\n  A-->B\n  classDef hot fill:#fff');
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

The package also publishes the `xmermaid/editor` subpath for live editor imports. The packed tarball includes `README.md` and `LICENSE` alongside the runtime bundles.

Release verification uses a packed-package consumer smoke test. It runs `npm pack`, installs the tarball into a temporary project, typechecks the public API and `xmermaid/editor` subpath, imports the installed ESM entries, requires the installed CommonJS entries, and opens headless Chrome to render a minimal SVG through the default bundle-relative WASM asset resolution. The same Chrome smoke imports the live editor through `xmermaid/editor` and runs a live editor workflow: multi-diagram selection, visual rename, preview-only direction control, source direction edit, unsupported visual edit blocking, share hash generation, and SVG export readiness.

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
- Missing package metadata: confirm the packed tarball includes `README.md`, `LICENSE`, and the `xmermaid/editor` export.

## Release Readiness

Maintainers should run the production release checklist in `docs/production-release-checklist.md`. The default release matrix includes build, packed consumer smoke, docs support matrix sync, JS tests, TypeScript, Rust tests, and whitespace checks.
