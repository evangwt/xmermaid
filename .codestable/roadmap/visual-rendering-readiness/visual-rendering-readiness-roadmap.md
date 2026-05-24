---
doc_type: roadmap
slug: visual-rendering-readiness
status: completed
created: 2026-05-25
last_reviewed: 2026-05-25
tags: [rendering, visual-quality, release-readiness, testing, codestable]
related_requirements: []
related_architecture: [ARCHITECTURE]
---

# Visual Rendering Readiness Roadmap

## 1. 背景

最近的 visual edge rendering 修复已经解决了箭头尖端、路径截短、非三角箭头 DOM 和基础 label fallback 问题，但 review 暴露出更大的交付缺口：当前项目“测试绿”不等于“可发布”，`npm run build` 在本机失败；CodeStable 证据目录未纳入提交；renderer 仍承担过多几何职责；视觉回归覆盖还停留在 DOM 结构和少量坐标断言。

本 roadmap 的目标是把 xmermaid 从“局部修过一个视觉 bug”推进到“渲染质量、发布构建、证据治理都能长期维护”的状态。

## 2. 范围与明确不做

### 本 roadmap 覆盖

- 修复 WASM/JS 发布构建闭环，使 `npm run build` 可作为交付门禁。
- 治理 `.codestable/`、screenshots、CDP 脚本等证据资产的提交/忽略边界。
- 建立统一 verification report，避免 test/typecheck/cargo 通过但 build 漏跑。
- 收紧 layout 与 renderer 的边界，把 edge 几何合同从临时推断变成显式协议。
- 增强视觉/路径级回归测试，覆盖复杂路径、label fallback、shape boundary 和 rendered SVG geometry。

### 明确不做

- 不扩展 Mermaid 全语法兼容面；语法支持另走 parser roadmap。
- 不引入 Canvas/PNG renderer；当前只治理 SVG renderer。
- 不做完整障碍物避让、port routing、parallel edge bundling；这些属于后续 routing roadmap。
- 不替换 Rust layout 算法，只定义边界和最小可迁移接口。
- 不强制提交所有本地工具产物；先定义分类规则，再按规则处理。

## 3. 模块拆分（概设）

```text
visual-rendering-readiness
├── build-readiness：发布构建与本机/CI toolchain 门禁
├── evidence-governance：CodeStable、截图、诊断脚本的资产归属
├── verification-contract：统一验收命令与机器可读结果
├── edge-geometry-contract：layout/renderer 之间的显式边几何协议
└── visual-regression-suite：真实 SVG 几何与截图级回归覆盖
```

### build-readiness

- **职责**：让 `npm run build` 在支持的开发/CI 环境中可复现通过；缺工具链时给出明确失败说明。
- **承载的子 feature**：`build-toolchain-gate`
- **触碰的现有代码 / 模块**：`package.json`、构建文档、WASM 构建路径。

### evidence-governance

- **职责**：决定 `.codestable/`、`.omx/`、screenshots、CDP 脚本、`.codegraph/` 哪些提交、哪些忽略、哪些归档。
- **承载的子 feature**：`codestable-evidence-governance`
- **触碰的现有代码 / 模块**：`.gitignore`、`.codestable/`、可能新增 docs/dev note。

### verification-contract

- **职责**：把交付验证从口头清单变成固定命令矩阵和结果记录。
- **承载的子 feature**：`release-verification-contract`
- **触碰的现有代码 / 模块**：`package.json` scripts、CodeStable acceptance/checklist 文档。

### edge-geometry-contract

- **职责**：定义 layout 输出哪些 edge geometry，renderer 只负责 SVG 表达，不继续猜测核心路径语义。
- **承载的子 feature**：`edge-geometry-boundary-contract`
- **触碰的现有代码 / 模块**：`crates/xmermaid-layout/src/types.rs`、`src/types/layout.ts`、`src/renderer/edge.ts`、`src/renderer/svg.ts`。

