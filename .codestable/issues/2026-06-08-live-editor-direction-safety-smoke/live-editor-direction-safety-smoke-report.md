---
doc_type: issue-report
issue: 2026-06-08-live-editor-direction-safety-smoke
status: fixed
severity: medium
tags: [release, browser, live-editor, workflow]
---

# Live editor direction and safety paths missing from browser smoke

## 1. Problem

The live editor roadmap and harsh review called out preview-only direction control, explicit source direction edit, and unsupported visual edit safety. Those paths had unit/jsdom and real WASM contract coverage, but the packed browser consumer smoke only drove multi-diagram selection, visual rename, share hash, and SVG export readiness.

## 2. Reproduction

Run:

```bash
npm run --silent smoke:consumer -- --json
```

Before the fix, the generated smoke page did not contain or execute:

- `previewDirectionPreservesSource`
- `sourceDirectionApplied`
- `unsupportedVisualEditBlocked`

## 3. Expected Behavior

Packed browser smoke should prove the installed package can run the live editor direction and unsupported visual safety paths in real Chrome, not only in jsdom.

## 4. Impact

- Release readiness could pass while direction controls regressed in the installed browser bundle.
- Unsupported visual edit safety could be broken by packaging/browser-only behavior without the release gate catching it.
