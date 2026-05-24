---
doc_type: feature-acceptance
feature: 2026-05-25-release-verification-contract
status: accepted
accepted_at: 2026-05-25
roadmap: visual-rendering-readiness
roadmap_item: release-verification-contract
tags: [verification, release, testing, codestable]
---

# release-verification-contract 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：`.codestable/features/2026-05-25-release-verification-contract/release-verification-contract-design.md`

## 1. 接口契约核对

**接口示例逐项核对**：

- [x] `npm run verify:release`：实际入口为 `node scripts/verify-release.cjs`，默认矩阵依次运行 `npm run build`、`npm test`、`npm run typecheck`、`cargo test`、`git diff --check -- HEAD`。
- [x] `node scripts/verify-release.cjs --matrix-file <path> --json`：新增 `tests/verify-release.test.ts` 用 fake matrix 验证 JSON run record、失败 exit code、两条结果均记录。

**名词层"现状 → 变化"逐项核对**：

- [x] `package.json` 从分散脚本扩展出 `verify:release` 统一入口。
- [x] `VerificationResultRecord` 字段落地：`checked_at`、`git_commit`、`command_id`、`command`、`exit_code`、`passed`、`summary`、`blocking_reason`。

**流程图核对**：

- [x] `verify:release` 加载矩阵、解析 git commit、顺序运行所有命令、输出 summary，并根据 required failures 决定 exit code。`npm run verify:release` 输出 5 条 PASS 证明默认流程可跑通。

## 2. 行为与决策核对

**需求摘要逐项验证**：

- [x] 统一 release gate 已落地：`npm run verify:release`。
- [x] build 不再可能被 release check 漏掉：默认矩阵第一条是 `npm run build`。
- [x] 任一 required 命令失败时脚本返回非 0：fake matrix 测试中第二条命令 exit 7，脚本 exit 1。

**明确不做逐项核对**：

- [x] 未新增 npm dependency：`package.json` dependencies/devDependencies 未增加条目。
- [x] 未新增 CI 配置。
- [x] 未修改测试框架或既有测试语义。
- [x] 未默认写验证结果到仓库路径；只有显式 `--output <path>` 才写文件。
- [x] 未治理 `.codestable/` / screenshots / `.codegraph/` 提交策略；保留给 `codestable-evidence-governance`。

**关键决策落地**：

- [x] 使用 Node `.cjs` 脚本实现 release gate，和 `scripts/build-wasm.cjs` 保持一致。
- [x] 运行所有矩阵命令而不是首个失败即退出，fake matrix 的 `pass\nfail\n` 文件证明两条都执行。
- [x] 支持 `--json` 和 `--output <path>`，默认仍输出人类可读 summary。

**编排层"现状 → 变化"逐项核对**：

- [x] 验证结果从聊天记录/临时日志提升为脚本可生成的 run record。
- [x] `npm run verify:release` 默认矩阵当前全部通过。

**流程级约束核对**：

- [x] 每条结果包含同一次运行的 `checked_at` 和 `git_commit`。
- [x] `passed=false` 时 `blocking_reason` 非空。
- [x] `--matrix-file` 只影响本次脚本输入，不修改默认矩阵。

**挂载点反向核对**：

- [x] 挂载点 1：`package.json` scripts 的 `verify:release`。
- [x] 挂载点 2：`scripts/verify-release.cjs`。
- [x] grep/状态核对未发现额外挂载点；本 feature 可通过还原这两处卸载。

## 3. 验收场景核对

- [x] **S1**：fake matrix 一成一败时 `--json` 输出两条结果，脚本 exit 1，失败项 blocking reason 为 `Required command fake-fail failed with exit code 7`。
- [x] **S2**：`npm run verify:release` 默认矩阵通过，输出 5 条 PASS，exit 0。
- [x] **S3**：`npm test` 全量通过，包含 `tests/verify-release.test.ts`。
- [x] **S4**：`git diff --check` 无 whitespace error。

## 4. 术语一致性

- `Verification Command Matrix`、`Verification Result Record`、`verify:release`、`matrix-file` 均与 design 第 0 节一致。
- 未新增 design 外的发布验证概念。

## 5. 架构归并

- [x] 架构 doc 不需要更新。该 feature 是发布验证脚本，不改变 runtime parser/layout/renderer 架构。
- [x] 后续 CodeStable acceptance 可直接引用 `npm run verify:release` 作为发布验证入口。

## 6. requirement 回写

- [x] `requirement: null` 且本 feature 是技术交付门禁，不新增用户可见能力；无 requirement 回写。

## 7. roadmap 回写

- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-items.yaml` 中 `release-verification-contract` 已改为 `done`，`feature` 指向 `2026-05-25-release-verification-contract`。
- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-roadmap.md` 第 5 节对应条目已同步为 `done`。
- [x] roadmap items.yaml 已通过 `validate-yaml.py --yaml-only`。

## 8. attention.md 候选盘点

- 候选：后续 feature/roadmap 验收前应优先运行 `npm run verify:release`，它覆盖 build、JS tests、typecheck、cargo test 和 whitespace diff check。

## 9. 遗留

- `codestable-evidence-governance` 仍未开始，`.codestable/`、`.codegraph/`、CDP 脚本、screenshots 的提交/忽略边界仍需治理。
- `verify-release` 当前顺序执行所有命令；如果未来耗时变长，可另起优化讨论是否并行，但不能削弱 required failure 记录。
