---
doc_type: issue-report
issue: 2026-06-08-architecture-wasm-loader-contract
status: fixed
severity: low
tags: [docs, architecture, wasm, sdk-contract]
---

# Architecture doc still described wasmUrl as future-only

## 1. Problem

`.codestable/architecture/ARCHITECTURE.md` said `WasmInitOptions` was only a future custom WASM loading boundary and that current loader behavior was unchanged. That is no longer true: `src/wasm.ts` passes `options.wasmUrl` to wasm-pack initialization, README documents per-render `wasm.wasmUrl`, and consumer smoke uses an explicit installed WASM asset URL.

## 2. Reproduction

Run:

```bash
npm test -- tests/codestable-docs.test.ts
```

Before the fix, the CodeStable docs test failed because the architecture doc still contained the stale future-only loader wording.

## 3. Expected Behavior

Current architecture documentation should state that `RenderOptions.wasm.wasmUrl` is active SDK behavior and that the URL is passed to wasm-pack initialization.

## 4. Impact

- Future SDK changes could incorrectly treat custom WASM asset loading as unimplemented.
- Production docs and architecture docs disagreed about a packaging-critical browser deployment path.
