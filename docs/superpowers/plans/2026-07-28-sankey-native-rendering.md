# Sankey Native Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mermaid `sankey` / `sankey-beta` render as a native xmermaid Sankey diagram from its documented three-column CSV input.

**Architecture:** Parse each non-empty CSV record into a typed `SankeyAst` containing ordered nodes and weighted links. A dedicated Rust layout computes deterministic DAG columns, vertically packed nodes, and weighted Bézier bands; the TypeScript SVG renderer emits those bands and node/label primitives without projecting them through flowchart geometry.

**Tech Stack:** Rust parser/layout/WASM, TypeScript SVG renderer, Vitest, Playwright; no runtime dependencies and no Mermaid.js fallback.

## Global Constraints

- Accepted input is `sankey` or `sankey-beta`, followed by non-empty RFC-4180-compatible records of exactly `source,target,value`; a value is finite and strictly positive.
- Empty lines and a leading `%%` CSV-header comment are accepted; quoted fields, escaped quotes (`""`), and commas inside quoted fields must round-trip.
- The initial native subset is directed acyclic graphs only. Cycles, duplicated configuration directives, non-CSV statements, zero/negative values, and malformed CSV are rejected before layout and remain explicit unsupported syntax in the support matrix.
- Sankey nodes and links remain chart primitives (`sankey_node`, `sankey_link`) in the layout payload; they must never become generic flowchart nodes or arrowed edges.
- A diagram becomes `partial` only after parser, layout, SVG, WASM, dark/light output, packed xmermaid consumer, and xmermaid-live browser paths pass.
- Preserve all current diagram payload fields, exports, and support behavior. Vendor only a verified xmermaid packed release into xmermaid-live.

---

### Task 1: Add a typed Sankey parser contract

**Files:**
- Modify: `crates/xmermaid-parser/src/ast.rs`
- Modify: `crates/xmermaid-parser/src/parser.rs`
- Test: `crates/xmermaid-parser/tests/parser_test.rs`

**Interfaces:**
- Produces `DiagramAst::Sankey(SankeyAst { nodes, links })` where nodes preserve first-seen order and links preserve source order.
- `SankeyLink { source: String, target: String, value: f64 }` represents exactly one CSV record.

- [ ] **Step 1: Write the failing parser tests**

```rust
#[test]
fn parses_sankey_csv_with_quoted_labels_and_blank_rows() {
    let ast = parse("sankey\n\nSource,\"Target, with comma\",12.5\nSource,Other,3\n").unwrap();
    let DiagramAst::Sankey(chart) = ast else { panic!("expected sankey") };
    assert_eq!(chart.nodes, vec!["Source", "Target, with comma", "Other"]);
    assert_eq!(chart.links.len(), 2);
    assert_eq!(chart.links[0].value, 12.5);
}

#[test]
fn rejects_malformed_or_non_positive_sankey_rows() {
    for source in ["sankey\nA,B", "sankey\nA,B,0", "sankey\nA,B,-1", "sankey\nA,B,nope"] {
        assert!(parse(source).is_err(), "{source}");
    }
}
```

- [ ] **Step 2: Verify red**

Run: `cargo test -p xmermaid-parser sankey`

Expected: compilation or assertions fail because the parser has no `DiagramAst::Sankey` path.

- [ ] **Step 3: Implement the smallest typed parser**

Add the AST structs and dispatch both header forms before the generic keyword switch. Implement a local CSV-record reader that supports quoted delimiters and doubled quotes; skip blank and `%%` lines, require exactly three fields, trim only unquoted field boundaries, reject empty endpoint labels, and parse a positive finite value.

- [ ] **Step 4: Verify green**

