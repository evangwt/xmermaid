---
doc_type: issue-fix
issue: 2026-06-08-package-contract-drift
status: fixed
severity: high
tags: [release, packaging, roadmap, security]
---

# package-contract-drift fix note

## 修复内容

- `package.json` 增加 `./editor` export，并显式打包 `README.md` / `LICENSE`。
- 新增 `LICENSE`。
- `scripts/consumer-smoke.cjs` 要求 packed tarball 包含 LICENSE，并在临时消费者中验证 `xmermaid/editor` ESM/CJS/type path。
- `WasmInitOptions.fetch` 接入 `initWasm()`；文档明确当前 WASM 初始化是进程级单例，首次初始化后后续 render 复用同一 module。
- `DEFAULT_SECURITY_POLICY.sanitizeSvg` 落地，`renderToSVGElement()` 默认清理生成 SVG 的 `script` / `foreignObject`、事件属性和危险 `href`。
- README、production release checklist、architecture、production readiness roadmap/items 和 docs sync gate 同步当前事实。

## 验证

- `npm test -- tests/consumer-smoke.test.ts tests/wasm.test.ts tests/xmermaid.test.ts`
- `npm test -- tests/codestable-docs.test.ts tests/verify-release.test.ts`
- `npm test`
- `npm run typecheck`
- `node scripts/verify-release.cjs --check-docs --json`
- `python3 .codestable/tools/validate-yaml.py --file .codestable/roadmap/production-readiness/production-readiness-items.yaml --yaml-only`
- `npm pack --dry-run --json`
- `npm run verify:release`
- `git diff --check -- HEAD`
- `node --input-type=module -e "const mod = await import('xmermaid/editor'); console.log(typeof mod.XMermaidLiveEditor);"`
- `node -e "const mod = require('xmermaid/editor'); console.log(typeof mod.XMermaidLiveEditor);"`
