---
doc_type: issue-report
issue: 2026-06-08-special-label-support-drift
status: fixed
severity: medium
tags: [support, diagnostics, parser]
---

# Special label syntax missing from support diagnostics

## 1. Problem

Rust parser falsification tests already document that Mermaid entity-code labels and FontAwesome labels are preserved as literal text rather than rendered with Mermaid-compatible semantics.

The production support analyzer did not expose either limitation.

## 2. Reproduction

```ts
detectUnsupportedFeatures([
  'flowchart TD',
  '  A[#35;]',
  '  B[fa:fa-car Text]',
].join('\n'));
```

Observed before the fix:

```json
[]
```

## 3. Expected Behavior

Known special label syntax that xmermaid preserves literally should appear in the support matrix and `unsupported_syntax` diagnostics. Rendering may continue, but the user should not have to discover by visual surprise that Mermaid label semantics were not applied.

## 4. Impact

- The support matrix under-reported known parser limitations.
- Users could interpret literal `#35;` or `fa:fa-car` output as a renderer bug instead of a documented unsupported feature.
- Live editor visual safety relied on an incomplete support analyzer.
