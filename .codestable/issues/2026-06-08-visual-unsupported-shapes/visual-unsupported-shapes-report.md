---
doc_type: issue-report
issue: 2026-06-08-visual-unsupported-shapes
status: fixed
severity: high
tags: [editor, visual-edit, support, wasm]
---

# Visual validation accepts parser-unsupported shape syntax

## 1. Problem

The visual flowchart serializer could emit stadium and cylinder/database shape syntax even though the Rust parser does not currently roundtrip those Mermaid shapes correctly. `validateVisualEditResult()` then accepted the result because the parser misread the syntax as a supported shape instead of failing.

## 2. Reproduction

```ts
const source = serializeFlowchart({
  direction: 'TD',
  nodes: [{ id: 'A', label: 'Start', shape: 'stadium' }],
  edges: [],
  subgraphs: [],
});

await validateVisualEditResult(source, realWasmVisualOptions);
```

Observed before the fix:

```json
{
  "status": "applied",
  "model": {
    "nodes": [
      { "id": "A", "label": "[Start]", "shape": "rounded" }
    ]
  }
}
```

That is a silent semantic loss: the requested stadium shape became a rounded node with a bracketed label.

## 3. Expected Behavior

Unsupported visual shape syntax must be blocked by the same support analyzer safety gate used for `classDef`, before parser/render validation can accept a lossy roundtrip.

## 4. Impact

- Visual edit validation could claim success while changing the graph model semantics.
- The frontend serializer and Rust parser support surfaces were inconsistent.
- Users could export or save normalized Mermaid that no longer represented the intended visual model.
