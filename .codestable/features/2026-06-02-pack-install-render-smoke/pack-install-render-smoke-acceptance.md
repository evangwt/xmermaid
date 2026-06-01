---
doc_type: feature-acceptance
feature: 2026-06-02-pack-install-render-smoke
status: accepted
summary: 验收真实 packed package 消费者安装、类型解析、WASM 加载和浏览器最小渲染门禁
tags: [production, release, package-smoke]
---

# pack-install-render-smoke 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-pack-install-render-smoke/pack-install-render-smoke-design.md

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `scripts/consumer-smoke.cjs` 输出 `passed`、`package_size_bytes`、`browser_render_duration_ms`、`checks` 和 `summary`。
  - 代码实际行为：`npm run smoke:consumer -- --json` 返回 JSON；实测 package size `230700` bytes，browser render duration `1429ms`。
- [x] `scripts/verify-release.cjs --list-matrix --json` 输出默认矩阵。
  - 代码实际行为：`tests/verify-release.test.ts` 断言 `consumer-pack-install` 存在、required，并位于 `wasm-js-build` 后。

**名词层"现状 → 变化"逐项核对**：

- [x] Consumer smoke gate 已新增：`scripts/consumer-smoke.cjs`。
- [x] `package.json` 已新增 `smoke:consumer`。
- [x] release verification 默认矩阵已新增 `consumer-pack-install`：`scripts/verify-release.cjs`。
- [x] packed declarations 不再泄漏 `../pkg/xmermaid_wasm`：`src/wasm.ts` 导出 `XMermaidWasmModule`，build 后 `dist/wasm.d.ts` 引用稳定接口。

**流程图核对**：

- [x] `verify:release` → `npm run build` → `consumer-pack-install`：默认矩阵顺序由 `tests/verify-release.test.ts` 覆盖。
- [x] `consumer-pack-install` → `npm pack` → 临时消费者 install/typecheck/import/browser render：`scripts/consumer-smoke.cjs` 串联实现，并由真实 smoke 命令验证。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] release verification 默认矩阵包含 consumer smoke gate：`node scripts/verify-release.cjs --list-matrix --json` 通过。
- [x] consumer smoke 使用真实 tarball：脚本调用 `npm pack --json --pack-destination <temp>`，临时消费者依赖写成 `file:<tarball>`。
- [x] 临时消费者 TypeScript 能解析 root public API：`npm run smoke:consumer -- --json` 的 `typecheck` check 通过。
- [x] 真实浏览器加载 WASM 并渲染最小 flowchart：`browser-render` check 通过。
- [x] smoke 输出 package size 与 browser render duration：summary 为 `consumer smoke passed: package_size_bytes=230700, browser_render_duration_ms=1429`。

**明确不做逐项核对**：

- [x] 未新增 Playwright/Puppeteer 或其他依赖：`package.json` dependencies/devDependencies 未新增浏览器自动化库。
- [x] 未新增 public render API：`src/xmermaid.ts` 的公开 render path 未新增方法。
- [x] 未新增 diagram type、diagnostics 或 security policy：本次代码改动不触碰 parser/render diagram support。
- [x] 未发布、未上传 npm、未改版本号：`package.json.version` 仍为 `0.1.0`。
- [x] 未把 jsdom 当作 browser smoke：无 Chrome 时 `resolveChromeExecutable` 抛错并提示 `CHROME_BIN`，测试覆盖。

**关键决策落地**：

- [x] D1：默认必须跑真实 Chrome；没有 Chrome 失败，不降级到 jsdom。
- [x] D2：`npm pack` 输出到临时目录，默认清理。
- [x] D3：TypeScript gate 使用消费者项目的 installed package。
- [x] D4：release matrix 使用 `npm run --silent smoke:consumer -- --json`，`verify-release` 解析 JSON summary。

**编排层"现状 → 变化"逐项核对**：

- [x] `verify-release` 支持 `--list-matrix` 且不执行命令。
- [x] 默认矩阵在 build 后新增 `consumer-pack-install`。
- [x] `consumer-smoke` 只通过 installed package 使用 `xmermaid`。
- [x] browser smoke 通过本机 headless Chrome 和临时 HTTP server 加载 installed package ESM。
- [x] Node import smoke 只证明 root ESM 可被 Node/SSR/构建工具解析，不承诺 Node DOM 渲染。

**流程级约束核对**：

- [x] smoke 脚本失败时退出非 0 并输出 `[xmermaid consumer-smoke diagnostic] ...`。
- [x] 无 Chrome 时失败并提示 `CHROME_BIN`，测试覆盖。
- [x] 临时目录默认清理，`--keep-temp` 才保留。
- [x] `verify-release --list-matrix --json` 不执行命令，只输出矩阵。
- [x] package size 和 browser render duration 只记录基线，不设阈值。

