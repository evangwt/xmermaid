# svg-geometry-regression-suite 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-05-25
> 关联方案 doc：.codestable/features/2026-05-25-svg-geometry-regression-suite/svg-geometry-regression-suite-design.md

## 1. 接口契约核对

**接口示例逐项核对**：
- [x] `npm test -- tests/svg-geometry-regression.test.ts` → 8/8 通过。
- [x] 新增测试直接构造 `LayoutResult`，调用 `SVGRenderer.render()`，并查询 SVG DOM 的 `path`、`text`、`polygon`、`polyline`、`circle`、`line.arrow-cross`。

**名词层“现状 → 变化”逐项核对**：
- [x] `tests/svg-geometry-regression.test.ts` 覆盖 complex path：multi-waypoint path 保留中间 routing point，path end 不进入 target node。
- [x] 覆盖 label fallback：缺 `label_anchor` / `label_position` 时，label 从最终 visible path geometry 计算。
- [x] 覆盖 shape boundary：diamond/circle/stadium 的 fallback path 起点按 shape 边界截断。
- [x] 覆盖 arrow styles：`filled`、`triangle`、`open`、`circle`、`cross` 的 DOM 形态稳定。

**流程图核对**：
- [x] hand-built `LayoutResult` fixture → `SVGRenderer.render()` → SVG DOM query → path/label/shape/arrow assertions 均有实际测试落点。

## 2. 行为与决策核对

**需求摘要逐项验证**：
- [x] 新增 suite 在 jsdom 下验证实际 SVG DOM。
- [x] 未生成或提交 screenshot baseline。
- [x] 新测试暴露的唯一失败是 diamond expected value 错误；校正测试期望后无需生产代码修复。

**明确不做逐项核对**：
- [x] 未提交 `screenshots/**` 或新视觉图片基线。
- [x] 未引入 Playwright、pixel diff 或新 npm dependency。
- [x] 未改 Rust layout routing 算法。
- [x] 未扩展 Mermaid 语法。
- [x] 未重构 renderer 文件结构。

**关键决策落地**：
- [x] 新增独立 `tests/svg-geometry-regression.test.ts`，没有继续膨胀 `tests/renderer.test.ts`。
- [x] 用 DOM 断言而不是截图资产。
- [x] arrow styles 用参数化测试覆盖。
- [x] shape boundary 通过 path `d` 起点坐标断言覆盖。

**编排层“现状 → 变化”逐项核对**：
- [x] 底层 helper、基础 renderer smoke test、组合 DOM regression test 三层覆盖已同时存在。

**流程级约束核对**：
- [x] 测试没有生成 `screenshots/**`。
- [x] 测试断言实际 SVG DOM，而不是只测 helper return value。
- [x] 未做 renderer/helper 生产修复，因为 regression 最终 green 且无需 production change。

**挂载点反向核对（可卸载性）**：
- [x] 挂载点 M1 `tests/svg-geometry-regression.test.ts`：删除后本 feature 的新增 regression coverage 消失。
- [x] 生产代码挂载点：无新增。
- [x] 反向核查：`rg -n "SVG geometry regression|shape boundary|visual-evidence|screenshots" tests docs .codestable` 命中均为测试、evidence policy 或 CodeStable 文档。

## 3. 验收场景核对

- [x] **S1**：`npm test -- tests/svg-geometry-regression.test.ts` → 8/8 通过。
- [x] **S2**：`npm test -- tests/edge.test.ts tests/renderer.test.ts tests/svg-geometry-regression.test.ts` → 50/50 通过。
- [x] **S3**：`npm run verify:release` → build、JS tests、typecheck、cargo test、diff whitespace 全部 PASS。
- [x] **S4**：`git status --short` 未列出 `screenshots/`、`.codegraph/`、`.omx/`、根目录 `cdp-*`。
- [x] **S5**：checklist 与 roadmap items YAML 已通过校验。

前端改动：无 UI 变更；SVG DOM 行为由 jsdom 单测验证。

## 4. 术语一致性

- `complex path`、`label fallback`、`shape boundary`、`visual evidence` 在 design、checklist、acceptance 和测试命名中含义一致。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 的 Layout / Renderer Edge Geometry Contract 小节已补充 regression suite 覆盖范围。

## 6. requirement 回写

- [x] `requirement` 为空。本 feature 是内部测试覆盖增强，不新增终端用户可见 capability；无 requirement 回写。

## 7. roadmap 回写

- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-items.yaml` 中 `svg-geometry-regression-suite` 已改为 `done`，feature 填 `2026-05-25-svg-geometry-regression-suite`。
- [x] `.codestable/roadmap/visual-rendering-readiness/visual-rendering-readiness-roadmap.md` 子 feature 清单已同步为 `done` 并补充备注。

## 8. attention.md 候选盘点

- 候选 1：本环境运行 CodeStable validator 需使用 `python3`，`python` 命令不存在。已由前序 feature 记录为候选，本 feature 不重复新增。

## 9. 遗留

- 后续优化点：如要做像素级视觉回归，需先按 `docs/evidence-governance.md` 选择明确 baseline/fixture 路径。
- 已知限制：当前 suite 是 DOM geometry regression，不是截图 pixel diff。
- 实现阶段顺手发现：无方案外代码问题。
