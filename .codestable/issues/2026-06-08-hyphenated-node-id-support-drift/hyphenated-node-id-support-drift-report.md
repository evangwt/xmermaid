---
doc_type: issue-report
issue: 2026-06-08-hyphenated-node-id-support-drift
status: fixed
severity: high
tags: [support, diagnostics, parser]
---

# Hyphenated node ids missing from support diagnostics

## 1. Problem

Rust parser falsification coverage documents that hyphens are tokenized as arrow characters, not as part of node ids. A source such as `my-node-->B` does not produce a node named `my-node`; it splits into wrong nodes and edges.

The production support analyzer did not report this limitation.

## 2. Reproduction

```ts
detectUnsupportedFeatures('flowchart TD\n  my-node-->B');
```

Observed before the fix:

```json
[]
```

Real WASM parse result before the fix contained nodes `my`, `node`, and `B`, with edge `node -> B`.

## 3. Expected Behavior

Hyphenated node ids in edge endpoints should produce error-severity `unsupported_syntax` diagnostics before render or visual rewrite can accept a wrong graph.

## 4. Impact

- The rendered graph could silently differ from the user source.
- The support matrix under-reported a known parser limitation.
- Live editor visual rewrite safety could accept source whose node identity it cannot preserve.
