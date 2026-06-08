---
doc_type: issue-fix
issue: 2026-06-08-example-unsupported-shapes
path: fast-track
fix_date: 2026-06-08
tags: [examples, support, live-editor]
---

# Example unsupported shape fix record

## 1. Problem

User-facing HTML examples still used Mermaid cylinder shape syntax after the production support matrix started blocking that syntax as error-severity unsupported.

## 2. Root Cause

The support analyzer and visual roundtrip tests were hardened, but example fixtures were not checked against the same support boundary.

## 3. Fix

- Add a regression test that rejects parser-unsupported stadium/cylinder shape examples in browser HTML fixtures.
- Replace `DB[(Database)]` with `DB[Database]` in the live editor example.
- Replace `DB[(Database)]` and `Cache[(Cache)]` with supported rect labels in the basic example.

## 4. Changed Files

- `tests/live-editor.test.ts`
- `examples/live-editor.html`
- `examples/basic.html`

## 5. Verification

- RED: `npm test -- tests/live-editor.test.ts` failed because `examples/live-editor.html` contained `DB[(Database)]`.
- GREEN: `npm test -- tests/live-editor.test.ts` passed with 68 tests.

## 6. Remaining Items

The consumer browser smoke still verifies only mount/render for a minimal live editor fixture. A future hardening pass should drive the public example or core toolbar workflows in real Chrome.
