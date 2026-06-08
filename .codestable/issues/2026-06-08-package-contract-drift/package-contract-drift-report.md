---
doc_type: issue-report
issue: 2026-06-08-package-contract-drift
status: fixed
severity: high
tags: [release, packaging, roadmap, security]
---

# package-contract-drift report

## 现象

`production-readiness` roadmap 已标记 completed，但发布包合同和实际实现不一致：

- roadmap 写了 `./editor` package subpath，实际 `package.json.exports` 只有 root。
- roadmap 写了 packed files 包含 `LICENSE`，实际仓库没有 `LICENSE` 文件，`package.json.files` 也未显式包含。
- roadmap 写了 `WasmInitOptions.fetch` 和 `SecurityPolicy.sanitizeSvg`，实际 public types/default policy 未提供。

## 影响

消费者无法使用 `import { XMermaidLiveEditor } from 'xmermaid/editor'`，发布包缺少显式 license artifact，安全策略文档含有未落地字段。更糟的是 release gate 原先没有把这些合同全部钉住，可能继续放过漂移。

## 复现证据

- `node --input-type=module -e "import('xmermaid/editor')"` 返回 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
- `ls LICENSE*` 无结果。
- `src/types/options.ts` 的 `WasmInitOptions` 只有 `wasmUrl`。
- `src/security.ts` 的 `SecurityPolicy` 未包含 `sanitizeSvg`。
