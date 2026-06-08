---
doc_type: issue-report
issue: 2026-06-08-live-editor-workflow-smoke
status: fixed
severity: high
tags: [release, browser, live-editor, workflow]
---

# Live editor workflow missing from packed browser smoke

## 1. Problem

The production roadmap claimed a live editor closure around multi-diagram editing, sharing, and export, but the packed browser consumer smoke only proved that the installed live editor mounted and produced an initial preview SVG.

That is not a product workflow. It is a pulse check.

## 2. Reproduction

Run:

```bash
npm run --silent smoke:consumer -- --json
```

Before the fix, the JSON checks included `live-editor-render`, but had no check proving that a real browser could switch diagrams, apply a visual edit, update the shared source, generate a namespaced share hash, or prepare SVG export.

## 3. Expected Behavior

Packed consumer smoke should drive the installed live editor through the minimal user workflow promised by the roadmap:

- extract a multi-diagram document
- switch to the second diagram
- apply a visual node rename
- reflect the rename into selected source, full document, and preview
- generate a `#xm=` share hash containing the updated document
- prepare SVG export through the browser event and download link

## 4. Impact

- Release readiness could pass while the live editor was only mountable, not usable.
- Visual edit, share, and export regressions could escape the packed-package gate.
- The roadmap status was stronger than the production evidence.
