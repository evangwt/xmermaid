---
doc_type: issue-fix
issue: 2026-06-08-unknown-diagram-preflight
path: fast-track
fix_date: 2026-06-08
tags: [support, diagnostics, sdk]
---

# Unknown diagram preflight fix record

## 1. Problem

Unknown sources were classified as unsupported at the report level but produced no unsupported feature for the render preflight to consume.

## 2. Root Cause

`detectDiagramType()` returned `unknown`, but `unsupportedDiagramFeature()` returned `null` for that diagram type. The SDK render path was already correct for `unsupported_diagram_type`; the analyzer simply failed to emit one for unknown sources.

## 3. Fix

- Add `diagram.unknown` to `UnsupportedFeatureId`.
- Add an `unknown` unsupported entry to the support matrix.
- Make `detectUnsupportedFeatures()` return a `diagram.unknown` error feature for unknown sources.
- Preserve the existing user-facing message: `Unknown diagram type is not supported yet.`
- Add tests proving both `analyzeSupport()` and `renderToSVGElement()` enforce the contract.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `tests/xmermaid.test.ts`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because `unsupportedFeatures` was empty for `not a diagram`.
- RED: `npm test -- tests/xmermaid.test.ts` failed because `renderToSVGElement('not a diagram')` resolved instead of rejecting.
- GREEN: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts` passed.
- Typecheck: `npm run typecheck` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

The support analyzer still needs a broader pass over known Rust parser falsification cases, such as edge and shape syntax that currently misparses instead of producing support diagnostics. That is separate from this unknown diagram preflight fix.
