---
doc_type: issue
issue: 2026-06-08-current-architecture-and-smoke-drift
status: fixed
severity: P1
tags: [codestable, architecture, release-gate]
---

# Current architecture and smoke gate drift report

## Summary

The current architecture map still carried historical planning appendices for plugins, Server SDK, CLI, Canvas, early API drafts, and full Mermaid milestones. The release smoke also proved the live editor in Chrome through the root bundle export, while the published contract says the browser-facing live editor subpath is `xmermaid/editor`.

## Evidence

- `.codestable/architecture/ARCHITECTURE.md` contained historical planning sections after the current edge geometry contract, including plugin APIs, `renderToCanvas`, Server SDK, CLI, and v1.0 milestone drafts.
- `scripts/consumer-smoke.cjs` generated a Chrome smoke page that imported `XMermaidLiveEditor` from `xmermaid` instead of `xmermaid/editor`.
- The same Chrome page initialized rendering with an explicit `wasmUrl`, so default bundle-relative WASM asset resolution was not the first browser initialization path.

## Expected Behavior

Current architecture documentation should contain only current implementation facts and explicit out-of-scope boundaries. Release smoke should prove the browser path users are told to use: default WASM asset loading from the installed bundle and live editor import through `xmermaid/editor`.

## Impact

**P1** — The runtime product remained usable, but the evidence system could mislead future implementation work toward unbuilt concepts and overstate what the browser consumer gate proved.
