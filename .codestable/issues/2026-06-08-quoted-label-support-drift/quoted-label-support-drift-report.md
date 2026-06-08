---
doc_type: issue-report
issue: 2026-06-08-quoted-label-support-drift
status: fixed
severity: medium
tags: [support, diagnostics, parser]
---

# Quoted label syntax missing from support diagnostics

## 1. Problem

Rust parser falsification coverage documents that quoted labels such as `A["Text"]` keep the quote characters as literal label text. xmermaid does not currently implement Mermaid quoted label semantics.

The production support analyzer did not report this limitation.

## 2. Reproduction

```ts
detectUnsupportedFeatures('flowchart TD\n  A["Quoted"]');
```

Observed before the fix:

```json
[]
```

## 3. Expected Behavior

Quoted labels should produce warning-severity `unsupported_syntax` diagnostics. Rendering can continue, but the user should be told that the label semantics are not Mermaid-compatible.

## 4. Impact

- Users could see literal quote characters and interpret the output as an undocumented renderer bug.
- The support matrix under-reported a known parser limitation.
- Live editor visual safety had a weaker source contract than Rust parser evidence.
