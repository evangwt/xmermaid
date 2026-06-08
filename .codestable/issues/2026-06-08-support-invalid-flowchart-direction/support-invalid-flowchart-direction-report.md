---
doc_type: issue-report
issue: 2026-06-08-support-invalid-flowchart-direction
status: fixed
severity: high
tags: [support, diagnostics, parser]
---

# Support analyzer misses invalid flowchart directions

## 1. Problem

`analyzeSupport()` reported `graph XXX\n  A-->B` as a partial flowchart with no unsupported features, even though the Rust parser rejects the same source because `XXX` is not a valid flowchart direction.

This made the support analyzer less strict than the parser for a core declaration syntax.

## 2. Reproduction

```ts
analyzeSupport('graph XXX\n  A-->B')
```

Observed result before the fix:

```json
{
  "diagramType": "flowchart",
  "status": "partial",
  "unsupportedFeatures": []
}
```

Parser evidence: `crates/xmermaid-parser/tests/parser_comprehensive_test.rs` already asserts `parse("graph XXX\n  A-->B")` returns an error.

## 3. Expected Behavior

The support analyzer should report a source-range diagnostic for invalid `graph` / `flowchart` directions before rendering reaches the parser failure path.

## 4. Impact

- SDK users received a misleading support report.
- Live editor visual safety checks could treat an invalid flowchart declaration as having no known support issue until parser failure.
- The public support contract could appear cleaner than the runtime contract.
