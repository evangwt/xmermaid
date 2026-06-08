---
doc_type: issue-fix
issue: 2026-06-08-current-browser-smoke-wording
path: fast-track
fix_date: 2026-06-08
tags: [docs, release, browser-smoke, codestable]
---

# Current browser smoke wording fix record

## 1. Problem

The current harsh review evidence used stale Playwright wording for a gate that is now implemented as packed Chrome/CDP consumer smoke.

## 2. Root Cause

The live editor workflow evidence was upgraded in the release gate after earlier browser checks, but the harsh review evidence line was not updated with the new execution surface.

## 3. Fix

- Update the harsh review evidence line to say `Packed Chrome/CDP consumer smoke`.
- Add `tests/codestable-docs.test.ts` so this current-state evidence wording cannot drift back to Playwright terminology.

## 4. Changed Files

- `.codestable/roadmap/multi-diagram-live-editor/harsh-review-2026-06-07.md`
- `tests/codestable-docs.test.ts`

## 5. Verification

- RED: `npm test -- tests/codestable-docs.test.ts` failed because the harsh review still said `Playwright browser smoke`.
- GREEN: `npm test -- tests/codestable-docs.test.ts` passed.
- GREEN: `python3 .codestable/tools/validate-yaml.py --file .codestable/issues/2026-06-08-current-browser-smoke-wording/current-browser-smoke-wording-report.md` passed.
- GREEN: `python3 .codestable/tools/validate-yaml.py --file .codestable/issues/2026-06-08-current-browser-smoke-wording/current-browser-smoke-wording-fix-note.md` passed.
- GREEN: `npm test -- tests/codestable-docs.test.ts tests/verify-release.test.ts tests/consumer-smoke.test.ts` passed.
- GREEN: `node scripts/verify-release.cjs --check-docs --json` passed with no missing docs checks.
- GREEN: `npm run typecheck` passed.
- GREEN: `git diff --check -- HEAD` passed.
- GREEN: `npm run verify:release` passed.

## 6. Remaining Items

Historical feature acceptance files may still mention Playwright when that was the evidence used at the time. This fix only corrects the current harsh review evidence contract.
