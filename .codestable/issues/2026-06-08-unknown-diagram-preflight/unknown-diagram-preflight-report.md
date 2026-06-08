---
doc_type: issue-report
issue: 2026-06-08-unknown-diagram-preflight
status: fixed
severity: high
tags: [support, diagnostics, sdk]
---

# Unknown diagram sources bypass unsupported preflight

## 1. Problem

`analyzeSupport('not a diagram')` reported `diagramType: 'unknown'` and `status: 'unsupported'`, but `unsupportedFeatures` was empty. Because `renderToSVGElement()` blocks unsupported diagrams by looking for `unsupported_diagram_type` diagnostics, unknown sources could continue into the WASM render path instead of failing in support preflight.

## 2. Reproduction

```ts
analyzeSupport('not a diagram');
await renderer.renderToSVGElement('not a diagram');
```

Observed before the fix:

```json
{
  "diagramType": "unknown",
  "status": "unsupported",
  "unsupportedFeatures": []
}
```

In mocked WASM tests, `renderToSVGElement('not a diagram')` could resolve with an SVG and `diagramType: 'unknown'`.

## 3. Expected Behavior

Unknown diagram sources must produce a structured `diagram.unknown` unsupported feature and fail before WASM with `XMermaidError('UNSUPPORTED_DIAGRAM')` carrying an `unsupported_diagram_type` diagnostic.

## 4. Impact

- The production support contract said unknown input is unsupported, but runtime preflight did not enforce it.
- Live editor diagnostics could receive a parser/render fallback instead of a support diagnostic.
- Tests with mocked WASM could accidentally prove impossible production behavior.
