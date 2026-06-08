---
doc_type: issue-report
issue: 2026-06-08-unsupported-syntax-blocking
status: fixed
severity: high
tags: [sdk, diagnostics, support]
---

# Error-level unsupported syntax still rendered

## 1. Problem

After the support analyzer learned to report invalid flowchart directions as `flowchart.invalidDirection` with `severity: error`, `renderToSVGElement()` still allowed that diagnostic to continue into layout/render and could return an SVG when the WASM layer did not reject in tests.

## 2. Reproduction

```ts
await renderer.renderToSVGElement('graph XXX\n  A-->B');
```

Before the fix, the result could resolve with:

```json
{
  "diagnostics": [
    {
      "code": "unsupported_syntax",
      "severity": "error",
      "featureId": "flowchart.invalidDirection"
    }
  ]
}
```

That is nonsense: an error diagnostic cannot accompany a successful render result for unsupported declaration syntax.

## 3. Expected Behavior

`renderToSVGElement()` should treat error-severity `unsupported_syntax` diagnostics as render blockers before calling WASM, while leaving warning-severity unsupported syntax as non-blocking diagnostics.

## 4. Impact

- The support analyzer could detect a hard support boundary but the render path ignored it.
- Tests with mocked WASM could falsely prove success for invalid syntax.
- Runtime behavior could collapse back to parser errors instead of preserving structured support diagnostics.
