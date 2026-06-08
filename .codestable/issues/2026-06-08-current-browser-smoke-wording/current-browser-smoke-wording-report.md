---
doc_type: issue-report
issue: 2026-06-08-current-browser-smoke-wording
status: fixed
severity: low
tags: [docs, release, browser-smoke, codestable]
---

# Current browser smoke evidence used stale Playwright wording

## 1. Problem

The multi-diagram live editor harsh review described the current browser evidence as a "Playwright browser smoke" even though the release gate now proves the workflow through `scripts/consumer-smoke.cjs`, which installs the packed package into a temporary consumer and drives headless Chrome through CDP.

## 2. Reproduction

Run:

```bash
npm test -- tests/codestable-docs.test.ts
```

Before the fix, the test failed because `.codestable/roadmap/multi-diagram-live-editor/harsh-review-2026-06-07.md` still contained `Playwright browser smoke`.

## 3. Expected Behavior

Current-state review evidence should name the gate that is actually repeatable today: packed Chrome/CDP consumer smoke.

## 4. Impact

- Future roadmap audits could overstate a Playwright dependency that the production release gate intentionally avoids.
- Review readers could miss that the evidence now runs against the installed package, not only a local dev page.
