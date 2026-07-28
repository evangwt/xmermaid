# XyChart Native Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mermaid `xychart-beta` a genuinely rendered xmermaid diagram family with categorical bar and line series, rather than a planned diagnostic or flowchart projection.

**Architecture:** Parse the documented `title`, categorical `x-axis`, numeric `y-axis`, `bar`, and `line` statements into a typed `XyChartAst`. The Rust layout emits chart-specific geometry in `LayoutResult`; the TypeScript SVG renderer owns axis, tick, bar and polyline output so the result remains a native SVG export under the existing xmermaid theme contract.

**Tech Stack:** Rust parser/layout/WASM, TypeScript SVG renderer, Vitest, browser consumers; no new dependencies and no Mermaid.js fallback.

## Global Constraints

- `xychart-beta` only becomes `partial` after its parser, layout, SVG renderer, dark/light output and xmermaid-live browser path are all proven.
- Initial accepted grammar is title, categorical x-axis labels in brackets, numeric y-axis ranges, and one or more numeric `bar` or `line` series; malformed, length-mismatched or unsupported syntax must fail before layout.
- Axis and series primitives must be rendered as chart SVG elements, never inferred as generic flowchart nodes or edges.
- Preserve all existing layout payload fields and renderer behavior for previously supported families.
- Vendor the packed xmermaid release into xmermaid-live only after xmermaid release verification passes.

---

### Task 1: Parse a typed xychart AST

**Files:**

- Modify: `crates/xmermaid-parser/src/ast.rs`
- Modify: `crates/xmermaid-parser/src/parser.rs`
- Test: `crates/xmermaid-parser/tests/parser_test.rs`

**Interfaces:**

- Produces `DiagramAst::XyChart(XyChartAst)` with `title`, `x_labels`, `y_min`, `y_max`, and ordered `XySeries { kind: Bar | Line, values }`.
- Accepts `xychart-beta`, `title "Quarterly revenue"`, `x-axis [Q1, Q2]`, `y-axis "Revenue" 0 --> 100`, `bar [20, 40]`, and `line [30, 50]`.

- [ ] **Step 1: Write failing parser tests**

```rust
#[test]
fn test_parse_xychart_bar_and_line_series() {
    let ast = parse("xychart-beta\n  title \"Quarterly revenue\"\n  x-axis [Q1, Q2]\n  y-axis \"Revenue\" 0 --> 100\n  bar [20, 40]\n  line [30, 50]").unwrap();
    match ast {
        DiagramAst::XyChart(chart) => {
            assert_eq!(chart.title, "Quarterly revenue");
            assert_eq!(chart.x_labels, vec!["Q1", "Q2"]);
            assert_eq!(chart.y_min, 0.0);
            assert_eq!(chart.y_max, 100.0);
            assert_eq!(chart.series.len(), 2);
        }
        _ => panic!("expected xychart"),
    }
}
```

- [ ] **Step 2: Verify red**

Run: `cargo test -p xmermaid-parser test_parse_xychart_bar_and_line_series`

Expected: the parser rejects `xychart-beta` before `DiagramAst::XyChart` exists.

- [ ] **Step 3: Add minimal parser and AST support**

Add an `XyChartAst` and `XySeriesKind`; dispatch `xychart-beta` in `Parser::parse`; reject missing axes, non-numeric y bounds, mismatched series lengths, and non-finite values with `ParseError::UnexpectedToken`.

- [ ] **Step 4: Verify green**

Run: `cargo test -p xmermaid-parser test_parse_xychart_bar_and_line_series`

Expected: PASS.

### Task 2: Emit chart-native layout geometry

**Files:**

- Create: `crates/xmermaid-layout/src/xychart.rs`
- Modify: `crates/xmermaid-layout/src/types.rs`
- Modify: `crates/xmermaid-layout/src/engine.rs`
- Modify: `crates/xmermaid-layout/src/lib.rs`
- Test: `crates/xmermaid-layout/tests/layout_comprehensive_test.rs`

**Interfaces:**

- Produces optional `xy_chart: XyChartLayout` in `LayoutResult`, containing plot bounds, title, labels, y range and `Bar` / `Line` drawable series.
- Keeps `nodes`, `edges`, and `pie_slices` empty for a chart-only diagram.

- [ ] **Step 1: Write failing layout test**

```rust
#[test]
fn xychart_layout_keeps_bar_baselines_and_line_points_inside_the_plot() {
    let ast = xmermaid_parser::parse("xychart-beta\n  x-axis [Q1, Q2]\n  y-axis 0 --> 100\n  bar [20, 40]\n  line [30, 50]").unwrap();
    let layout = compute_layout(&ast, &LayoutConfig::default());
    let chart = layout.xy_chart.expect("xy chart layout");
    assert_eq!(chart.x_labels, vec!["Q1", "Q2"]);
    assert!(chart.series.iter().any(|series| series.kind == XySeriesKind::Bar));
    assert!(chart.series.iter().any(|series| series.kind == XySeriesKind::Line));
    assert!(chart.plot.height > 0.0);
}
```

- [ ] **Step 2: Verify red**

Run: `cargo test -p xmermaid-layout xychart_layout_keeps_bar_baselines_and_line_points_inside_the_plot`

Expected: compilation fails because `xy_chart` does not exist.

- [ ] **Step 3: Add the deterministic chart layout**

