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

## Current Support

xmermaid currently focuses on browser-side SVG rendering for Mermaid flowcharts. It supports basic `graph` / `flowchart` declarations, basic nodes and directed edges, common labels, core shapes, and partial subgraph parsing.

This is partial Mermaid support, not full Mermaid compatibility.

Unsupported diagram families currently include:

- `sequenceDiagram`
- `classDiagram`
- `stateDiagram`
- `erDiagram`
- `gantt`
- `pie`
- `mindmap`

Unsupported or partial flowchart syntax includes invalid `graph` / `flowchart` directions, `class`, `classDef`, `style`, `click`, HTML labels, and Markdown labels. Use `getSupportMatrix()` or `analyzeSupport(source)` to inspect the current production support contract from code.

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

xmermaid does not execute click callbacks, does not render HTML labels as HTML, and does not provide a sanitizer, CSP, or sandbox.

## WASM And Packaging

The published package includes the JS bundles, TypeScript declarations, and `dist/xmermaid_wasm_bg.wasm`.

By default, the bundled loader resolves that asset next to the built JS entry. Hosts with a custom asset base path can pass an explicit URL per render:

```ts
await renderer.renderToSVGElement(source, {
  wasm: {
    wasmUrl: new URL('/assets/xmermaid_wasm_bg.wasm', window.location.href),
  },
});
```

Release verification uses a packed-package consumer smoke test. It runs `npm pack`, installs the tarball into a temporary project, typechecks the public API, imports the installed ESM entry, requires the installed CommonJS entry, and opens headless Chrome to render a minimal SVG and mount the live editor with the installed WASM asset.

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

## Release Readiness

Maintainers should run the production release checklist in `docs/production-release-checklist.md`. The default release matrix includes build, packed consumer smoke, docs support matrix sync, JS tests, TypeScript, Rust tests, and whitespace checks.
