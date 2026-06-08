---
doc_type: issue-report
issue: 2026-06-08-live-editor-browser-smoke
status: fixed
severity: medium
tags: [release, browser, live-editor]
---

# Live editor missing from packed browser smoke

## 1. Problem

The multi-diagram live editor roadmap was marked done, but the release consumer smoke only proved the installed package could render a minimal SDK SVG in headless Chrome. It did not mount `XMermaidLiveEditor` through the packed package in a real browser.

## 2. Reproduction

Run:

```bash
npm run --silent smoke:consumer -- --json
```

Before the fix, the JSON checks included browser render evidence but no live editor render evidence.

## 3. Expected Behavior

Packed consumer smoke should prove that the installed package can mount the live editor and render a preview SVG in headless Chrome.

## 4. Impact

- Live editor confidence depended mostly on jsdom and helper tests.
- Release readiness could pass even if the installed live editor export or browser mount path regressed.
- Roadmap status was stronger than the browser-level release evidence.
