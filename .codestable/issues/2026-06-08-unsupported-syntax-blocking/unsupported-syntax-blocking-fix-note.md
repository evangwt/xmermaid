---
doc_type: issue-fix
issue: 2026-06-08-unsupported-syntax-blocking
path: fast-track
fix_date: 2026-06-08
tags: [sdk, diagnostics, support]
---

# Unsupported syntax blocking fix record

## 1. Problem

`renderToSVGElement()` did not block error-severity `unsupported_syntax` diagnostics.

## 2. Root Cause

The render preflight only blocked `unsupported_diagram_type` and `security_blocked_*` diagnostics. It did not distinguish warning-level unsupported syntax, which can be returned with a successful partial render, from error-level unsupported syntax, which should stop before WASM.

## 3. Fix

- Add a preflight check for `diagnostic.code === 'unsupported_syntax' && diagnostic.severity === 'error'`.
- Throw `XMermaidError('RENDER_ERROR')` with the existing diagnostics array.
- Keep warning-severity unsupported syntax non-blocking.
- Update README, architecture, and production roadmap wording.

## 4. Changed Files

- `src/xmermaid.ts`
- `tests/xmermaid.test.ts`
- `README.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/xmermaid.test.ts` failed because `graph XXX` resolved with an SVG and an error diagnostic.
- GREEN: `npm test -- tests/xmermaid.test.ts` passed.
- Typecheck: `npm run typecheck` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

None for this issue. This keeps the existing diagnostic vocabulary and does not add an `UNSUPPORTED_SYNTAX` top-level error code.
