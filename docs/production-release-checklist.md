# Production Release Checklist

This checklist is the release-facing contract for xmermaid 0.1.x. It covers the current browser SDK only.

## Scope

- xmermaid is flowchart-focused and provides partial Mermaid support.
- The release must not claim full Mermaid compatibility.
- The package must support browser-side SVG rendering for basic flowcharts, publish the `xmermaid/editor` live editor subpath, and run the live editor browser smoke path through multi-diagram selection, visual rename, preview-only direction control, source direction edit, unsupported visual edit blocking, share hash generation, and SVG export readiness.
- Node/SSR parsing of the root ESM entry and CommonJS `require('xmermaid')` are package compatibility checks, not Node rendering promises.

## Environment

- Install npm dependencies before running release gates.
- Rust and Cargo must be available for the workspace tests.
- Chrome or Chromium must be available for packed consumer smoke.
- Set `CHROME_BIN` when CI cannot discover Chrome automatically.

## Required Matrix

`npm run verify:release` runs these required command ids:

| Command id | Command | Owner |
| --- | --- | --- |
| `wasm-js-build` | `npm run build` | toolchain |
| `consumer-pack-install` | `npm run --silent smoke:consumer -- --json` | packaging |
| `docs-support-matrix-sync` | `node scripts/verify-release.cjs --check-docs` | docs |
| `js-unit` | `npm test` | code |
| `ts-typecheck` | `npm run typecheck` | code |
| `rust-workspace` | `cargo test` | code |
| `diff-whitespace` | `git diff --check -- HEAD` | code |

## Package Requirements

The packed tarball must contain:

- `dist/index.d.ts`
- `dist/support.d.ts`
- `dist/xmermaid.esm.js`
- `dist/xmermaid.cjs`
- `dist/xmermaid_wasm_bg.wasm`
- `README.md`
- `LICENSE`
- `package.json`

The TypeScript declarations must expose:

- `RenderOptions`, `RenderResult`, and `WasmInitOptions`
- `XMermaidDiagnosticCode`, `XMermaidDiagnostic`, and `SourceRange`
- `SecurityLevel`, `SecurityPolicy`, and `DEFAULT_SECURITY_POLICY`
- support matrix APIs including `getSupportMatrix()`, `analyzeSupport()`, and `detectUnsupportedFeatures()`
- the `xmermaid/editor` subpath types including `XMermaidLiveEditor` and `XMermaidLiveEditorOptions`

## Documentation Sync

The docs support matrix sync gate must pass before release. It checks that:

- `package.json.description` says flowchart and partial.
- README says partial Mermaid support.
- README lists unsupported diagram families including `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`, `gantt`, `pie`, and `mindmap`.
- README documents diagnostics, quoted/entity-code/FontAwesome label limitations, edges to subgraph ids and hyphenated node ids limitations, and security strict defaults.
- README documents `xmermaid/editor`, packed consumer smoke, Chrome/`CHROME_BIN`, the live editor workflow smoke, live editor direction/safety smoke, `WasmInitOptions.fetch`, first-initialization WASM reuse semantics, and generated SVG sanitization.
- This checklist lists `LICENSE` and the `xmermaid/editor` subpath package contract.
- This checklist includes every default release matrix command id.

## Manual Review

Before publishing:

- Confirm README does not claim full Mermaid compatibility.
- Confirm security policy text says strict is default.
- Confirm `loose` does not imply dangerous URL protocols are allowed.
- Confirm `sanitizeSvg: true` is the default and generated SVG sanitization is not represented as a CSP or sandbox.
- Confirm custom `wasmUrl` / `fetch` guidance says WASM is initialized once and reused after first render.
- Confirm package size and browser render duration from consumer smoke are recorded in the JSON summary, and that the smoke includes ESM import, CommonJS require, `xmermaid/editor` subpath import/require, browser render, live editor render, and live editor workflow checks including direction controls and unsupported visual edit blocking.
- Confirm no generated `dist/` or `pkg/` artifacts are staged unless the release process explicitly requires them.

## Failure Handling

- `consumer-pack-install` failure belongs to packaging until proven otherwise.
- `docs-support-matrix-sync` failure belongs to docs and release contract drift.
- `wasm-js-build` failure belongs to toolchain.
- `js-unit`, `ts-typecheck`, and `rust-workspace` failures belong to code.
- `diff-whitespace` failure belongs to the current diff.
