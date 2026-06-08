---
doc_type: issue-fix
issue: 2026-06-08-cjs-package-entry
path: fast-track
fix_date: 2026-06-08
tags: [packaging, release, sdk]
---

# CommonJS package entry fix record

## 1. Problem

The package manifest promised a CommonJS require entry, but pointed it at a `.js` file inside a `"type": "module"` package.

## 2. Root Cause

`rollup.config.ts` generated CommonJS code to `dist/xmermaid.js`, and `package.json` pointed both `main` and `exports["."].require` at that path. Node interpreted the installed `.js` file as ESM and rejected the generated `exports.*` assignments.

## 3. Fix

- Rename the CommonJS build output to `dist/xmermaid.cjs`.
- Point `package.json` `main` and `exports["."].require` to `dist/xmermaid.cjs`.
- Require `dist/xmermaid.cjs` in packed package file checks.
- Add an installed-package CommonJS require check to the consumer smoke path.
- Update release docs to describe the CJS check.

## 4. Changed Files

- `package.json`
- `rollup.config.ts`
- `scripts/consumer-smoke.cjs`
- `tests/consumer-smoke.test.ts`
- `README.md`
- `docs/production-release-checklist.md`
- `.codestable/roadmap/production-readiness/production-readiness-roadmap.md`

## 5. Verification

- RED: `npm test -- tests/consumer-smoke.test.ts` failed because `require('xmermaid')` hit `ReferenceError: exports is not defined in ES module scope`.
- GREEN: `npm test -- tests/consumer-smoke.test.ts` passed.
- Packed smoke: `npm run --silent smoke:consumer -- --json` passed and included `cjs-require`.
- Typecheck: `npm run typecheck` passed.
- Whitespace: `git diff --check -- HEAD` passed.
- Release: `npm run verify:release` passed all required commands.

## 6. Remaining Items

None for this issue. Browser rendering remains the product runtime promise; CJS is a package compatibility entry, not a Node rendering promise.
