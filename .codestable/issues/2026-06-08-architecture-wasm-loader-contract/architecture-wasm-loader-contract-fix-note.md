---
doc_type: issue-fix
issue: 2026-06-08-architecture-wasm-loader-contract
path: fast-track
fix_date: 2026-06-08
tags: [docs, architecture, wasm, sdk-contract]
---

# Architecture wasm loader contract fix record

## 1. Problem

The current architecture doc lagged behind implementation and README behavior for explicit WASM asset URL loading.

## 2. Root Cause

`render-svg-api` originally introduced `WasmInitOptions` as a type boundary. Later packaging fixes made `wasm.wasmUrl` active loader behavior, but architecture wording was not updated.

## 3. Fix

- Update `ARCHITECTURE.md` to state that `RenderOptions.wasm.wasmUrl` is supported current behavior.
- Add `tests/codestable-docs.test.ts` coverage so the architecture doc cannot drift back to future-only wording.

## 4. Changed Files

- `.codestable/architecture/ARCHITECTURE.md`
- `tests/codestable-docs.test.ts`

## 5. Verification

- RED: `npm test -- tests/codestable-docs.test.ts` failed because `ARCHITECTURE.md` still described `WasmInitOptions` as future-only loader behavior.
- GREEN: `npm test -- tests/codestable-docs.test.ts` passed.
- GREEN: `python3 .codestable/tools/validate-yaml.py --file .codestable/issues/2026-06-08-architecture-wasm-loader-contract/architecture-wasm-loader-contract-report.md` passed.
- GREEN: `python3 .codestable/tools/validate-yaml.py --file .codestable/issues/2026-06-08-architecture-wasm-loader-contract/architecture-wasm-loader-contract-fix-note.md` passed.
- GREEN: `npm test -- tests/codestable-docs.test.ts tests/wasm.test.ts tests/xmermaid.test.ts tests/verify-release.test.ts tests/consumer-smoke.test.ts` passed.
- GREEN: `node scripts/verify-release.cjs --check-docs --json` passed with no missing docs checks.
- GREEN: `npm run typecheck` passed.
- GREEN: `git diff --check -- HEAD` passed.
- GREEN: `npm run verify:release` passed.

## 6. Remaining Items

Historical feature acceptance files still preserve the older state of the `render-svg-api` feature. This fix only corrects the current architecture map.