### visual-regression-suite

- **职责**：把复杂路径、label fallback、arrow styles、shape boundary 变成可重复验证的测试。
- **承载的子 feature**：`svg-geometry-regression-suite`
- **触碰的现有代码 / 模块**：`tests/edge.test.ts`、`tests/renderer.test.ts`、截图生成/比较脚本。

## 4. 模块间接口契约 / 共享协议（架构层详设）

### 4.1 Verification Command Matrix

**方向**：verification-contract → build-readiness / visual-regression-suite
**形式**：固定命令协议

```ts
type VerificationCommandId =
  | 'js-unit'
  | 'ts-typecheck'
  | 'rust-workspace'
  | 'wasm-js-build'
  | 'diff-whitespace'
  | 'visual-regression';

interface VerificationCommand {
  id: VerificationCommandId;
  command: string;
  required_for_release: boolean;
  failure_owner: 'toolchain' | 'code' | 'test-fixture' | 'unknown';
}
```

**基准命令**：

```yaml
- id: js-unit
  command: npm test
  required_for_release: true
- id: ts-typecheck
  command: npm run typecheck
  required_for_release: true
- id: rust-workspace
  command: cargo test
  required_for_release: true
- id: wasm-js-build
  command: npm run build
  required_for_release: true
- id: diff-whitespace
  command: git diff --check -- HEAD
  required_for_release: true
```

**约束**：

- `required_for_release: true` 的命令失败时，不允许把 roadmap item 标为 done。
- toolchain 缺失必须记录为 `failure_owner: toolchain`，不能被“代码测试通过”掩盖。
- `npm run build` 是发布门禁，不得用 `npm run typecheck` 替代。

### 4.2 Verification Result Record

**方向**：所有子 feature → verification-contract
**形式**：机器可读报告 schema

```ts
interface VerificationResultRecord {
  checked_at: string; // ISO8601
  git_commit: string;
  command_id: VerificationCommandId;
  command: string;
  exit_code: number;
  passed: boolean;
  summary: string;
  blocking_reason: string | null;
}
```

**约束**：

- 每条结果必须绑定 `git_commit`。
- `passed=false` 时 `blocking_reason` 必填。
- acceptance 报告引用 summary，不复制完整日志。

### 4.3 Evidence Asset Classification

**方向**：evidence-governance → 所有 CodeStable/diagnostic 产物
**形式**：文件分类协议

```ts
type EvidenceAssetClass =
  | 'repo-spec'
  | 'diagnostic-tool'
  | 'runtime-cache'
  | 'visual-evidence'
  | 'private-log';
```

**分类规则**：

- `.codestable/roadmap/**`、`.codestable/features/**`、`.codestable/audits/**` 默认 `repo-spec`。
- `.omx/state/**`、`.omx/logs/**` 默认 `private-log`。
- `.codegraph/**` 默认 `runtime-cache`。
- `screenshots/**` 只有作为 baseline 或审查证据时才是 `visual-evidence`，否则忽略。
- `cdp-*.cjs|mjs` 若保留，必须移动或命名为可维护脚本，并写用途说明。

### 4.4 Edge Geometry Boundary Contract

**方向**：layout → renderer
**形式**：共享 layout edge 类型

```ts
interface RenderedEdgeGeometry {
  waypoints: Point[];
  source_boundary?: Point;
  target_boundary?: Point;
  path_end?: Point;
  final_tangent_angle?: number;
  label_anchor?: Point;
  geometry_version: 1;
}
```

**约束**：

- renderer 可以 fallback 计算缺失字段，但新 layout 输出必须优先消费显式字段。
- `target_boundary` 表示 arrow tip landing point，不包含 `edgeGap`。
- `path_end` 表示 stroke endpoint，不得等同于 arrow tip，除非 edge style 无箭头。
- `label_anchor` 若存在，renderer 不再重新推断 fallback label 位置。
- Rust `LayoutEdge` 与 TS `LayoutEdge` 字段必须同步更新并有 roundtrip 测试。

