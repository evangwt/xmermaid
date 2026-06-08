---
doc_type: issue
issue: 2026-06-08-current-architecture-and-smoke-drift
status: fixed
tags: [codestable, architecture, release-gate]
---

# Current architecture and smoke gate drift fix record

## Root Cause

Historical planning material stayed inside the current architecture map after the project narrowed to a browser SVG flowchart SDK. The packed consumer smoke grew live editor coverage but reused the root bundle import path in Chrome, leaving the published `xmermaid/editor` browser path and default WASM asset resolution under-proven.

## Fix

- Removed historical planning appendices from `.codestable/architecture/ARCHITECTURE.md`.
- Added a current architecture boundary section that keeps plugins, CLI/Server SDK, Canvas renderer, complete Mermaid compatibility, and full drag/drop editor work out of current facts until a future roadmap actually lands them.
- Updated `scripts/consumer-smoke.cjs` so the Chrome smoke imports `XMermaidLiveEditor` through `xmermaid/editor`.
- Updated the Chrome smoke so the first render uses default bundle-relative WASM asset resolution instead of an explicit `wasmUrl`.
- Tightened docs and tests so README, release checklist, architecture, and docs sync gate describe and enforce the stronger release smoke contract.
- Updated production-readiness roadmap notes to match the stronger completed gate.

## Verification

- `npm test -- tests/codestable-docs.test.ts tests/consumer-smoke.test.ts tests/verify-release.test.ts`
- `node scripts/verify-release.cjs --check-docs --json`
- `npm run verify:release`

## Remaining Risk

No remaining blocker for this issue. Historical planning documents still exist under `docs/plans/` as archive material; they must not be treated as current architecture or production API contracts.
