# Quadrant Chart Native Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Mermaid `quadrantChart` as a native xmermaid four-quadrant chart with labeled axes, captions, and normalized data points.

**Architecture:** Parse the official declaration and its title, axis labels, quadrant labels, and `[0,1]` points into `QuadrantAst`. A dedicated Rust layout maps data coordinates into a fixed padded plot and emits chart-specific payload geometry; the TypeScript renderer owns all grid, label, point, and accessible SVG output.

**Tech Stack:** Rust parser/layout/WASM, TypeScript SVG renderer, Vitest, Playwright; no dependencies and no Mermaid.js fallback.

## Global Constraints

- Initial accepted grammar is `quadrantChart`, optional single `title`, optional `x-axis left --> right`, optional `y-axis bottom --> top`, `quadrant-1` through `quadrant-4`, and named `Label: [x, y]` points where both values are finite and inclusive from 0 to 1.
- Coordinates, quadrant titles, and axis labels must retain their semantic position: x increases rightward and y increases upward; quadrant 1 is upper-right, 2 upper-left, 3 lower-left, 4 lower-right.
- Direct point styles, `classDef`, YAML/config blocks, custom dimensions, and values outside `[0, 1]` remain named unsupported syntax rather than silently ignored.
- Chart primitives remain a dedicated `quadrant_chart` layout payload, not generic flowchart nodes/edges.
- `quadrant` becomes partial only after real WASM, SVG, package consumer, and all live browsers verify it.

---

### Task 1: Parse a typed Quadrant Chart AST

**Files:**
- Modify: `crates/xmermaid-parser/src/ast.rs`
- Modify: `crates/xmermaid-parser/src/parser.rs`
- Test: `crates/xmermaid-parser/tests/parser_test.rs`

**Interfaces:**
- `DiagramAst::Quadrant(QuadrantAst)` contains `title`, optional axis pairs, four ordered quadrant labels, and `QuadrantPoint { label, x, y }`.

- [ ] **Step 1: Write failing parser tests**

```rust
#[test]
fn parses_quadrant_chart_labels_and_normalized_points() {
    let ast = parse("quadrantChart\n title Reach and engagement\n x-axis Low --> High\n y-axis Low --> High\n quadrant-1 Expand\n quadrant-2 Promote\n Campaign A: [0.3, 0.6]").unwrap();
    let DiagramAst::Quadrant(chart) = ast else { panic!("expected quadrant chart") };
    assert_eq!(chart.title, "Reach and engagement");
    assert_eq!(chart.x_axis, Some(("Low".into(), "High".into())));
    assert_eq!(chart.quadrants[0], "Expand");
    assert_eq!(chart.points[0].label, "Campaign A");
    assert_eq!((chart.points[0].x, chart.points[0].y), (0.3, 0.6));
}

#[test]
fn rejects_quadrant_points_outside_the_normalized_range() {
    assert!(parse("quadrantChart\n Point: [1.1, 0.5]").is_err());
}
```

- [ ] **Step 2: Verify red**

Run: `cargo test -p xmermaid-parser quadrant`

Expected: parser rejects `quadrantChart` before the new AST variant exists.

- [ ] **Step 3: Implement the smallest parser**

Dispatch `quadrantChart` before the token lexer path. Accept one statement per non-empty, non-comment line, preserve first title/axis/quadrant declarations, parse a point only from a closing `[number, number]` suffix, and reject duplicate declarations, malformed points, style suffixes, or coordinates outside the inclusive unit square.

- [ ] **Step 4: Verify green and commit**

Run: `cargo test -p xmermaid-parser quadrant`

Expected: PASS.

```bash
git add crates/xmermaid-parser/src/ast.rs crates/xmermaid-parser/src/parser.rs crates/xmermaid-parser/tests/parser_test.rs
git commit -m "feat: parse native quadrant charts"
```

### Task 2: Emit native quadrant geometry

**Files:**
- Create: `crates/xmermaid-layout/src/quadrant.rs`
- Modify: `crates/xmermaid-layout/src/types.rs`
- Modify: `crates/xmermaid-layout/src/engine.rs`
- Modify: `crates/xmermaid-layout/src/lib.rs`
- Test: `crates/xmermaid-layout/tests/layout_comprehensive_test.rs`

**Interfaces:**
- `LayoutResult.quadrant_chart: Option<QuadrantChartLayout>` contains plot bounds, axis/quadrant labels, and `QuadrantPointLayout { label, center }`.

- [ ] **Step 1: Write failing layout test**

```rust
#[test]
fn quadrant_layout_maps_unit_points_into_the_correct_plot_quadrants() {
    let ast = parse("quadrantChart\n A: [0.25, 0.75]\n B: [0.75, 0.25]").unwrap();
    let layout = compute_layout(&ast, &LayoutConfig::default());
    let chart = layout.quadrant_chart.expect("quadrant chart layout");
    let center_x = chart.plot.x + chart.plot.width / 2.0;
    let center_y = chart.plot.y + chart.plot.height / 2.0;
    assert!(chart.points[0].center.x < center_x && chart.points[0].center.y < center_y);
    assert!(chart.points[1].center.x > center_x && chart.points[1].center.y > center_y);
}
```

- [ ] **Step 2: Verify red**

Run: `cargo test -p xmermaid-layout quadrant_layout_maps_unit_points_into_the_correct_plot_quadrants`

Expected: compilation fails because `quadrant_chart` does not exist.

- [ ] **Step 3: Implement deterministic chart layout**

Use chart-specific fixed margins plus `LayoutConfig.padding`, produce a square plot, map x directly from left to right and y from bottom to top, and emit empty generic nodes/edges. Reserve title and axis-label space so labels cannot overlap the plot.

