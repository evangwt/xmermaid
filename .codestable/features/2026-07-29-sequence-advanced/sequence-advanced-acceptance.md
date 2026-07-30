---
doc_type: feature-acceptance
feature: 2026-07-29-sequence-advanced
status: in-progress
summary: Evidence record for native sequence activation, notes, and control blocks.
tags: [production, sequence, wasm, renderer]
---

# sequence-advanced acceptance report

## Executed scope

- Added typed ordered sequence events for messages, explicit lifecycle actions, notes, and nested control-block boundaries.
- Replaced sequence relationship-flowchart projection with native timeline geometry and SVG lifelines, messages, activations, notes, blocks, and branch dividers.
- Preserved public declaration/message fields; all newly exposed TypeScript message fields are optional for existing consumers.
- Added bare `autonumber`, validated RGB `rect` frames, and dashed `--x` cross message endings while keeping `create` / `destroy`, `box`, links, and advanced autonumber or rect forms fail-closed.
- Confirmed Mermaid’s shortcut semantics: `+` activates the message target and `-` deactivates the message sender; unmatched deactivation now fails in the parser rather than disappearing in layout.

## Verification

- `cargo test` — Rust parser, layout, and WASM workspace passed.
- `npm test` — 279 xmermaid TypeScript tests passed, including real-WASM and SVG sequence regressions.
- `npm run verify:release` — build, packed consumer install/typecheck/import/browser smoke, docs-sync, TypeScript, Rust, and whitespace gates passed.
- `npm test` in `xmermaid-live` — 87 tests passed.
- `npm run build` in `xmermaid-live` — copied the vendored WASM and produced the static app successfully.
- `npx playwright test` in `xmermaid-live` — 122 tests passed across Chromium, Firefox, and WebKit; advanced sequence cases asserted updated preview status plus native lifeline, activation, note, block, divider, autonumber, RGB rect, and cross-termination SVG groups. Live-shell regressions also cover SVG presentation, panning selection suppression, clipboard fallback, and multi-diagram diagnostic context.
- `npx vitest run tests/copy-wasm.test.ts` in `xmermaid-live` — vendored tarball, provenance hashes, installed WASM, and copied public WASM matched.

## Status

Implementation and verification are complete. This record remains `in-progress` until the user explicitly requests CodeStable acceptance/closure; no commit or feature close was performed.