Run: `cargo test -p xmermaid-parser sankey`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/xmermaid-parser/src/ast.rs crates/xmermaid-parser/src/parser.rs crates/xmermaid-parser/tests/parser_test.rs
git commit -m "feat: parse native sankey diagrams"
```

### Task 2: Emit deterministic native Sankey geometry

**Files:**
- Create: `crates/xmermaid-layout/src/sankey.rs`
- Modify: `crates/xmermaid-layout/src/types.rs`
- Modify: `crates/xmermaid-layout/src/engine.rs`
- Modify: `crates/xmermaid-layout/src/lib.rs`
- Test: `crates/xmermaid-layout/tests/layout_comprehensive_test.rs`

**Interfaces:**
- `LayoutResult.sankey: Option<SankeyLayout>` holds `nodes`, `links`, and chart dimensions while generic `nodes` and `edges` stay empty.
- `SankeyLayoutNode { id, bounds, value, column }` has a finite positive height; `SankeyLayoutLink { source, target, value, source_y, target_y, thickness }` has a finite positive band thickness.

- [ ] **Step 1: Write the failing layout test**

```rust
#[test]
fn sankey_layout_stacks_weighted_bands_between_columns() {
    let ast = xmermaid_parser::parse("sankey\nA,B,8\nA,C,4\nB,D,8\nC,D,4").unwrap();
    let layout = compute_layout(&ast, &LayoutConfig::default());
    let sankey = layout.sankey.expect("sankey payload");
    assert_eq!(sankey.nodes.len(), 4);
    assert_eq!(sankey.links.len(), 4);
    assert!(sankey.links.iter().all(|link| link.thickness > 0.0));
    assert!(sankey.links.iter().all(|link| link.source_y.is_finite() && link.target_y.is_finite()));
    assert!(sankey.nodes.iter().all(|node| node.bounds.height > 0.0));
}
```

- [ ] **Step 2: Verify red**

Run: `cargo test -p xmermaid-layout sankey_layout_stacks_weighted_bands_between_columns`

Expected: compilation fails because the Sankey layout payload does not exist.

- [ ] **Step 3: Implement deterministic DAG layout**

Compute each node column from its longest incoming path, reject any unresolved cyclic component, sort nodes stably by first-seen order, allocate vertical node heights from the maximum of inbound/outbound weight, and scale all values to fit fixed top/bottom padding. Allocate source and target link slots independently in input order so every cubic band remains non-overlapping at both endpoints.

- [ ] **Step 4: Verify green**

Run: `cargo test -p xmermaid-layout sankey_layout_stacks_weighted_bands_between_columns`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/xmermaid-layout/src/sankey.rs crates/xmermaid-layout/src/types.rs crates/xmermaid-layout/src/engine.rs crates/xmermaid-layout/src/lib.rs crates/xmermaid-layout/tests/layout_comprehensive_test.rs
git commit -m "feat: lay out weighted sankey bands"
```

### Task 3: Render chart-native Sankey SVG

**Files:**
- Modify: `src/types/layout.ts`
- Modify: `src/renderer/svg.ts`
- Test: `tests/svg-renderer.test.ts`

**Interfaces:**
- Consumes `LayoutResult.sankey` from WASM.
- Produces `.sankey`, `.sankey-link`, `.sankey-node`, and `.sankey-label` SVG primitives with accessible `<title>` descriptions.

- [ ] **Step 1: Write the failing renderer test**

```ts
it('renders weighted Sankey bands and node labels without flowchart edges', () => {
  const svg = new SVGRenderer(DARK_THEME).render({
    nodes: [], edges: [], pie_slices: [], dimensions: { width: 620, height: 360 }, sankey: fixture,
  });
  expect(svg.querySelectorAll('.sankey-link')).toHaveLength(2);
  expect(svg.querySelectorAll('.sankey-node')).toHaveLength(3);
  expect(svg.querySelector('.sankey-label')?.textContent).toContain('Source');
  expect(svg.querySelectorAll('.edge')).toHaveLength(0);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/svg-renderer.test.ts -t Sankey`

Expected: FAIL because `sankey` is ignored by `SVGRenderer`.

- [ ] **Step 3: Implement SVG bands and nodes**

Render each band as a closed cubic Bézier path from source top/bottom slots to target top/bottom slots; use `edgeStroke` at reduced opacity for links and an alternating theme-derived palette for nodes. Append labels outside the first/last columns and inside safe bounds for intermediate columns. Preserve renderer ordering so chart primitives are not covered by generic content.

- [ ] **Step 4: Verify green**