- [ ] **Step 4: Verify green and commit**

Run: `cargo test -p xmermaid-layout quadrant_layout_maps_unit_points_into_the_correct_plot_quadrants`

Expected: PASS.

```bash
git add crates/xmermaid-layout/src/quadrant.rs crates/xmermaid-layout/src/types.rs crates/xmermaid-layout/src/engine.rs crates/xmermaid-layout/src/lib.rs crates/xmermaid-layout/tests/layout_comprehensive_test.rs
git commit -m "feat: lay out native quadrant charts"
```

### Task 3: Render grid, labels, and points as native SVG

**Files:**
- Modify: `src/types/layout.ts`
- Modify: `src/renderer/svg.ts`
- Test: `tests/renderer.test.ts`

**Interfaces:**
- Produces `.quadrant-chart`, `.quadrant-cell`, `.quadrant-axis`, `.quadrant-point`, and `.quadrant-point-label` without `.node` or `.edge` elements.

- [ ] **Step 1: Write failing renderer test**

```ts
it('renders a native four-cell quadrant chart and normalized points', () => {
  const svg = new SVGRenderer(DARK_THEME).render({ nodes: [], edges: [], dimensions: { width: 560, height: 560 }, quadrant_chart: fixture });
  expect(svg.querySelectorAll('.quadrant-cell')).toHaveLength(4);
  expect(svg.querySelectorAll('.quadrant-axis')).toHaveLength(2);
  expect(svg.querySelectorAll('.quadrant-point')).toHaveLength(2);
  expect(svg.querySelectorAll('.node')).toHaveLength(0);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/renderer.test.ts -t quadrant`

Expected: FAIL because the renderer ignores `quadrant_chart`.

- [ ] **Step 3: Implement theme-aware SVG output**

Render four low-contrast theme-derived cells, vertical/horizontal divider lines, title/axis/quadrant labels, and circular data points with adjacent text. Every point and the group receives a `<title>` so its position is available to assistive technology.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- tests/renderer.test.ts -t quadrant`

Expected: PASS.

```bash
git add src/types/layout.ts src/renderer/svg.ts tests/renderer.test.ts
git commit -m "feat: render native quadrant SVG"
```

### Task 4: Publish support and real-WASM contracts

**Files:**
- Modify: `crates/xmermaid-wasm/src/lib.rs`
- Modify: `crates/xmermaid-wasm/tests/wasm_test.rs`
- Modify: `src/types/ast.ts`
- Modify: `src/types/index.ts`
- Modify: `src/index.ts`
- Modify: `src/support.ts`
- Modify: `tests/support-matrix.test.ts`
- Create: `tests/quadrant-real-wasm.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing public tests**

```ts
const source = 'quadrantChart\n A: [0.25, 0.75]';
expect(analyzeSupport(source)).toMatchObject({ diagramType: 'quadrant', status: 'partial', unsupportedFeatures: [] });
expect(getDiagramType(parseDsl(source))).toBe('quadrant');
expect(renderWithConfig(source, null)).toMatchObject({ quadrant_chart: expect.any(Object) });
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/support-matrix.test.ts tests/quadrant-real-wasm.test.ts -t quadrant`

Expected: matrix reports `planned` and real WASM cannot parse the source.

- [ ] **Step 3: Publish only the native subset**

Add the AST/WASM diagram type branch and TypeScript declarations. Mark the family partial and report styling suffixes, class directives, YAML/config blocks, malformed coordinates, and values outside 0–1 as named errors before WASM. Document this exact boundary.

- [ ] **Step 4: Verify release readiness and commit**

Run: `cargo test --workspace && npm test && npm run typecheck && npm run build && npm run smoke:consumer && npm run verify:release`

Expected: all checks pass.

```bash
git add crates/xmermaid-wasm src/types src/index.ts src/support.ts tests README.md
git commit -m "feat: publish quadrant support contract"
```

### Task 5: Vendor into xmermaid-live and prove browser consumption

**Files:**
- Modify: `vendor/xmermaid-0.1.0-zenuml.tgz`
- Modify: `vendor/xmermaid-provenance.json`
- Modify: `tests/app.test.ts`
- Modify: `e2e/workspace.spec.ts`

- [ ] **Step 1: Write failing live tests**

```ts
expect(item.dataset.diagramType).toBe('quadrant');
expect(item.dataset.diagramStatus).toBe('partial');
await expect(page.locator('[data-preview] .quadrant-cell')).toHaveCount(4);
await expect(page.locator('[data-preview] .quadrant-point')).toHaveCount(2);
```

- [ ] **Step 2: Verify red, pack, vendor, and refresh provenance**

Run: `npm test -- tests/app.test.ts -t quadrant`, then xmermaid release verification and `npm pack`. Replace only the tracked tarball, update all three provenance hashes, force-install the local tarball without lockfile changes, and rerun the focused live test.

- [ ] **Step 3: Verify all browsers and commit**

Run: `npm run verify`

Expected: live unit tests, production build, Chromium, Firefox, and WebKit all render the native quadrant SVG.

```bash
git add vendor/xmermaid-0.1.0-zenuml.tgz vendor/xmermaid-provenance.json tests/app.test.ts e2e/workspace.spec.ts
git commit -m "feat: consume native quadrant renderer"
```

## Plan Self-Review

- Official grammar coverage is explicit for every accepted declaration and point coordinate.
- The implementation remains native end-to-end and does not project a chart into a flowchart.
- Parser, geometry, SVG, public contracts, package provenance, and real browser usage all have independent red/green evidence.
