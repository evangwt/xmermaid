---
doc_type: issue-report
issue: 2026-06-08-cjs-package-entry
status: fixed
severity: high
tags: [packaging, release, sdk]
---

# CommonJS package entry fails after installation

## 1. Problem

`package.json` declared a CommonJS package entry through `exports["."].require`, but the referenced file was `dist/xmermaid.js` while the package also declared `"type": "module"`.

In an installed package boundary, Node treats `.js` files as ESM. The generated Rollup output was CommonJS and used `exports.*`, so `require('xmermaid')` failed instead of exposing the public SDK.

## 2. Reproduction

Create a temporary installed package boundary containing the current `package.json` and `dist/xmermaid.js`, then run:

```js
const xmermaid = require('xmermaid');
```

Observed failure:

```text
ReferenceError: exports is not defined in ES module scope
```

## 3. Expected Behavior

`require('xmermaid')` must expose the same public package surface promised by `exports["."].require`, including `XMermaid`.

## 4. Impact

- CommonJS consumers cannot use the package despite the manifest promise.
- `consumer-pack-install` previously passed without proving the declared require entry.
- Release verification could report green while a public package entry was broken.
