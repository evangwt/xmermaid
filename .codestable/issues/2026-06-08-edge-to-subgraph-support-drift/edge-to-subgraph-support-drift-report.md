---
doc_type: issue-report
issue: 2026-06-08-edge-to-subgraph-support-drift
status: fixed
severity: high
tags: [support, diagnostics, parser, subgraph]
---

# Edge-to-subgraph syntax missing from support diagnostics

## 1. Problem

Rust parser falsification coverage documents that edges pointing at a subgraph id do not have Mermaid compound-edge semantics. The parser can still parse the source, but the edge target is treated like a regular node reference instead of a subgraph boundary.

The production support analyzer did not report this limitation.

## 2. Reproduction

```ts
detectUnsupportedFeatures([
  'flowchart TD',
  '  A-->sub1',
  '  subgraph sub1',
  '    B-->C',
  '  end',
].join('\n'));
```

Observed before the fix:

```json
[]
```

## 3. Expected Behavior

Edges to subgraph ids should produce error-severity `unsupported_syntax` diagnostics before render or visual rewrite can accept a wrong graph.

## 4. Impact

- A source that looks like a Mermaid compound edge could render as an ordinary edge to a node named after the subgraph id.
- The support matrix claimed partial subgraph support without exposing a known semantic boundary.
- Live editor visual rewrite safety could accept source whose subgraph semantics it cannot preserve.
