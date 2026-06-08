---
doc_type: issue-analysis
issue: 2026-06-08-package-contract-drift
status: fixed
severity: high
tags: [release, packaging, roadmap, security]
---

# package-contract-drift analysis

## 根因

生产 roadmap 的包结构和安全初始化合同被当成完成事实记录，但实现只覆盖了 root package consumer path。`consumer-smoke` 校验了 root ESM/CJS、README 和 wasm asset，却没有校验 `xmermaid/editor` subpath、`LICENSE`、custom WASM fetch 或 generated SVG sanitization。

## 修复策略

采用最小收敛修复：

1. 在 `package.json.exports` 增加 `./editor`，运行时复用当前 root bundle，types 指向 `dist/editor/index.d.ts`。
2. 新增 MIT `LICENSE`，并在 `package.json.files` 显式保留 `dist`、`README.md`、`LICENSE`。
3. `consumer-smoke` 临时消费者同时 typecheck/import/require root 和 `xmermaid/editor`。
4. `WasmInitOptions` 增加 `fetch`，loader 在 `wasmUrl + fetch` 同时存在时用该 fetch 取 Response。
5. `SecurityPolicy` 增加默认 `sanitizeSvg: true`，`renderToSVGElement()` 返回前清理生成 SVG 中的危险节点/属性。
6. README、release checklist、architecture、roadmap 和 docs sync gate 同步更新。

## 拒绝方案

- 新增单独 `dist/editor/index.js` bundle：当前 root bundle 已导出 live editor，另起 bundle会增加构建面和 sourcemap/exports 维护成本。
- 只改 roadmap 删除合同：目标是实现 completed roadmap 的生产合同，不是把未实现能力从文档里擦掉。
