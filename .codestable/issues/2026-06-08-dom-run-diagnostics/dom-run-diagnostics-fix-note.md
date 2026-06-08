---
doc_type: issue-fix
issue: 2026-06-08-dom-run-diagnostics
path: fast-track
fix_date: 2026-06-08
tags: [sdk, diagnostics, dom]
---

# DOM scan diagnostics fix record

## 1. Problem

`XMermaid.run()` discarded structured diagnostics when rendering a scanned `.mermaid` element failed.

## 2. Root Cause

The catch block in `src/xmermaid.ts` wrote only text content from the thrown error and did not inspect `XMermaidError.diagnostics`.

## 3. Fix

- On each DOM scan render attempt, clear stale diagnostic data attributes.
- On failure, set `data-xmermaid-error-code`.
- On failure, set JSON `data-xmermaid-diagnostics`.
- Preserve the existing text error behavior for compatibility.
- Document the DOM scan diagnostics surface in README, architecture, and production roadmap.

## 4. Changed Files

- `src/xmermaid.ts`
- `tests/xmermaid.test.ts`
- `README.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/xmermaid.test.ts` failed because `data-xmermaid-error-code` was missing on a failed DOM scan render.
- GREEN: `npm test -- tests/xmermaid.test.ts` passed.
- Typecheck: `npm run typecheck` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

This exposes diagnostics to DOM scan consumers. It does not add a callback API or event protocol.
