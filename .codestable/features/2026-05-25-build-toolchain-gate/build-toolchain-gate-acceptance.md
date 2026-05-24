---
doc_type: feature-acceptance
feature: 2026-05-25-build-toolchain-gate
status: accepted
accepted_at: 2026-05-25
roadmap: visual-rendering-readiness
roadmap_item: build-toolchain-gate
tags: [build, wasm, toolchain, release-readiness]
---

# build-toolchain-gate 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：`.codestable/features/2026-05-25-build-toolchain-gate/build-toolchain-gate-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `npm run build:wasm`：实际入口为 `node scripts/build-wasm.cjs`，脚本调用 `wasm-pack build crates/xmermaid-wasm --out-dir ../../pkg --target web`。新增测试 `tests/build-wasm.test.ts` 用 fake `wasm-pack` 验证参数保持不变。

**名词层"现状 → 变化"逐项核对**：

- [x] `build:wasm` 不再直接依赖外部 PATH；改为脚本构造 child process PATH 后调用 `wasm-pack`。
- [x] WASM package 生成位置仍为 `pkg/`，`src/wasm.ts` 的 import 路径未变。

**流程图核对**：

- [x] `npm run build` → `npm run build:wasm` → `scripts/build-wasm.cjs` → `wasm-pack build` → `npm run build:js` 已由 `npm run build` 成功输出证明。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] 普通 `npm run build` 在当前 shell PATH 下通过，不再因 Homebrew rustc sysroot 缺 `wasm32-unknown-unknown` 失败。
- [x] 缺工具链路径时脚本保留原始失败码，并打印 `[xmermaid build-wasm diagnostic]` 前缀的诊断信息。

**明确不做逐项核对**：

- [x] 未修改 Rust parser/layout/wasm 业务源码：`git status --short` 未出现 `crates/xmermaid-*` 修改。
- [x] 未升级 wasm-pack，未新增 npm 依赖。
- [x] 未提交 `dist/` / `pkg/` 构建产物；二者仍由 `.gitignore` 排除。
- [x] 未新增 CI 配置。

**关键决策落地**：

- [x] 用 Node `.cjs` 脚本包裹 `wasm-pack build`，而不是 package script 内联 PATH。
- [x] 只修改 child process PATH；用户 shell 不被修改。

**编排层"现状 → 变化"逐项核对**：

- [x] 新脚本优先把 `$HOME/.cargo/bin` 放到子进程 PATH 前面，测试断言 PATH 首段为临时 rustup bin。
- [x] `build` 仍保持 `build:wasm && build:js` 顺序。

**流程级约束核对**：

- [x] 脚本失败时 `process.exit(result.status ?? 1)`，不会伪造成功。
- [x] 诊断信息补充在失败路径，原始 `wasm-pack` stdio 仍透传。

**挂载点反向核对**：

- [x] 挂载点 1：`package.json` scripts 的 `build:wasm`。
- [x] 挂载点 2：`scripts/build-wasm.cjs`。
- [x] grep/状态核对未发现额外挂载点；本 feature 可通过还原这两处卸载。

## 3. 验收场景核对

- [x] **S1**：普通 `npm run build` → WASM package 与 Rollup JS bundle 均完成，exit 0。
- [x] **S2**：`npm run build:wasm` 的产物合同由 `npm run build` 输出和 `tests/build-wasm.test.ts` 参数断言覆盖。
- [x] **S3**：`npm test`、`npm run typecheck`、`cargo test` 均通过。
- [x] **S4**：`git status --short` 只显示源码/spec/未跟踪诊断资产，不显示 tracked `dist/` 或 `pkg/` 改动。

## 4. 术语一致性

- `build-toolchain-gate`、`build-wasm`、`wasm-pack`、`rustup bin` 的命名与 design 第 0 节一致。
- 未新增 design 外的业务概念。

## 5. 架构归并

- [x] 架构 doc 不需要更新。该 feature 是构建门禁脚本，不改变 parser/layout/renderer/WASM 运行时架构。
- [x] 建议把“本仓库构建应优先使用 rustup bin 以获得 wasm target”作为 attention.md 候选，等用户决定是否走 `cs-note`。

## 6. requirement 回写

- [x] `requirement: null` 且本 feature 是发布构建技术债，不新增用户可见能力；无 requirement 回写。

## 7. roadmap 回写

- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-items.yaml` 中 `build-toolchain-gate` 已改为 `done`，`feature` 指向 `2026-05-25-build-toolchain-gate`。
- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-roadmap.md` 第 5 节对应条目已同步为 `done`。
- [x] roadmap items.yaml 已通过 `validate-yaml.py --yaml-only`。

## 8. attention.md 候选盘点

- 候选：本仓库如果同时存在 Homebrew Rust 和 rustup Rust，WASM 构建必须让 `$HOME/.cargo/bin` 优先于 Homebrew Rust；当前已由 `scripts/build-wasm.cjs` 自动处理。

## 9. 遗留

- `release-verification-contract` 仍未开始，后续需要把本次使用的验证矩阵固化为统一记录格式。
- `codestable-evidence-governance` 仍未开始，`.codestable/`、`.codegraph/`、CDP 脚本、screenshots 的提交/忽略边界仍需治理。