Run: `npm test -- tests/svg-renderer.test.ts -t Sankey`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/layout.ts src/renderer/svg.ts tests/svg-renderer.test.ts
git commit -m "feat: render native sankey SVG"
```

### Task 4: Publish accurate support and WASM contracts

**Files:**
- Modify: `crates/xmermaid-wasm/src/lib.rs`
- Modify: `src/support.ts`
- Modify: `tests/support-matrix.test.ts`
- Modify: `tests/xmermaid.test.ts`
- Modify: `README.md`

**Interfaces:**
- `get_diagram_type(parse_dsl(source))` returns `sankey`.
- `analyzeSupport(ACCEPTED_SOURCE)` reports `{ diagramType: 'sankey', status: 'partial', unsupportedFeatures: [] }`.

- [ ] **Step 1: Write failing public-contract tests**

```ts
const SOURCE = 'sankey\nA,B,8\nB,C,8';
expect(analyzeSupport(SOURCE)).toMatchObject({ diagramType: 'sankey', status: 'partial', unsupportedFeatures: [] });
await expect(renderer.renderToSVGElement(SOURCE)).resolves.toMatchObject({ diagramType: 'sankey' });
expect(analyzeSupport('sankey\nA,B,0').unsupportedFeatures).toContainEqual(expect.objectContaining({ id: 'sankey.invalidValue' }));
```

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/support-matrix.test.ts tests/xmermaid.test.ts -t sankey`

Expected: Sankey remains `planned` and the real WASM render rejects.

- [ ] **Step 3: Expose only the accepted subset**

Add the AST/WASM diagram type branch and typed TypeScript payload. Mark `sankey` partial only for three-column positive CSV DAG records; detect cycles, malformed values, directive/config syntax, and invalid CSV as named unsupported features before WASM. Document the supported grammar and explicitly omitted configuration modes.

- [ ] **Step 4: Verify release readiness**

Run: `cargo test --workspace && npm test && npm run typecheck && npm run build && npm run smoke:consumer && npm run verify:release`

Expected: every xmermaid validation command passes.

- [ ] **Step 5: Commit**

```bash
git add crates/xmermaid-wasm/src/lib.rs src/support.ts tests/support-matrix.test.ts tests/xmermaid.test.ts README.md
git commit -m "feat: publish sankey support contract"
```

### Task 5: Consume the verified package in xmermaid-live

**Files:**
- Modify: `vendor/xmermaid-0.1.0-zenuml.tgz`
- Modify: `vendor/xmermaid-provenance.json`
- Modify: `tests/app.test.ts`
- Modify: `e2e/workspace.spec.ts`
- Modify: `README.md`

**Interfaces:**
- xmermaid-live consumes the packed xmermaid artifact and renders `.sankey-link` / `.sankey-node` from its sole renderer.

- [ ] **Step 1: Write the failing live tests**

```ts
const source = '```mermaid\\nsankey\\nA,B,8\\nB,C,8\\n```';
expect(item.dataset.diagramType).toBe('sankey');
expect(item.dataset.diagramStatus).toBe('partial');
await expect(page.locator('[data-preview] .sankey-link')).toHaveCount(2);
await expect(page.locator('[data-preview] .sankey-node')).toHaveCount(3);
```

- [ ] **Step 2: Verify red against the current vendor**

Run: `npm test -- tests/app.test.ts && npm run build && npx playwright test e2e/workspace.spec.ts --project=chromium -g sankey`

Expected: the live app reports Sankey as planned and the chart SVG is absent.

- [ ] **Step 3: Pack and vendor the verified release**

Run xmermaid release verification, pack the local package, replace only the tracked vendor tarball, refresh source/tarball/WASM hashes in provenance, and force-install the local package bytes without changing the lockfile's unrelated content. Do not add a live renderer branch or a Mermaid.js dependency.

- [ ] **Step 4: Verify all browser paths**

Run: `npm run verify`

Expected: live unit tests, production build, Chromium, Firefox, and WebKit pass with the native Sankey preview.

- [ ] **Step 5: Commit**

```bash
git add vendor/xmermaid-0.1.0-zenuml.tgz vendor/xmermaid-provenance.json tests/app.test.ts e2e/workspace.spec.ts README.md
git commit -m "feat: consume native sankey renderer"
```

## Plan Self-Review

- Coverage: parser, typed AST, deterministic layout, native SVG, support detection, WASM diagram type, package provenance, and the real live browser consume path all have separate validation.
- Grammar boundary: official CSV semantics (three fields, blank lines, quoted commas and doubled quotes) are covered; configuration and cycles remain intentionally explicit rather than silently misrendered.
- Type consistency: `SankeyAst` becomes `DiagramAst::Sankey`, emits `LayoutResult.sankey`, and is consumed by `SVGRenderer` and xmermaid-live without a second renderer.
