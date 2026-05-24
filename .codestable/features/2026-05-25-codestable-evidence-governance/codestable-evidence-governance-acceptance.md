# codestable-evidence-governance 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：.codestable/features/2026-05-25-codestable-evidence-governance/codestable-evidence-governance-design.md

## 1. 接口契约核对

**接口示例逐项核对**：
- [x] `git status --short`：`.codestable/**` 与本 feature 文档/测试可见；`.omx/**`、`.codegraph/**`、`screenshots/**`、`cdp-*` 不出现。证据：`git status --short` 输出只列出 `.gitignore`、`package.json`、`.codestable/`、`docs/evidence-governance.md`、`scripts/`、`tests/*.test.ts`。
- [x] `npm test -- tests/evidence-governance.test.ts`：3/3 测试通过，证明五类资产分类和 ignore 规则落地。

**名词层“现状 → 变化”逐项核对**：
- [x] `.gitignore` 从 5 条基础忽略规则扩展为依赖/构建输出、本地 agent/runtime 状态、临时视觉/浏览器诊断三组规则。
- [x] `docs/evidence-governance.md` 记录 `repo-spec`、`diagnostic-tool`、`runtime-cache`、`visual-evidence`、`private-log` 五类资产。
- [x] `tests/evidence-governance.test.ts` 机械验证政策文档和 `.gitignore` 的关键规则。

**流程图核对**：
- [x] roadmap 分类协议 → `docs/evidence-governance.md` → `.gitignore` → `git status` hygiene 的路径已落地。
- [x] roadmap 分类协议 → `tests/evidence-governance.test.ts` 的回归守护路径已落地。

## 2. 行为与决策核对

**需求摘要逐项验证**：
- [x] `.codestable/` 作为长期规格目录未被 ignore，仍出现在 `git status --short`。
- [x] `.omx/` 和 `.codegraph/` 已写入 `.gitignore`，不再出现在 `git status --short`。
- [x] `screenshots/` 与根目录 `cdp-*.cjs|mjs` 已写入 `.gitignore`，不再污染提交视图。
- [x] `docs/evidence-governance.md` 给出截图 baseline/fixture 的后续提交边界。

**明确不做逐项核对**：
- [x] 未提交 `.omx/`、`.codegraph/`、`screenshots/`、`dist/`、`pkg/`。
- [x] 未修改 parser/layout/renderer/runtime 源码。
- [x] 未新增 npm dependency；`package.json` 依赖区未改。
- [x] 未把临时 CDP 脚本纳入正式 `scripts/`。

**关键决策落地**：
- [x] `.gitignore` 表达提交边界。
- [x] `docs/evidence-governance.md` 表达人类可读政策。
- [x] `tests/evidence-governance.test.ts` 表达回归守护。

**编排层“现状 → 变化”逐项核对**：
- [x] 资产分类不再只存在 roadmap 规划中；已有政策文档、ignore 边界和测试守护三个落点。

**流程级约束核对**：
- [x] `.codestable/roadmap/**`、`.codestable/features/**`、`.codestable/audits/**` 默认属于 `repo-spec`。
- [x] `.omx/**` 属于 `private-log` 并被 ignore。
- [x] `.codegraph/**` 属于 `runtime-cache` 并被 ignore。
- [x] `screenshots/**` 默认忽略，baseline/fixture 才提交。
- [x] 根目录 `cdp-*.cjs|mjs` 默认忽略。

**挂载点反向核对（可卸载性）**：
- [x] 挂载点 M1 `.gitignore`：新增规则均属于 evidence governance。
- [x] 挂载点 M2 `docs/evidence-governance.md`：删除后测试会失败，政策能力消失。
- [x] 挂载点 M3 `tests/evidence-governance.test.ts`：删除后回归守护消失。
- [x] 反向 grep：`rg -n "evidence-governance|repo-spec|runtime-cache|private-log|visual-evidence|cdp-\\*|\\.codegraph|\\.omx" . --glob '!node_modules/**' --glob '!target/**' --glob '!dist/**' --glob '!pkg/**'` 命中均为 roadmap/design/checklist/acceptance/docs/test/.gitignore 范围。
- [x] 拔除沙盘：移除上述三个挂载点即可撤销本 feature 的非 CodeStable 行为；CodeStable 记录作为历史保留。

## 3. 验收场景核对

- [x] **S1**：`npm test -- tests/evidence-governance.test.ts` → 3/3 测试通过。
- [x] **S2**：`git status --short` → `.omx/`、`.codegraph/`、`screenshots/`、根目录 `cdp-*` 均不出现。
- [x] **S3**：`npm run verify:release` → build、JS tests、typecheck、cargo test、diff whitespace 全部 PASS。
- [x] **S4**：`python3 .codestable/tools/validate-yaml.py --file ... --yaml-only` → checklist 与 roadmap items 均通过。

前端改动：无。

## 4. 术语一致性

- `repo-spec`：仅用于 evidence policy、测试和 CodeStable 文档，含义一致。
- `diagnostic-tool`：仅用于 evidence policy、测试和 CodeStable 文档，含义一致。
- `runtime-cache`：用于 `.codegraph/**`，含义一致。
- `visual-evidence`：用于截图 baseline/fixture 边界，含义一致。
- `private-log`：用于 `.omx/**`，含义一致。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md`：新增“工程证据治理”小节，记录 CodeStable 规格、runtime cache/private log、截图和 CDP 临时诊断脚本的当前仓库归属规则。
- [x] runtime parser/layout/renderer 架构无需更新；本 feature 只改变仓库工程治理边界。

## 6. requirement 回写

- [x] `requirement` 为空，且本 feature 是仓库治理能力，不新增终端用户可见 runtime 能力；无 requirement 回写。

## 7. roadmap 回写

- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-items.yaml` 中 `codestable-evidence-governance` 已从 `in-progress` 改为 `done`，feature 填 `2026-05-25-codestable-evidence-governance`。
- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-roadmap.md` 子 feature 清单已同步为 `done` 并补充备注。
- [x] roadmap items YAML 已通过校验。

## 8. attention.md 候选盘点

- 候选 1：本环境运行 CodeStable validator 需使用 `python3`，`python` 命令不存在。建议后续用 `cs-note` 归入“命令与脚本陷阱”。

## 9. 遗留

- 后续优化点：`svg-geometry-regression-suite` 需要按 `docs/evidence-governance.md` 决定截图 baseline/fixture 路径。
- 已知限制：当前仅定义截图提交边界，未选择具体视觉基线目录。
- 实现阶段顺手发现：无方案外代码问题。
