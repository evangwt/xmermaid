---
doc_type: issue-report
issue: 2026-06-08-support-parser-falsification-drift
status: fixed
severity: high
tags: [support, parser, diagnostics]
---

# Support analyzer missed parser falsification cases

## 1. Problem

Rust parser coverage documents several flowchart syntax forms that are unsupported or lossy, but the TypeScript production support analyzer did not report them.

The missing cases were:

- expanded shape syntax: `A@{ shape: cloud }`
- thick line edges without arrowheads: `A===B`
- extended line edges without arrowheads: `A----B`
- extended thick edge arrows: `A===>B`
- inline class assignment: `A:::hot-->B`
- `linkStyle` statements

## 2. Reproduction

```ts
detectUnsupportedFeatures([
  'flowchart TD',
  '  A@{ shape: cloud }',
  '  B===C',
  '  D----E',
  '  F===>G',
  '  H:::hot-->I',
  '  linkStyle 0 stroke:#ff3',
].join('\n'));
```

Observed before the fix:

```json
[]
```

## 3. Expected Behavior

Known lossy parser falsification cases should produce error-severity `unsupported_syntax` diagnostics before render, live editor visual analysis, or visual validation can accept a wrong graph.

## 4. Impact

- Inputs could render with wrong shapes, wrong edge styles, or spurious nodes.
- The support matrix under-reported parser limitations that were already known in Rust tests.
- Visual edit safety depended on an incomplete support analyzer.