## 5. 子 feature 清单

1. **build-toolchain-gate** — 修复/记录 WASM build toolchain，使 `npm run build` 成为可执行发布门禁。
   - 所属模块：build-readiness
   - 依赖：无
   - 状态：done
   - 对应 feature：2026-05-25-build-toolchain-gate
   - 备注：最小闭环已完成；普通 `npm run build` 已通过。

2. **release-verification-contract** — 建立统一 verification matrix 与 result record，补上 build 不可漏跑的验收规则。
   - 所属模块：verification-contract
   - 依赖：`build-toolchain-gate`
   - 状态：done
   - 对应 feature：2026-05-25-release-verification-contract
   - 备注：已新增 `npm run verify:release`，默认矩阵覆盖 build、JS tests、typecheck、cargo test 和 diff check。

3. **codestable-evidence-governance** — 清理未跟踪证据资产，决定 `.codestable/`、screenshots、CDP 脚本、`.codegraph/` 的提交/忽略策略。
   - 所属模块：evidence-governance
   - 依赖：无
   - 状态：done
   - 对应 feature：2026-05-25-codestable-evidence-governance
   - 备注：已新增 `docs/evidence-governance.md` 与 `tests/evidence-governance.test.ts`；`.gitignore` 排除本地 runtime/cache/临时视觉诊断资产。

4. **edge-geometry-boundary-contract** — 定义并落地 layout → renderer 的显式 edge geometry 字段，减少 renderer 端猜测。
   - 所属模块：edge-geometry-contract
   - 依赖：`release-verification-contract`
   - 状态：done
   - 对应 feature：2026-05-25-edge-geometry-boundary-contract
   - 备注：Rust/TS `LayoutEdge` 已新增 geometry v1 字段，SVG renderer 优先消费 explicit geometry，缺字段时保留 legacy fallback。

5. **svg-geometry-regression-suite** — 增强 SVG/path/label/shape 的回归测试，覆盖复杂路径和视觉证据。
   - 所属模块：visual-regression-suite
   - 依赖：`release-verification-contract`, `codestable-evidence-governance`
   - 状态：done
   - 对应 feature：2026-05-25-svg-geometry-regression-suite
   - 备注：已新增 `tests/svg-geometry-regression.test.ts`，用 jsdom SVG DOM 断言覆盖 complex path、label fallback、shape boundary 和 arrow styles；未提交截图资产。

**最小闭环**：第 1 条 `build-toolchain-gate` 完成后，项目能在当前环境或文档化的标准环境中跑通完整 `npm run build`，这是后续所有发布就绪工作的最窄端到端路径。

## 6. 排期思路

先处理构建门禁，因为现在最大的问题不是某个视觉细节，而是“代码可能无法发布”。第二步固化 verification contract，防止之后又漏掉 build。证据治理可以并行推进，但它会影响视觉截图和审计文档是否提交。最后再做 layout/renderer 边界和视觉回归，因为这两项会触碰更多代码，必须站在稳定验证基础上做。

技术依赖外的产品优先级未替用户决定；如果架构边界比证据治理更急，可以调整第 3-5 条顺序，但第 1 条不建议后移。

## 7. 观察项

- `.codestable/` 目前整体未跟踪，但里面已有架构、审计、roadmap 资料；这和 CodeStable 长期使用方式冲突。
- `.omx/plans/test-spec-visual-edge-rendering.md` 要求 `npm run build`，但最近 Ralph completion audit 未记录 build 成功。
- `src/wasm-types.d.ts` 和 `src/xmermaid.ts` 的 `any` 边界是长期类型债，可在 `edge-geometry-boundary-contract` 后另拆 WASM type-hardening feature。
- `.codestable/audits/2026-05-24-visual-edge-rendering/index.md` 状态仍是 `active`，需要后续 acceptance 或 governance 决定如何闭合。
