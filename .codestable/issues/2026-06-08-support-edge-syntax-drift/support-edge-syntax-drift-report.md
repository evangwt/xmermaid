---
doc_type: issue-report
issue: 2026-06-08-support-edge-syntax-drift
status: fixed
severity: high
tags: [support, parser, diagnostics]
---

# Support analyzer misses edge syntax that Rust misparses

## 1. Problem

The Rust parser tests already document unsupported edge syntax that can misparse into wrong nodes or wrong edges, but the TypeScript support analyzer did not report those constructs. Inputs using those Mermaid features could proceed as partial flowcharts without structured unsupported diagnostics.

## 2. Reproduction

```ts
detectUnsupportedFeatures([
  'flowchart TD',
  '  A<-->B',
  '  C--oD',
  '  E--xF',
  '  G-- inline label -->H',
  '  I e1@-->J',
].join('\n'));
```

Observed before the fix:

```json
[]
```

Rust evidence: `crates/xmermaid-parser/tests/syntax_coverage_test.rs` marks bidirectional arrows, circle/cross edge endings, inline edge labels, and edge ID syntax as unsupported or lossy.

## 3. Expected Behavior

Known lossy edge syntax should produce error-severity `unsupported_syntax` diagnostics before render or visual validation reaches the parser.

## 4. Impact

- The public support contract was weaker than the parser's documented limitations.
- Users could receive a wrong graph instead of an unsupported syntax diagnostic.
- Visual/editor safety checks could treat lossy edge syntax as safe until parser behavior leaked through.