**挂载点反向核对（可卸载性）**：

- [x] release verification：删除 `scripts/verify-release.cjs` 中 `consumer-pack-install` 条目后 release gate 消失。
- [x] release smoke script：删除 `scripts/consumer-smoke.cjs` 和 `package.json` 的 `smoke:consumer` 后独立 smoke 命令消失。
- [x] package type boundary：删除 `src/wasm.ts` 的 `XMermaidWasmModule` 后 consumer typecheck 会重新暴露 `pkg/` 类型路径风险。
- [x] renderer module-load guard：删除 `SVGRenderer.getCanvas()` 懒初始化后 root ESM Node import 回归测试会失败。
- [x] 反向 grep：`consumer-pack-install`、`smoke:consumer`、`browser-render` 命中均在 release script、consumer smoke script、测试和 CodeStable specs。
- [x] 拔除沙盘：按挂载点删除后，项目回到仅仓库内 build/test/typecheck 的发布验证状态，无 hidden release smoke 残留。

## 3. 验收场景核对

- [x] **S1**：运行 `node scripts/verify-release.cjs --list-matrix --json` → 输出默认矩阵，`consumer-pack-install` 在 `wasm-js-build` 之后且 required。
  - 证据来源：`npm test -- tests/verify-release.test.ts`。
  - 结果：通过。
- [x] **S2**：consumer smoke helper 校验 pack manifest 要求 `dist/index.d.ts`、`dist/support.d.ts`、ESM/CJS bundle、WASM asset 和 README。
  - 证据来源：`npm test -- tests/consumer-smoke.test.ts`。
  - 结果：通过。
- [x] **S3**：运行 `npm run build && npm run smoke:consumer -- --json` → packed tarball 安装进临时消费者，typecheck、Node import 和 browser render 全通过。
  - 证据来源：真实命令执行。
  - 结果：通过。
- [x] **S4**：browser smoke 成功时 → JSON summary 记录 package size 与 browser render duration。
  - 证据来源：`npm run smoke:consumer -- --json` 输出。
  - 结果：通过，`package_size_bytes=230700`，`browser_render_duration_ms=1429`。
- [x] **S5**：无 Chrome 环境时 → smoke gate 失败并提示 `CHROME_BIN`，不报告通过。
  - 证据来源：`tests/consumer-smoke.test.ts`。
  - 结果：通过。

## 4. 术语一致性

- Consumer smoke gate：用于真实 packed tarball 消费者门禁，命中 script/test/spec，含义一致。
- Packed tarball：只指 `npm pack` 产物，不指 repo source tree。
- Browser render smoke：只指 headless Chrome 加载 installed package ESM + WASM 并渲染 SVG，不与 jsdom 混用。
- 防冲突：`node-import` 在脚本中明确为 root ESM parse/import smoke，不声称 Node DOM render support。

## 5. 架构归并

- [x] `ARCHITECTURE.md`：已在“当前生产支持合同”小节补入 `consumer-pack-install` release gate、`scripts/consumer-smoke.cjs` 流程、`XMermaidWasmModule` 类型边界和 root ESM browser global 约束。

## 6. requirement 回写

- [x] `production-support-contract` 已更新：补入真实 packed consumer smoke 用户故事、解决方式、边界和 2026-06-02 变更日志。

## 7. roadmap 回写

- [x] design frontmatter 含 `roadmap: production-readiness` / `roadmap_item: pack-install-render-smoke`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 对应条目已从 `in-progress` 改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 第 5 节对应条目已同步为 done。
- [x] roadmap 观察项已把 `dist/wasm.d.ts` 泄漏 `pkg/` 类型路径从待处理改为已修复约束。

## 8. attention.md 候选盘点

- [x] 候选：consumer smoke 依赖本机 Chrome/Chromium；无 Chrome 时需要设置 `CHROME_BIN`。这是 release gate 环境要求，后续应考虑用 `cs-note` 写入 attention.md。

## 9. 遗留

- `render-svg-api` 仍未完成；当前公开渲染 API 仍以 DOM replacement `render(input): Promise<void>` 为主。
- `support-analyzer-v1` 仍未提供 syntax-level unsupported feature range。
- `security-policy-v1` 仍未定义 strict/loose 安全策略。
- `verify-release` 的默认矩阵现在会实际跑 Chrome smoke；CI 环境必须安装 Chrome 或提供 `CHROME_BIN`。
