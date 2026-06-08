---
doc_type: issue-report
issue: 2026-06-08-dom-run-diagnostics
status: fixed
severity: medium
tags: [sdk, diagnostics, dom]
---

# DOM scan helper drops structured diagnostics

## 1. Problem

`XMermaid.run()` caught render failures and wrote only `Error: {message}` into each failed `.mermaid` element. The structured diagnostics already existed on `XMermaidError`, but DOM scan users had no machine-readable way to inspect the failure from the element that failed.

## 2. Reproduction

```html
<div class="mermaid">sequenceDiagram
  A->>B: Hi
</div>
```

```ts
await XMermaid.run({ container });
```

Before the fix, the element text contained the error message but had no `data-xmermaid-error-code` or `data-xmermaid-diagnostics`.

## 3. Expected Behavior

`XMermaid.run()` should keep the compatibility text error behavior and expose the structured error code and diagnostics on the failed `.mermaid` element.

## 4. Impact

- Host apps using the DOM scan helper could not distinguish unsupported diagrams, parse errors, security blocks, and generic render failures without string parsing.
- The structured diagnostics roadmap was true for `renderToSVGElement()` and live editor paths, but weaker for the legacy DOM scan helper.