Use fixed chart margins plus `LayoutConfig.padding`, map the y range to a vertical plot coordinate, center each category in equal x bands, place bar rectangles on the zero baseline, and place line points at category centers. Return the chart payload from `DiagramAst::XyChart` dispatch.

- [ ] **Step 4: Verify green**

Run: `cargo test -p xmermaid-layout xychart_layout_keeps_bar_baselines_and_line_points_inside_the_plot`

Expected: PASS.

### Task 3: Render axes, bars, lines and labels as SVG

**Files:**

- Modify: `src/types/ast.ts`
- Modify: `src/types/layout.ts`
- Modify: `src/types/index.ts`
- Modify: `src/index.ts`
- Modify: `src/renderer/svg.ts`
- Test: `tests/svg-renderer.test.ts`

**Interfaces:**

- Consumes `LayoutResult.xy_chart` from WASM.
- Produces SVG groups with `.xychart`, `.xychart-axis`, `.xychart-bar`, `.xychart-line`, and accessible text labels.

- [ ] **Step 1: Write failing renderer test**

```ts
it('renders native xychart axes, bars, and a line without flowchart nodes', () => {
  const svg = new SVGRenderer(DARK_THEME).render({
    nodes: [], edges: [], pie_slices: [], dimensions: { width: 480, height: 360 },
    xy_chart: fixture,
  });
  expect(svg.querySelectorAll('.xychart-axis')).toHaveLength(2);
  expect(svg.querySelectorAll('.xychart-bar')).toHaveLength(2);
  expect(svg.querySelector('.xychart-line')).not.toBeNull();
  expect(svg.querySelectorAll('.node')).toHaveLength(0);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/svg-renderer.test.ts -t xychart`

Expected: FAIL because `xy_chart` is not rendered.

- [ ] **Step 3: Add minimal native SVG rendering**

Render a dedicated chart group before generic nodes/edges. Use theme text/stroke colors for axes and labels, `nodeFill` / `nodeStroke` for bars, and `edgeStroke` for lines; keep every graphical value inside the layout dimensions.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/svg-renderer.test.ts -t xychart`

Expected: PASS.

### Task 4: Publish and consume the support contract

**Files:**

- Modify: `crates/xmermaid-wasm/src/lib.rs`
- Modify: `src/support.ts`
- Modify: `tests/support-matrix.test.ts`
- Modify: `tests/xmermaid.test.ts`
- Modify: `README.md`

**Interfaces:**

- `get_diagram_type(parse_dsl(source))` returns `xychart`.
- `analyzeSupport(source)` returns `partial` and no unsupported feature for the accepted grammar.

- [ ] **Step 1: Write failing support and real-WASM tests**

```ts
expect(analyzeSupport(SOURCE)).toMatchObject({ diagramType: 'xychart', status: 'partial', unsupportedFeatures: [] });
await expect(renderer.renderToSVGElement(SOURCE)).resolves.toMatchObject({ diagramType: 'xychart' });
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts -t xychart`

Expected: the matrix reports `planned` and render rejects before WASM.

- [ ] **Step 3: Mark only the implemented subset partial**

Add `partialXyChart()` and detection for unsupported horizontal orientation, numeric x-axis, multi-series labels, and unsupported directives. Update the public AST exports, WASM type switch, and README boundary.

- [ ] **Step 4: Verify green and release readiness**

Run: `cargo test --workspace && npm test && npm run typecheck && npm run build && npm run smoke:consumer && npm run verify:release`

Expected: all xmermaid validation passes.

### Task 5: Vendor xychart into xmermaid-live and prove browser usage

**Files:**

- Modify: `vendor/xmermaid-0.1.0-zenuml.tgz`
- Modify: `tests/app.test.ts`
- Modify: `e2e/workspace.spec.ts`
- Modify: `README.md`

**Interfaces:**

- xmermaid-live consumes the packed xmermaid artifact; no renderer branch or Mermaid.js dependency is introduced.

- [ ] **Step 1: Write failing live tests**

```ts
expect(item.dataset.diagramType).toBe('xychart');
expect(item.dataset.diagramStatus).toBe('partial');
await expect(page.locator('[data-preview] .xychart-bar')).toHaveCount(2);
await expect(page.locator('[data-preview] .xychart-line')).toBeVisible();
```

- [ ] **Step 2: Verify red against the current vendor artifact**

Run: `npm test -- tests/app.test.ts && npm run build && npx playwright test e2e/workspace.spec.ts --project=chromium -g xychart`

Expected: the live app reports xychart as planned and has no chart SVG.

- [ ] **Step 3: Pack, vendor, and update live documentation**

Run xmermaid's package build/verification, replace only the tracked vendor tarball, reinstall the local package lock state if required, then document the exact partial xychart subset in xmermaid-live.

- [ ] **Step 4: Verify browser behavior in all supported engines**

Run: `npm run verify`

Expected: live Vitest, production build, Chromium, Firefox and WebKit all pass.

## Plan Self-Review

- Coverage: the parser, layout, renderer, support contract, WASM bridge, packed consumer, and all browser paths are explicit.
- Placeholder scan: accepted grammar and failure boundaries are concrete; no dependency or fallback is deferred.
- Type consistency: `XyChartAst` becomes `DiagramAst::XyChart`, emits `LayoutResult.xy_chart`, and renders through the existing `SVGRenderer` interface.
