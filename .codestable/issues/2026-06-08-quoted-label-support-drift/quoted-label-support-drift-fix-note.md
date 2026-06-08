---
doc_type: issue-fix
issue: 2026-06-08-quoted-label-support-drift
path: fast-track
fix_date: 2026-06-08
tags: [support, diagnostics, parser]
---

# Quoted label support drift fix record

## 1. Problem

Quoted label syntax was a known literal-label parser limitation, but the support analyzer did not expose it.

## 2. Root Cause

The analyzer covered Markdown, HTML, entity-code, and FontAwesome label limitations, but left quoted labels out even though Rust coverage already proved quotes were preserved literally.

## 3. Fix

- Add `flowchart.quotedLabel` to the support matrix.
- Detect bracketed labels containing quote-delimited content.
- Avoid duplicate diagnostics when the same line is already classified as a Markdown label.
- Return warning-severity unsupported syntax diagnostics so rendering can continue honestly.
- Update README, docs-sync, architecture, requirements, roadmap, and release checklist wording.

## 4. Changed Files

- `src/support.ts`
- `tests/support-matrix.test.ts`
- `scripts/verify-release.cjs`
- `tests/verify-release.test.ts`
- `README.md`
- `docs/production-release-checklist.md`
- `.codestable/architecture/ARCHITECTURE.md`
- `.codestable/requirements/production-support-contract.md`
- `.codestable/roadmap/production-readiness/production-readiness-items.yaml`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/support-matrix.test.ts` failed because quoted labels produced no unsupported feature.
- RED: `npm test -- tests/verify-release.test.ts` failed because docs sync did not require quoted label limitation docs.
- GREEN: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts tests/live-editor.test.ts tests/verify-release.test.ts` passed.
- Docs: `node scripts/verify-release.cjs --check-docs --json` passed.
- Release: `npm run verify:release` passed after re-running a transient consumer smoke failure that did not reproduce in `npm run --silent smoke:consumer -- --json`.

## 6. Remaining Items

This does not implement Mermaid quoted label parsing. That would be parser behavior, not support-contract hardening.
