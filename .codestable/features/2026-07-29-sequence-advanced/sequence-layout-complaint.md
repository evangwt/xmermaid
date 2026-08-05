---
doc_type: issue
feature: 2026-07-29-sequence-advanced
status: open
type: bug
summary: Native sequence geometry uses fixed-width participants and document-wide control blocks.
tags: [sequence, layout, renderer, live-regression]
---

# Sequence Layout Content-Fit Complaint

## 目标

Native sequence diagrams must render participant headers, message labels and control frames around their actual content at the default theme size. In a multi-chart Live document, users must be able to inspect the active diagram without unrelated participant columns or full-width nested frames consuming the preview.

## 范围

In scope: sequence layout geometry, sequence SVG rendering, the default SVG text size, and the Live package/browser regression path. Out of scope: a Mermaid.js fallback, parser grammar expansion, CSS scaling to conceal incorrect SVG geometry, feature closure, commits and release publication.

## 当前证据

The supplied sequence-document sample was loaded into the running Live server on 2026-07-29. Browser SVG measurements for its first diagram show:

- Seven of nine participant labels exceed their fixed `120`-unit headers; `PostgreSQL Task Repository` measures `188.03` units.
- A nested `par` block that only contains two self messages is `1748` units wide; the enclosing `rect` is `1776` units wide.
- The generated SVG text includes `14px` participant labels despite the Live shell being `14px`; reducing only application CSS does not change diagram typography.
- A message with a `312.95`-unit label is drawn on a `200`-unit line, and a `327.55`-unit self-message label is drawn over a `34`-unit loop.

Evidence artifact: `../../../../xmermaid-live/output/playwright/sequence-layout-geometry-current.png`.

## 反馈回路

1. Start Live with `npm run dev -- --host`.
2. Load the supplied document or the focused multi-sequence fixture through the complete-text editor.
3. Query `[data-preview] svg` and compare each participant `<text>.getBBox().width` with its header `<rect>.getBBox().width`, then compare nested block widths with the document viewBox.
4. The pre-fix run is deterministic and red-capable: at least one label fails `text + 18 <= frame`, and the scoped nested block is nearly document wide.

## 复现与最小化

The minimum reproduced case contains one participant alias wider than 120 units, one self message with a long label, and an `alt` or `par` block limited to two of at least four participants. Removing aliases removes the header failure; removing the block removes the full-width-frame failure; removing the self message removes the loop-label collision.

## 根因定位

### Hypotheses and evidence

1. **Fixed participant geometry is the direct header-overflow cause.** Confirmed: `crates/xmermaid-layout/src/sequence.rs` assigns every header `config.node_width.max(120.0)`.
2. **Blocks have no content ownership.** Confirmed: on `BlockEnd` the layout assigns each block `width - config.padding * 2`, independent of events, notes, or participants inside the block.
3. **Message text has no reserved horizontal span.** Confirmed: row geometry is a constant `ROW_HEIGHT`, participant gaps are constant, and the renderer places message text at the endpoint midpoint.
4. **The previous font change reached only the Live shell.** Confirmed: `src/styles.css` uses `14px`, while the upstream default `RenderTheme.fontSize` also remains `14`; SVG labels use the upstream value.

### Root-cause chain

The parser correctly produces ordered sequence events. The layout discards content-size information when it turns those events into fixed header widths, fixed inter-participant gaps and full-document blocks. The renderer then faithfully emits those incorrect coordinates. Live’s fit transform makes the oversized viewBox small and visually rough but cannot restore the lost geometry.

## 质量目标

- **功能适宜性 / 正确性:** text bounds must fit their owning participant, message route, and block frame in a repeatable browser regression.
- **交互能力 / 易操作性:** the packaged Live preview must retain readable default type and expose its controls and diagnostics without clipping.
- **可维护性 / 可分析性:** layout owns geometry; the renderer consumes it. Browser tests assert observable SVG bounds rather than CSS side effects.

## 执行记录

- 已先建立并运行红色回归：固定 `120` 宽头部、固定自消息回路、端点中点标签和文档全宽控制块均会触发几何断言；默认 SVG 字号断言也验证了旧值为 `14px`。
- `xmermaid-layout` 现根据参与者别名、跨参与者消息和自消息标签计算横向空间；`SequenceMessageLayout` 提供布局拥有的标签坐标和自环宽度。控制块收集内部消息/Note 的范围并仅为自身标签补足，而不再在 `end` 时铺满整张图。
- SVG renderer 直接消费上述几何并渲染多行 Note；默认图内主题字号改为 `12px`，Live 工作台壳层保持 `14px`。
- Live 已使用 `xmermaid@0.1.4` 包重新构建；浏览器回归覆盖内容适配、多图表诊断身份、底栏可见性、拖拽期间禁选文本、复制反馈与恢复控件的统一样式。
- 全量浏览器运行曾暴露恢复控件测试在 CSS 应用完成前读取计算样式的竞争。控件 CSS 本身和单测均已正确；回归改为等待实际 `border-radius: 6px` 后读取其余样式，避免把加载时序误报为产品故障。

## 验证

- `xmermaid`: `cargo test -p xmermaid-layout --test layout_comprehensive_test`、`cargo test -p xmermaid-layout --test roundtrip_test`、`npm run build:wasm`、`npm test -- tests/sequence-real-wasm.test.ts tests/renderer.test.ts` 通过；`npm run verify:release` 通过（WASM/consumer package/docs/JS/TypeScript/Rust/diff whitespace）。
- `xmermaid-live`: `npm run verify` 通过：TypeScript typecheck、90 个 Vitest 测试、生产构建和 Chromium/Firefox/WebKit 共 126 个端到端测试。
- 真实浏览器检查 `http://192.168.31.199:5175`：两张时序图载入后，第一张的 4 个参与者均满足 `headerWidth >= labelWidth + 18`；参与者 SVG 字号为 `12`；其局部 `par` 块宽 `816`，总 viewBox 宽 `1432.25`。拖拽时 `canvas-panning=true` 且 `user-select=none`，mouseup 后分别恢复为 `false` 和 `auto`。复制复现源码显示成功反馈；将第二张改为不完整消息后，诊断为 `parse_error ...（图表 2）`，保留最后成功预览。

## 关闭回写

Do not close in this task. When verified and explicitly accepted, update the sequence acceptance record and the production support contract with content-fit geometry behavior.

## 关闭结论

Pending implementation and verification.
