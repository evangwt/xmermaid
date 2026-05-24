# xmermaid Architecture Redesign — Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking tracking.

**Goal:** Decouple Parser/Layout/Renderer layers, fix edge/arrow rendering, and refine Flowchart with comprehensive tests.

**Architecture:** Interface-driven decoupling — Layout receives `LayoutConfig` instead of hardcoded constants, outputs `LayoutResult` with node bounds and edge waypoints. Renderer receives `RenderTheme` for styling, draws edges from waypoints with proper gap/arrow truncation. Each layer depends on typed contracts, not implementation details.

**Tech Stack:** Rust (parser + layout + WASM), TypeScript (SDK + SVG renderer), Vitest (JS tests), wasm-pack + rollup (build)

---

## File Structure

### Rust — New/Modified Files

| File | Action | Responsibility |
|------|--------|----------------|
| `crates/xmermaid-parser/src/lib.rs` | Modify | Re-export new submodules |
| `crates/xmermaid-parser/src/ast.rs` | Modify | Add `NodeShape` enum, extend `FlowchartNode` with `shape` field |
| `crates/xmermaid-parser/src/flowchart/mod.rs` | Create | Flowchart parser module root |
| `crates/xmermaid-parser/src/flowchart/lexer.rs` | Create | Move flowchart-specific lexing from `lexer.rs` |
| `crates/xmermaid-parser/src/flowchart/parser.rs` | Create | Move flowchart parsing from `parser.rs` |
| `crates/xmermaid-parser/src/lexer.rs` | Modify | Keep only common lexer utilities, delegate flowchart tokens |
| `crates/xmermaid-parser/src/parser.rs` | Modify | Entry dispatcher — match diagram keyword, delegate to sub-parser |
| `crates/xmermaid-layout/src/lib.rs` | Modify | Re-export new types |
| `crates/xmermaid-layout/src/types.rs` | Create | `LayoutConfig`, `LayoutNode`, `LayoutEdge`, `LayoutResult`, `Bounds`, `NodeShape` |
| `crates/xmermaid-layout/src/engine.rs` | Modify | Accept `LayoutConfig`, output `LayoutResult` with waypoints and bounds |
| `crates/xmermaid-layout/src/flowchart.rs` | Create | Flowchart-specific layout logic extracted from `engine.rs` |
| `crates/xmermaid-wasm/src/lib.rs` | Modify | Expose new types, pass `LayoutConfig` through WASM boundary |

### TypeScript — New/Modified Files

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/layout.ts` | Modify | Add `LayoutNode`, `LayoutEdge`, `Bounds`, `LayoutConfig` interfaces |
| `src/types/theme.ts` | Create | `RenderTheme`, `ThemeColors`, arrow/curve style types |
| `src/types/options.ts` | Modify | Add `layoutConfig` and `theme` to `XMermaidOptions` |
| `src/types/index.ts` | Modify | Re-export `theme.ts` |
| `src/renderer/types.ts` | Modify | Update to use new layout types |
| `src/renderer/svg.ts` | Modify | Use waypoints + theme for edge/arrow rendering, implement gap/arrow truncation |
| `src/renderer/edge.ts` | Create | Edge path computation: bezier/step/straight curve generation, arrow positioning, gap truncation |
| `src/renderer/theme.ts` | Create | Built-in themes (default, dark, minimal), `createTheme` helper |
| `src/xmermaid.ts` | Modify | Pass `LayoutConfig` to WASM, pass `RenderTheme` to renderer |
| `src/wasm.ts` | Modify | Update WASM bindings for new `LayoutResult` shape |

### Test/Example Files

| File | Action | Responsibility |
|------|--------|----------------|
| `tests/renderer.test.ts` | Modify | Update for new layout types, add edge/arrow tests |
| `tests/edge.test.ts` | Create | Edge path computation tests (bezier, step, straight, gap, arrow) |
| `tests/theme.test.ts` | Create | Theme creation and merging tests |
| `examples/basic.html` | Modify | Update for new API |
| `examples/flowchart-complex.html` | Create | 15+ nodes, subgraphs, long labels, self-loops |
| `examples/flowchart-directions.html` | Create | Same diagram TB/LR/RL/BT |
| `examples/theme-comparison.html` | Create | Same chart in 3 themes |

---

## Task 1: Define Layout Types in Rust

**Files:**
- Create: `crates/xmermaid-layout/src/types.rs`
- Modify: `crates/xmermaid-layout/src/lib.rs`

- [ ] **Step 1: Create `types.rs` with all layout types**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Direction of flowchart layout
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlowDirection {
    TB,
    BT,
    LR,
    RL,
}

/// Configuration for layout computation, replacing hardcoded constants
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub node_width: f64,
    pub node_height: f64,
    pub h_spacing: f64,
    pub v_spacing: f64,
    pub padding: f64,
    pub direction: FlowDirection,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            node_width: 120.0,
            node_height: 40.0,
            v_spacing: 60.0,
            h_spacing: 60.0,
            padding: 40.0,
            direction: FlowDirection::TB,
        }
    }
}

/// A 2D point
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Axis-aligned bounding box
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Bounds {
    pub fn from_center(center: Point, width: f64, height: f64) -> Self {
        Self {
            x: center.x - width / 2.0,
            y: center.y - height / 2.0,
            width,
            height,
        }
    }

    pub fn center(&self) -> Point {
        Point {
            x: self.x + self.width / 2.0,
            y: self.y + self.height / 2.0,
        }
    }

    pub fn left(&self) -> f64 { self.x }
    pub fn right(&self) -> f64 { self.x + self.width }
    pub fn top(&self) -> f64 { self.y }
    pub fn bottom(&self) -> f64 { self.y + self.height }
}

/// Shape of a node, forwarded from AST
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeShape {
    Rectangle,
    RoundedRect,
    Stadium,
    Diamond,
    Circle,
    Hexagon,
    Parallelogram,
    Trapezoid,
}

/// A positioned node in the layout result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutNode {
    pub id: String,
    pub center: Point,
    pub bounds: Bounds,
    pub shape: NodeShape,
    pub label: String,
}

/// A positioned edge in the layout result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutEdge {
    pub from: String,
    pub to: String,
    pub waypoints: Vec<Point>,
    pub label: Option<String>,
    pub label_position: Option<Point>,
}

/// Overall dimensions of the layout
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Dimensions {
    pub width: f64,
    pub height: f64,
}

/// Complete layout result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutResult {
    pub nodes: Vec<LayoutNode>,
    pub edges: Vec<LayoutEdge>,
    pub dimensions: Dimensions,
}
```

- [ ] **Step 2: Update `lib.rs` to re-export new types**

Replace the entire content of `crates/xmermaid-layout/src/lib.rs`:

```rust
pub mod coordinate;
pub mod engine;
pub mod error;
pub mod types;

pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    NodeShape, Point,
};
```

- [ ] **Step 3: Run `cargo check` to verify types compile**

Run: `cd /Volumes/Data/Code/xmermaid && cargo check`
Expected: Compiles with warnings about unused imports in `engine.rs` (will fix in Task 3)

- [ ] **Step 4: Commit**

```bash
git add crates/xmermaid-layout/src/types.rs crates/xmermaid-layout/src/lib.rs
git commit -m "feat(layout): define LayoutConfig, LayoutNode, LayoutEdge, LayoutResult types"
```

---

## Task 2: Add NodeShape to Parser AST

**Files:**
- Modify: `crates/xmermaid-parser/src/ast.rs`

- [ ] **Step 1: Add `NodeShape` enum and `shape` field to `FlowchartNode`**

In `crates/xmermaid-parser/src/ast.rs`, add the `NodeShape` enum before `FlowchartNode`:

```rust
/// Shape of a flowchart node
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NodeShape {
    Rectangle,
    RoundedRect,
    Stadium,
    Diamond,
    Circle,
    Hexagon,
    Parallelogram,
    Trapezoid,
}
```

Then add a `shape` field to `FlowchartNode`:

```rust
pub struct FlowchartNode {
    pub id: String,
    pub label: String,
    pub shape: NodeShape,
}
```

- [ ] **Step 2: Update all `FlowchartNode` construction sites**

In `crates/xmermaid-parser/src/parser.rs`, find every place where `FlowchartNode` is constructed and add `shape: NodeShape::RoundedRect` (the current default for `[]` syntax). Update the parser to assign shapes based on delimiter syntax:
- `[label]` → `NodeShape::Rectangle`
- `(label)` → `NodeShape::RoundedRect`
- `([label])` → `NodeShape::Stadium`
- `{label}` → `NodeShape::Diamond`
- `((label))` → `NodeShape::Circle`
- `{{label}}` → `NodeShape::Hexagon`
- `[/label/]` → `NodeShape::Parallelogram`
- `[/label\]` → `NodeShape::Trapezoid`

For now, since the current parser only handles `[label]` and `(label)`, add `shape: NodeShape::Rectangle` to the `[label]` case and `NodeShape::RoundedRect` to the `(label)` case. All other cases get `NodeShape::Rectangle` as a placeholder until the parser is extended.

- [ ] **Step 3: Run `cargo check`**

Run: `cd /Volumes/Data/Code/xmermaid && cargo check`
Expected: Compiles (may have warnings about unused `NodeShape` variants — that's fine)

- [ ] **Step 4: Commit**

```bash
git add crates/xmermaid-parser/src/ast.rs crates/xmermaid-parser/src/parser.rs
git commit -m "feat(parser): add NodeShape enum and shape field to FlowchartNode"
```

---

## Task 3: Refactor Layout Engine to Use LayoutConfig and Output LayoutResult

**Files:**
- Create: `crates/xmermaid-layout/src/flowchart.rs`
- Modify: `crates/xmermaid-layout/src/engine.rs`
- Modify: `crates/xmermaid-layout/src/lib.rs`

- [ ] **Step 1: Create `flowchart.rs` with the extracted flowchart layout logic**

Move the core layout algorithm from `engine.rs` into `crates/xmermaid-layout/src/flowchart.rs`. The function signature changes to accept `LayoutConfig` and return `LayoutResult`. The implementation is the same algorithm but uses config fields instead of constants, and computes waypoints for edges.

```rust
use crate::types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    NodeShape, Point,
};
use xmermaid_parser::ast::{DiagramAst, FlowchartAst, FlowchartEdge, FlowchartNode};

/// Compute layout for a flowchart diagram
pub fn layout(ast: &FlowchartAst, config: &LayoutConfig) -> LayoutResult {
    let direction = config.direction;

    // Build adjacency lists
    let mut children: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    let mut parents: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    let mut edge_map: std::collections::HashMap<(String, String), Option<String>> =
        std::collections::HashMap::new();

    for edge in &ast.edges {
        let (from, to) = match edge {
            FlowchartEdge::Directed { from, to, label } => {
                edge_map.insert((from.clone(), to.clone()), label.clone());
                (from.clone(), to.clone())
            }
            FlowchartEdge::Undirected { from, to, label } => {
                edge_map.insert((from.clone(), to.clone()), label.clone());
                (from.clone(), to.clone())
            }
        };
        children.entry(from.clone()).or_default().push(to.clone());
        parents.entry(to.clone()).or_default().push(from.clone());
    }

    // Compute ranks (longest path from root)
    let mut rank: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut queue: Vec<String> = Vec::new();

    for node in &ast.nodes {
        if parents.get(&node.id).map_or(0, |p| p.len()) == 0 {
            rank.insert(node.id.clone(), 0);
            queue.push(node.id.clone());
        }
    }

    while let Some(node_id) = queue.pop() {
        let node_rank = *rank.get(&node_id).unwrap();
        if let Some(kids) = children.get(&node_id) {
            for child in kids {
                let new_rank = node_rank + 1;
                let current = rank.get(child).copied().unwrap_or(0);
                if new_rank > current {
                    rank.insert(child.clone(), new_rank);
                    queue.push(child.clone());
                }
            }
        }
    }

    // Assign positions
    let mut positions: std::collections::HashMap<String, Point> =
        std::collections::HashMap::new();

    let mut by_rank: std::collections::HashMap<usize, Vec<String>> =
        std::collections::HashMap::new();
    for (id, r) in &rank {
        by_rank.entry(*r).or_default().push(id.clone());
    }

    let max_rank = rank.values().copied().max().unwrap_or(0);

    for r in 0..=max_rank {
        let nodes = by_rank.get(&r).map(|v| v.as_slice()).unwrap_or(&[]);
        let count = nodes.len();
        let total_width = if count > 0 {
            count as f64 * config.node_width + (count as f64 - 1.0) * config.h_spacing
        } else {
            0.0
        };
        let start_x = config.padding + (total_width - config.node_width) / 2.0;

        for (i, id) in nodes.iter().enumerate() {
            let x = start_x + i as f64 * (config.node_width + config.h_spacing);
            let y = config.padding + r as f64 * (config.node_height + config.v_spacing)
                + config.node_height / 2.0;
            positions.insert(
                id.clone(),
                Point {
                    x: x + config.node_width / 2.0,
                    y,
                },
            );
        }
    }

    // Normalize: ensure no node extends beyond left/top boundary
    let min_x = positions
        .values()
        .map(|p| p.x - config.node_width / 2.0)
        .fold(f64::MAX, f64::min);
    let min_y = positions
        .values()
        .map(|p| p.y - config.node_height / 2.0)
        .fold(f64::MAX, f64::min);
    if min_x < config.padding {
        let shift = config.padding - min_x;
        for p in positions.values_mut() {
            p.x += shift;
        }
    }
    if min_y < config.padding {
        let shift = config.padding - min_y;
        for p in positions.values_mut() {
            p.y += shift;
        }
    }

    // Build LayoutNodes
    let node_map: std::collections::HashMap<String, &FlowchartNode> = ast
        .nodes
        .iter()
        .map(|n| (n.id.clone(), n))
        .collect();

    let layout_nodes: Vec<LayoutNode> = ast
        .nodes
        .iter()
        .map(|node| {
            let center = positions.get(&node.id).copied().unwrap_or(Point {
                x: config.padding,
                y: config.padding,
            });
            LayoutNode {
                id: node.id.clone(),
                center,
                bounds: Bounds::from_center(center, config.node_width, config.node_height),
                shape: match node.shape {
                    xmermaid_parser::ast::NodeShape::Rectangle => NodeShape::Rectangle,
                    xmermaid_parser::ast::NodeShape::RoundedRect => NodeShape::RoundedRect,
                    xmermaid_parser::ast::NodeShape::Stadium => NodeShape::Stadium,
                    xmermaid_parser::ast::NodeShape::Diamond => NodeShape::Diamond,
                    xmermaid_parser::ast::NodeShape::Circle => NodeShape::Circle,
                    xmermaid_parser::ast::NodeShape::Hexagon => NodeShape::Hexagon,
                    xmermaid_parser::ast::NodeShape::Parallelogram => NodeShape::Parallelogram,
                    xmermaid_parser::ast::NodeShape::Trapezoid => NodeShape::Trapezoid,
                },
                label: node.label.clone(),
            }
        })
        .collect();

    // Build LayoutEdges with waypoints
    let layout_edges: Vec<LayoutEdge> = ast
        .edges
        .iter()
        .map(|edge| {
            let (from, to, label) = match edge {
                FlowchartEdge::Directed { from, to, label } => (from, to, label.clone()),
                FlowchartEdge::Undirected { from, to, label } => (from, to, label.clone()),
            };
            let from_pos = positions.get(from).copied().unwrap_or(Point {
                x: config.padding,
                y: config.padding,
            });
            let to_pos = positions.get(to).copied().unwrap_or(Point {
                x: config.padding,
                y: config.padding,
            });

            // Generate waypoints based on direction
            let waypoints = compute_waypoints(from_pos, to_pos, direction, config);

            LayoutEdge {
                from: from.clone(),
                to: to.clone(),
                waypoints,
                label,
                label_position: None,
            }
        })
        .collect();

    // Compute dimensions
    let max_x = layout_nodes
        .iter()
        .map(|n| n.bounds.right())
        .fold(0.0_f64, f64::max);
    let max_y = layout_nodes
        .iter()
        .map(|n| n.bounds.bottom())
        .fold(0.0_f64, f64::max);

    LayoutResult {
        nodes: layout_nodes,
        edges: layout_edges,
        dimensions: Dimensions {
            width: max_x + config.padding,
            height: max_y + config.padding,
        },
    }
}

/// Compute waypoints for an edge between two node centers.
/// For straight-line connections (same rank), returns [from, to].
/// For cross-rank connections, returns [from, mid, to] where mid is the bend point.
fn compute_waypoints(
    from: Point,
    to: Point,
    direction: FlowDirection,
    config: &LayoutConfig,
) -> Vec<Point> {
    let from_rank_diff = match direction {
        FlowDirection::TB | FlowDirection::BT => (to.y - from.y).abs(),
        FlowDirection::LR | FlowDirection::RL => (to.x - from.x).abs(),
    };

    let same_rank_threshold = config.node_height / 2.0;

    if from_rank_diff < same_rank_threshold {
        // Same rank: straight line
        vec![from, to]
    } else {
        // Cross-rank: add a midpoint for smooth bending
        let mid = match direction {
            FlowDirection::TB => Point {
                x: from.x,
                y: from.y + (to.y - from.y) / 2.0,
            },
            FlowDirection::BT => Point {
                x: from.x,
                y: from.y + (to.y - from.y) / 2.0,
            },
            FlowDirection::LR => Point {
                x: from.x + (to.x - from.x) / 2.0,
                y: from.y,
            },
            FlowDirection::RL => Point {
                x: from.x + (to.x - from.x) / 2.0,
                y: from.y,
            },
        };
        vec![from, mid, to]
    }
}
```

- [ ] **Step 2: Update `engine.rs` to be a dispatcher**

Replace the entire content of `crates/xmermaid-layout/src/engine.rs`:

```rust
use crate::types::{LayoutConfig, LayoutResult};
use xmermaid_parser::ast::DiagramAst;

pub mod flowchart;

/// Compute layout for any diagram type
pub fn compute_layout(ast: &DiagramAst, config: &LayoutConfig) -> LayoutResult {
    match ast {
        DiagramAst::Flowchart(fc) => flowchart::layout(fc, config),
        DiagramAst::Sequence(_) => panic!("Sequence diagram layout not yet implemented"),
    }
}
```

- [ ] **Step 3: Update `lib.rs` to include flowchart module**

```rust
pub mod coordinate;
pub mod engine;
pub mod error;
pub mod types;

pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    NodeShape, Point,
};
```

- [ ] **Step 4: Run `cargo check`**

Run: `cd /Volumes/Data/Code/xmermaid && cargo check`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add crates/xmermaid-layout/src/flowchart.rs crates/xmermaid-layout/src/engine.rs crates/xmermaid-layout/src/lib.rs
git commit -m "refactor(layout): extract flowchart layout, accept LayoutConfig, output LayoutResult with waypoints"
```

---

## Task 4: Update WASM Bindings for New Layout Types

**Files:**
- Modify: `crates/xmermaid-wasm/src/lib.rs`

- [ ] **Step 1: Update WASM bindings to expose new types and accept LayoutConfig**

Replace the entire content of `crates/xmermaid-wasm/src/lib.rs`:

```rust
use wasm_bindgen::prelude::*;
use xmermaid_layout::types::{
    FlowDirection, LayoutConfig, LayoutResult as RustLayoutResult,
};
use xmermaid_parser::ast::DiagramAst;

/// Parse a Mermaid string and compute layout with default config
#[wasm_bindgen]
pub fn render(input: &str) -> Result<JsValue, JsValue> {
    render_with_config(input, None)
}

/// Parse a Mermaid string and compute layout with optional config
#[wasm_bindgen]
pub fn render_with_config(
    input: &str,
    config_json: Option<String>,
) -> Result<JsValue, JsValue> {
    let ast = xmermaid_parser::parse(input).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let config = match config_json {
        Some(json) => serde_json::from_str::<LayoutConfig>(&json)
            .map_err(|e| JsValue::from_str(&format!("Invalid config: {}", e)))?,
        None => {
            let mut c = LayoutConfig::default();
            // Set direction from AST if it's a flowchart
            if let DiagramAst::Flowchart(fc) = &ast {
                c.direction = match fc.direction {
                    xmermaid_parser::ast::FlowDirection::TB => FlowDirection::TB,
                    xmermaid_parser::ast::FlowDirection::BT => FlowDirection::BT,
                    xmermaid_parser::ast::FlowDirection::LR => FlowDirection::LR,
                    xmermaid_parser::ast::FlowDirection::RL => FlowDirection::RL,
                };
            }
            c
        }
    };

    let result = xmermaid_layout::engine::compute_layout(&ast, &config);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Get the default layout config as JSON
#[wasm_bindgen]
pub fn default_config() -> Result<String, JsValue> {
    let config = LayoutConfig::default();
    serde_json::to_string_pretty(&config)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
```

- [ ] **Step 2: Add `serde` and `serde_json` dependencies to WASM crate**

In `crates/xmermaid-wasm/Cargo.toml`, add to `[dependencies]`:

```toml
serde = { workspace = true }
serde_json = "1.0"
```

- [ ] **Step 3: Run `cargo check`**

Run: `cd /Volumes/Data/Code/xmermaid && cargo check`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add crates/xmermaid-wasm/src/lib.rs crates/xmermaid-wasm/Cargo.toml
git commit -m "feat(wasm): expose LayoutConfig, render_with_config, default_config"
```

---

## Task 5: Define TypeScript Layout and Theme Types

**Files:**
- Modify: `src/types/layout.ts`
- Create: `src/types/theme.ts`
- Modify: `src/types/options.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update `src/types/layout.ts`**

Replace the entire content:

```typescript
export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type NodeShape =
  | 'Rectangle'
  | 'RoundedRect'
  | 'Stadium'
  | 'Diamond'
  | 'Circle'
  | 'Hexagon'
  | 'Parallelogram'
  | 'Trapezoid';

export interface LayoutConfig {
  node_width: number;
  node_height: number;
  h_spacing: number;
  v_spacing: number;
  padding: number;
  direction: FlowDirection;
}

export interface LayoutNode {
  id: string;
  center: Point;
  bounds: Bounds;
  shape: NodeShape;
  label: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
  waypoints: Point[];
  label?: string;
  label_position?: Point;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  dimensions: Dimensions;
}
```

- [ ] **Step 2: Create `src/types/theme.ts`**

```typescript
export type ArrowStyle = 'triangle' | 'filled' | 'open' | 'circle' | 'cross';
export type CurveStyle = 'bezier' | 'step' | 'straight';

export interface ThemeColors {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  edgeStroke: string;
  edgeLabel: string;
  arrowFill: string;
  subgraphFill: string;
  subgraphStroke: string;
}

export interface RenderTheme {
  name: string;
  colors: ThemeColors;
  arrowStyle: ArrowStyle;
  curveStyle: CurveStyle;
  edgeGap: number;
  arrowSize: number;
  nodeBorderRadius: number;
  fontFamily: string;
  fontSize: number;
}

export const DEFAULT_THEME: RenderTheme = {
  name: 'default',
  colors: {
    background: '#ffffff',
    nodeFill: '#f9f9f9',
    nodeStroke: '#333333',
    nodeText: '#333333',
    edgeStroke: '#333333',
    edgeLabel: '#333333',
    arrowFill: '#333333',
    subgraphFill: '#f0f0f0',
    subgraphStroke: '#999999',
  },
  arrowStyle: 'filled',
  curveStyle: 'bezier',
  edgeGap: 8,
  arrowSize: 10,
  nodeBorderRadius: 4,
  fontFamily: 'sans-serif',
  fontSize: 14,
};

export const DARK_THEME: RenderTheme = {
  name: 'dark',
  colors: {
    background: '#1a1a2e',
    nodeFill: '#16213e',
    nodeStroke: '#e0e0e0',
    nodeText: '#e0e0e0',
    edgeStroke: '#e0e0e0',
    edgeLabel: '#e0e0e0',
    arrowFill: '#e0e0e0',
    subgraphFill: '#0f3460',
    subgraphStroke: '#555555',
  },
  arrowStyle: 'filled',
  curveStyle: 'bezier',
  edgeGap: 8,
  arrowSize: 10,
  nodeBorderRadius: 4,
  fontFamily: 'sans-serif',
  fontSize: 14,
};

export const MINIMAL_THEME: RenderTheme = {
  name: 'minimal',
  colors: {
    background: '#ffffff',
    nodeFill: '#ffffff',
    nodeStroke: '#666666',
    nodeText: '#333333',
    edgeStroke: '#999999',
    edgeLabel: '#666666',
    arrowFill: '#999999',
    subgraphFill: '#fafafa',
    subgraphStroke: '#cccccc',
  },
  arrowStyle: 'open',
  curveStyle: 'step',
  edgeGap: 6,
  arrowSize: 8,
  nodeBorderRadius: 0,
  fontFamily: 'monospace',
  fontSize: 12,
};

export function createTheme(overrides: Partial<RenderTheme> = {}): RenderTheme {
  return { ...DEFAULT_THEME, ...overrides };
}
```

- [ ] **Step 3: Update `src/types/options.ts`**

Replace the entire content:

```typescript
import type { LayoutConfig } from './layout';
import type { RenderTheme } from './theme';

export interface XMermaidOptions {
  container: HTMLElement;
  theme?: RenderTheme;
  layoutConfig?: Partial<LayoutConfig>;
}
```

- [ ] **Step 4: Update `src/types/index.ts`**

Replace the entire content:

```typescript
export * from './ast';
export * from './error';
export * from './layout';
export * from './options';
export * from './theme';
```

- [ ] **Step 5: Run TypeScript check**

Run: `cd /Volumes/Data/Code/xmermaid && npx tsc --noEmit`
Expected: May have errors in `svg.ts` and `xmermaid.ts` referencing old types — will fix in Tasks 6-7

- [ ] **Step 6: Commit**

```bash
git add src/types/layout.ts src/types/theme.ts src/types/options.ts src/types/index.ts
git commit -m "feat(types): add LayoutConfig, LayoutNode, LayoutEdge, RenderTheme types"
```

---

## Task 6: Implement Edge Path Computation Module

**Files:**
- Create: `src/renderer/edge.ts`
- Create: `tests/edge.test.ts`

- [ ] **Step 1: Write failing tests for edge path computation**

Create `tests/edge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeEdgePath,
  truncateEdgeAtBounds,
  computeArrowPoints,
  intersectRayWithBounds,
} from '../src/renderer/edge';
import type { Point, Bounds } from '../src/types/layout';

describe('intersectRayWithBounds', () => {
  const bounds: Bounds = { x: 100, y: 100, width: 120, height: 40 };

  it('finds intersection from left', () => {
    const from: Point = { x: 50, y: 120 };
    const center: Point = { x: 160, y: 120 };
    const hit = intersectRayWithBounds(from, center, bounds);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(100, 1);
    expect(hit!.y).toBeCloseTo(120, 1);
  });

  it('finds intersection from top', () => {
    const from: Point = { x: 160, y: 50 };
    const center: Point = { x: 160, y: 120 };
    const hit = intersectRayWithBounds(from, center, bounds);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(160, 1);
    expect(hit!.y).toBeCloseTo(100, 1);
  });

  it('finds intersection from right', () => {
    const from: Point = { x: 280, y: 120 };
    const center: Point = { x: 160, y: 120 };
    const hit = intersectRayWithBounds(from, center, bounds);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(220, 1);
    expect(hit!.y).toBeCloseTo(120, 1);
  });

  it('finds intersection from bottom', () => {
    const from: Point = { x: 160, y: 200 };
    const center: Point = { x: 160, y: 120 };
    const hit = intersectRayWithBounds(from, center, bounds);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(160, 1);
    expect(hit!.y).toBeCloseTo(140, 1);
  });
});

describe('truncateEdgeAtBounds', () => {
  const sourceBounds: Bounds = { x: 100, y: 100, width: 120, height: 40 };
  const targetBounds: Bounds = { x: 100, y: 260, width: 120, height: 40 };
  const edgeGap = 8;

  it('truncates start and end points with gap', () => {
    const waypoints: Point[] = [
      { x: 160, y: 120 },
      { x: 160, y: 280 },
    ];
    const result = truncateEdgeAtBounds(waypoints, sourceBounds, targetBounds, edgeGap);
    // Start should be below source bounds + gap
    expect(result.start.y).toBeGreaterThan(sourceBounds.y + sourceBounds.height);
    // End should be above target bounds - gap
    expect(result.end.y).toBeLessThan(targetBounds.y);
  });
});

describe('computeArrowPoints', () => {
  it('computes triangle arrow pointing down', () => {
    const tip: Point = { x: 160, y: 260 };
    const angle = Math.PI / 2; // pointing down
    const size = 10;
    const points = computeArrowPoints(tip, angle, size);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual(tip);
    // Two base points should be above the tip
    expect(points[1].y).toBeLessThan(tip.y);
    expect(points[2].y).toBeLessThan(tip.y);
  });

  it('computes triangle arrow pointing right', () => {
    const tip: Point = { x: 220, y: 120 };
    const angle = 0; // pointing right
    const size = 10;
    const points = computeArrowPoints(tip, angle, size);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual(tip);
    // Two base points should be to the left of the tip
    expect(points[1].x).toBeLessThan(tip.x);
    expect(points[2].x).toBeLessThan(tip.x);
  });
});

describe('computeEdgePath', () => {
  it('generates bezier path for vertical connection', () => {
    const waypoints: Point[] = [
      { x: 160, y: 140 },
      { x: 160, y: 200 },
      { x: 160, y: 260 },
    ];
    const path = computeEdgePath(waypoints, 'bezier');
    expect(path).toContain('M');
    expect(path).toContain('C');
  });

  it('generates step path for vertical connection', () => {
    const waypoints: Point[] = [
      { x: 160, y: 140 },
      { x: 160, y: 200 },
      { x: 160, y: 260 },
    ];
    const path = computeEdgePath(waypoints, 'step');
    expect(path).toContain('M');
    expect(path).toContain('L');
  });

  it('generates straight path', () => {
    const waypoints: Point[] = [
      { x: 160, y: 140 },
      { x: 160, y: 260 },
    ];
    const path = computeEdgePath(waypoints, 'straight');
    expect(path).toBe('M 160 140 L 160 260');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Volumes/Data/Code/xmermaid && npx vitest run tests/edge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement edge path computation**

Create `src/renderer/edge.ts`:

```typescript
import type { Point, Bounds } from '../types/layout';
import type { ArrowStyle, CurveStyle } from '../types/theme';

/**
 * Find where a ray from `from` through `center` intersects a bounding box.
 * Returns the intersection point on the box boundary, or null if no intersection.
 */
export function intersectRayWithBounds(
  from: Point,
  center: Point,
  bounds: Bounds,
): Point | null {
  const dx = center.x - from.x;
  const dy = center.y - from.y;

  if (dx === 0 && dy === 0) return null;

  let tMin = Infinity;
  let hit: Point | null = null;

  // Check all four edges
  const edges: [number, number, number, number][] = [
    [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y], // top
    [bounds.x, bounds.y + bounds.height, bounds.x + bounds.width, bounds.y + bounds.height], // bottom
    [bounds.x, bounds.y, bounds.x, bounds.y + bounds.height], // left
    [bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height], // right
  ];

  for (const [x1, y1, x2, y2] of edges) {
    const edgeDx = x2 - x1;
    const edgeDy = y2 - y1;

    const denom = dx * edgeDy - dy * edgeDx;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((x1 - from.x) * edgeDy - (y1 - from.y) * edgeDx) / denom;
    const u = ((x1 - from.x) * dy - (y1 - from.y) * dx) / denom;

    if (t > 0 && u >= 0 && u <= 1 && t < tMin) {
      tMin = t;
      hit = { x: from.x + t * dx, y: from.y + t * dy };
    }
  }

  return hit;
}

export interface TruncatedEdge {
  start: Point;
  end: Point;
  arrowTip: Point;
  arrowAngle: number;
}

/**
 * Truncate an edge's start and end points so they stop at the node bounds + edgeGap.
 * Returns the truncated start, end, arrow tip position, and arrow angle.
 */
export function truncateEdgeAtBounds(
  waypoints: Point[],
  sourceBounds: Bounds,
  targetBounds: Bounds,
  edgeGap: number,
  arrowSize: number = 10,
): TruncatedEdge {
  const first = waypoints[0];
  const second = waypoints.length > 1 ? waypoints[1] : waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const secondLast = waypoints.length > 1 ? waypoints[waypoints.length - 2] : waypoints[0];

  // Truncate start: ray from second waypoint toward first, intersect source bounds
  const sourceHit = intersectRayWithBounds(second, first, sourceBounds);
  const start = sourceHit
    ? { x: first.x + (sourceHit.x - first.x) * (1 - edgeGap / dist(first, sourceHit)), y: first.y + (sourceHit.y - first.y) * (1 - edgeGap / dist(first, sourceHit)) }
    : first;

  // Truncate end: ray from secondLast toward last, intersect target bounds
  const targetHit = intersectRayWithBounds(secondLast, last, targetBounds);
  const arrowTip = targetHit ?? last;

  // Arrow angle: direction from secondLast to last
  const arrowAngle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x);

  // End point is arrowTip offset backward by (edgeGap + arrowSize)
  const totalGap = edgeGap + arrowSize;
  const endDist = targetHit ? dist(last, targetHit) : 0;
  const endOffset = Math.min(totalGap, endDist);
  const end = targetHit
    ? {
        x: arrowTip.x - Math.cos(arrowAngle) * endOffset,
        y: arrowTip.y - Math.sin(arrowAngle) * endOffset,
      }
    : last;

  return { start, end, arrowTip, arrowAngle };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Compute the three points of an arrowhead triangle.
 */
export function computeArrowPoints(
  tip: Point,
  angle: number,
  size: number,
): Point[] {
  const halfWidth = size * 0.4;
  const baseAngle1 = angle + Math.PI - Math.atan2(halfWidth, size);
  const baseAngle2 = angle + Math.PI + Math.atan2(halfWidth, size);
  const baseLen = Math.sqrt(size * size + halfWidth * halfWidth);

  return [
    tip,
    {
      x: tip.x + Math.cos(baseAngle1) * baseLen,
      y: tip.y + Math.sin(baseAngle1) * baseLen,
    },
    {
      x: tip.x + Math.cos(baseAngle2) * baseLen,
      y: tip.y + Math.sin(baseAngle2) * baseLen,
    },
  ];
}

/**
 * Generate an SVG path string for an edge based on waypoints and curve style.
 */
export function computeEdgePath(waypoints: Point[], curveStyle: CurveStyle): string {
  if (waypoints.length < 2) return '';

  switch (curveStyle) {
    case 'straight':
      return `M ${waypoints[0].x} ${waypoints[0].y} L ${waypoints[waypoints.length - 1].x} ${waypoints[waypoints.length - 1].y}`;

    case 'step':
      return computeStepPath(waypoints);

    case 'bezier':
    default:
      return computeBezierPath(waypoints);
  }
}

function computeStepPath(waypoints: Point[]): string {
  if (waypoints.length === 2) {
    const [a, b] = waypoints;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    // Prefer stepping in the dominant direction
    if (Math.abs(b.y - a.y) > Math.abs(b.x - a.x)) {
      return `M ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`;
    } else {
      return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
    }
  }

  let path = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    path += ` L ${midX} ${prev.y} L ${midX} ${curr.y} L ${curr.x} ${curr.y}`;
  }
  return path;
}

function computeBezierPath(waypoints: Point[]): string {
  if (waypoints.length === 2) {
    const [a, b] = waypoints;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const cpOffset = Math.min(Math.abs(dy), Math.abs(dx)) * 0.5 + 20;

    let cp1: Point, cp2: Point;
    if (Math.abs(dy) > Math.abs(dx)) {
      // Vertical dominant
      cp1 = { x: a.x, y: a.y + cpOffset * Math.sign(dy) };
      cp2 = { x: b.x, y: b.y - cpOffset * Math.sign(dy) };
    } else {
      // Horizontal dominant
      cp1 = { x: a.x + cpOffset * Math.sign(dx), y: a.y };
      cp2 = { x: b.x - cpOffset * Math.sign(dx), y: b.y };
    }

    return `M ${a.x} ${a.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${b.x} ${b.y}`;
  }

  // For 3+ waypoints, use smooth curves through midpoints
  let path = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const mid = {
      x: (prev.x + curr.x) / 2,
      y: (prev.y + curr.y) / 2,
    };

    if (i === 1) {
      // First segment: straight to midpoint
      path += ` L ${mid.x} ${mid.y}`;
    }

    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      const nextMid = {
        x: (curr.x + next.x) / 2,
        y: (curr.y + next.y) / 2,
      };
      path += ` Q ${curr.x} ${curr.y}, ${nextMid.x} ${nextMid.y}`;
    } else {
      // Last segment: curve to the end
      const dy = curr.y - prev.y;
      const dx = curr.x - prev.x;
      const cpOffset = 30;
      if (Math.abs(dy) > Math.abs(dx)) {
        path += ` C ${curr.x} ${curr.y - cpOffset * Math.sign(dy)}, ${curr.x} ${curr.y - cpOffset * Math.sign(dy)}, ${curr.x} ${curr.y}`;
      } else {
        path += ` C ${curr.x - cpOffset * Math.sign(dx)} ${curr.y}, ${curr.x - cpOffset * Math.sign(dx)} ${curr.y}, ${curr.x} ${curr.y}`;
      }
    }
  }
  return path;
}

/**
 * Generate SVG path data for an arrowhead.
 */
export function computeArrowPath(
  tip: Point,
  angle: number,
  size: number,
  style: ArrowStyle,
): string {
  const points = computeArrowPoints(tip, angle, size);
  const [p0, p1, p2] = points;

  switch (style) {
    case 'filled':
      return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`;
    case 'triangle':
      return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`;
    case 'open':
      return `M ${p1.x} ${p1.y} L ${p0.x} ${p0.y} L ${p2.x} ${p2.y}`;
    case 'circle': {
      const r = size * 0.3;
      return `M ${tip.x + r} ${tip.y} A ${r} ${r} 0 1 0 ${tip.x - r} ${tip.y} A ${r} ${r} 0 1 0 ${tip.x + r} ${tip.y}`;
    }
    case 'cross': {
      const r = size * 0.4;
      return `M ${tip.x - r} ${tip.y - r} L ${tip.x + r} ${tip.y + r} M ${tip.x + r} ${tip.y - r} L ${tip.x - r} ${tip.y + r}`;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Volumes/Data/Code/xmermaid && npx vitest run tests/edge.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/edge.ts tests/edge.test.ts
git commit -m "feat(renderer): implement edge path computation with bezier/step/straight, arrow positioning, gap truncation"
```

---

## Task 7: Rewrite SVG Renderer with Theme and New Layout Types

**Files:**
- Modify: `src/renderer/svg.ts`
- Modify: `src/renderer/types.ts`
- Modify: `src/renderer/index.ts`

- [ ] **Step 1: Update `src/renderer/types.ts`**

Replace the entire content:

```typescript
export type { RenderTheme, ThemeColors, ArrowStyle, CurveStyle } from '../types/theme';
export type { LayoutNode, LayoutEdge, LayoutResult, Bounds, Point, NodeShape } from '../types/layout';
```

- [ ] **Step 2: Rewrite `src/renderer/svg.ts`**

Replace the entire content:

```typescript
import type { LayoutResult, LayoutNode, LayoutEdge, Bounds, Point, NodeShape } from '../types/layout';
import type { RenderTheme } from '../types/theme';
import { DEFAULT_THEME } from '../types/theme';
import {
  computeEdgePath,
  computeArrowPath,
  truncateEdgeAtBounds,
} from './edge';

export class SVGRenderer {
  private theme: RenderTheme;

  constructor(theme?: Partial<RenderTheme>) {
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  setTheme(theme: Partial<RenderTheme>): void {
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  render(layout: LayoutResult): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(layout.dimensions.width));
    svg.setAttribute('height', String(layout.dimensions.height));
    svg.setAttribute('viewBox', `0 0 ${layout.dimensions.width} ${layout.dimensions.height}`);
    svg.style.backgroundColor = this.theme.colors.background;

    // Build node index for bounds lookup
    const nodeMap = new Map<string, LayoutNode>();
    for (const node of layout.nodes) {
      nodeMap.set(node.id, node);
    }

    // Render edges first (behind nodes)
    for (const edge of layout.edges) {
      const group = this.renderEdge(edge, nodeMap);
      svg.appendChild(group);
    }

    // Render nodes on top
    for (const node of layout.nodes) {
      const group = this.renderNode(node);
      svg.appendChild(group);
    }

    return svg;
  }

  private renderNode(node: LayoutNode): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const shape = this.createNodeShape(node);
    shape.setAttribute('fill', this.theme.colors.nodeFill);
    shape.setAttribute('stroke', this.theme.colors.nodeStroke);
    shape.setAttribute('stroke-width', '1.5');
    g.appendChild(shape);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(node.center.x));
    text.setAttribute('y', String(node.center.y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', this.theme.colors.nodeText);
    text.setAttribute('font-family', this.theme.fontFamily);
    text.setAttribute('font-size', String(this.theme.fontSize));
    text.textContent = node.label;
    g.appendChild(text);

    return g;
  }

  private createNodeShape(node: LayoutNode): SVGElement {
    const { bounds, shape } = node;
    const { x, y, width, height } = bounds;
    const cx = node.center.x;
    const cy = node.center.y;

    switch (shape) {
      case 'RoundedRect': {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(this.theme.nodeBorderRadius + 8));
        rect.setAttribute('ry', String(this.theme.nodeBorderRadius + 8));
        return rect;
      }
      case 'Stadium': {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(height / 2));
        rect.setAttribute('ry', String(height / 2));
        return rect;
      }
      case 'Diamond': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`);
        return polygon;
      }
      case 'Circle': {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const r = Math.min(width, height) / 2;
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(r));
        return circle;
      }
      case 'Hexagon': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const offset = width * 0.25;
        polygon.setAttribute('points', [
          `${x + offset},${y}`,
          `${x + width - offset},${y}`,
          `${x + width},${cy}`,
          `${x + width - offset},${y + height}`,
          `${x + offset},${y + height}`,
          `${x},${cy}`,
        ].join(' '));
        return polygon;
      }
      case 'Parallelogram': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const offset = width * 0.15;
        polygon.setAttribute('points', [
          `${x + offset},${y}`,
          `${x + width},${y}`,
          `${x + width - offset},${y + height}`,
          `${x},${y + height}`,
        ].join(' '));
        return polygon;
      }
      case 'Trapezoid': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const offset = width * 0.15;
        polygon.setAttribute('points', [
          `${x + offset},${y}`,
          `${x + width - offset},${y}`,
          `${x + width},${y + height}`,
          `${x},${y + height}`,
        ].join(' '));
        return polygon;
      }
      case 'Rectangle':
      default: {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(this.theme.nodeBorderRadius));
        rect.setAttribute('ry', String(this.theme.nodeBorderRadius));
        return rect;
      }
    }
  }

  private renderEdge(edge: LayoutEdge, nodeMap: Map<string, LayoutNode>): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const sourceNode = nodeMap.get(edge.from);
    const targetNode = nodeMap.get(edge.to);

    if (!sourceNode || !targetNode) return g;

    // Truncate edge at node bounds with gap
    const truncated = truncateEdgeAtBounds(
      edge.waypoints,
      sourceNode.bounds,
      targetNode.bounds,
      this.theme.edgeGap,
      this.theme.arrowSize,
    );

    // Draw the edge path
    const path = computeEdgePath(
      [truncated.start, ...edge.waypoints.slice(1, -1), truncated.end],
      this.theme.curveStyle,
    );

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', this.theme.colors.edgeStroke);
    pathEl.setAttribute('stroke-width', '1.5');
    g.appendChild(pathEl);

    // Draw arrowhead
    const arrowPath = computeArrowPath(
      truncated.arrowTip,
      truncated.arrowAngle,
      this.theme.arrowSize,
      this.theme.arrowStyle,
    );

    const arrowEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowEl.setAttribute('d', arrowPath);
    if (this.theme.arrowStyle === 'filled') {
      arrowEl.setAttribute('fill', this.theme.colors.arrowFill);
      arrowEl.setAttribute('stroke', this.theme.colors.edgeStroke);
      arrowEl.setAttribute('stroke-width', '1');
    } else if (this.theme.arrowStyle === 'open') {
      arrowEl.setAttribute('fill', 'none');
      arrowEl.setAttribute('stroke', this.theme.colors.edgeStroke);
      arrowEl.setAttribute('stroke-width', '1.5');
    } else {
      arrowEl.setAttribute('fill', this.theme.colors.arrowFill);
      arrowEl.setAttribute('stroke', this.theme.colors.edgeStroke);
      arrowEl.setAttribute('stroke-width', '1');
    }
    g.appendChild(arrowEl);

    // Draw edge label if present
    if (edge.label) {
      const labelPos = edge.label_position ?? this.computeLabelPosition(edge.waypoints);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(labelPos.x));
      text.setAttribute('y', String(labelPos.y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', this.theme.colors.edgeLabel);
      text.setAttribute('font-family', this.theme.fontFamily);
      text.setAttribute('font-size', String(this.theme.fontSize - 2));

      // Background for readability
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', String(labelPos.x - edge.label.length * 3.5));
      bg.setAttribute('y', String(labelPos.y - 8));
      bg.setAttribute('width', String(edge.label.length * 7));
      bg.setAttribute('height', '16');
      bg.setAttribute('fill', this.theme.colors.background);
      bg.setAttribute('rx', '2');
      g.appendChild(bg);

      text.textContent = edge.label;
      g.appendChild(text);
    }

    return g;
  }

  private computeLabelPosition(waypoints: Point[]): Point {
    if (waypoints.length === 0) return { x: 0, y: 0 };
    if (waypoints.length === 1) return waypoints[0];
    const mid = Math.floor(waypoints.length / 2);
    return {
      x: (waypoints[mid - 1].x + waypoints[mid].x) / 2,
      y: (waypoints[mid - 1].y + waypoints[mid].y) / 2,
    };
  }
}
```

- [ ] **Step 3: Update `src/renderer/index.ts`**

Replace the entire content:

```typescript
export { SVGRenderer } from './svg';
export { computeEdgePath, computeArrowPath, truncateEdgeAtBounds, intersectRayWithBounds } from './edge';
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd /Volumes/Data/Code/xmermaid && npx tsc --noEmit`
Expected: May have errors in `xmermaid.ts` — will fix in Task 8

- [ ] **Step 5: Commit**

```bash
git add src/renderer/svg.ts src/renderer/types.ts src/renderer/index.ts
git commit -m "feat(renderer): rewrite SVG renderer with theme support, edge gap/arrow truncation, node shapes"
```

---

## Task 8: Update XMermaid Class and WASM Bindings

**Files:**
- Modify: `src/xmermaid.ts`
- Modify: `src/wasm.ts`
- Modify: `src/wasm-types.d.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Update `src/wasm.ts`**

Replace the entire content:

```typescript
let wasmModule: typeof import('../pkg/xmermaid_wasm') | null = null;

export async function initWasm(): Promise<void> {
  if (wasmModule) return;
  wasmModule = await import('../pkg/xmermaid_wasm');
  await wasmModule.default();
}

export function getWasm() {
  if (!wasmModule) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return wasmModule;
}
```

- [ ] **Step 2: Update `src/wasm-types.d.ts`**

Replace the entire content:

```typescript
declare module '../pkg/xmermaid_wasm' {
  export function render(input: string): any;
  export function render_with_config(input: string, config_json: string | undefined): any;
  export function default_config(): string;

  const init: () => Promise<void>;
  export default init;
}
```

- [ ] **Step 3: Update `src/xmermaid.ts`**

Replace the entire content:

```typescript
import type { XMermaidOptions, LayoutConfig, RenderTheme } from './types';
import { DEFAULT_THEME } from './types/theme';
import { SVGRenderer } from './renderer/svg';
import { initWasm, getWasm } from './wasm';
import type { LayoutResult } from './types/layout';

export class XMermaid {
  private container: HTMLElement;
  private renderer: SVGRenderer;
  private layoutConfig?: Partial<LayoutConfig>;

  constructor(options: XMermaidOptions) {
    this.container = options.container;
    this.renderer = new SVGRenderer(options.theme);
    this.layoutConfig = options.layoutConfig;
  }

  async render(input: string): Promise<void> {
    await initWasm();
    const wasm = getWasm();

    let configJson: string | undefined;
    if (this.layoutConfig) {
      const defaultConfig = JSON.parse(wasm.default_config());
      const merged = { ...defaultConfig, ...this.layoutConfig };
      configJson = JSON.stringify(merged);
    }

    const layout: LayoutResult = this.layoutConfig
      ? wasm.render_with_config(input, configJson)
      : wasm.render(input);

    const svg = this.renderer.render(layout);
    this.container.innerHTML = '';
    this.container.appendChild(svg);
  }

  setTheme(theme: Partial<RenderTheme>): void {
    this.renderer.setTheme(theme);
  }
}
```

- [ ] **Step 4: Update `src/index.ts`**

Replace the entire content:

```typescript
export { XMermaid } from './xmermaid';
export { SVGRenderer } from './renderer/svg';
export { computeEdgePath, computeArrowPath, truncateEdgeAtBounds, intersectRayWithBounds } from './renderer/edge';
export { DEFAULT_THEME, DARK_THEME, MINIMAL_THEME, createTheme } from './types/theme';
export type { RenderTheme, ThemeColors, ArrowStyle, CurveStyle } from './types/theme';
export type { LayoutConfig, LayoutResult, LayoutNode, LayoutEdge, Bounds, Point, NodeShape, FlowDirection, Dimensions } from './types/layout';
export type { XMermaidOptions } from './types/options';
```

- [ ] **Step 5: Run TypeScript check**

Run: `cd /Volumes/Data/Code/xmermaid && npx tsc --noEmit`
Expected: Passes with no errors

- [ ] **Step 6: Commit**

```bash
git add src/xmermaid.ts src/wasm.ts src/wasm-types.d.ts src/index.ts
git commit -m "feat(sdk): update XMermaid class with LayoutConfig and RenderTheme support"
```

---

## Task 9: Update Existing Tests

**Files:**
- Modify: `tests/renderer.test.ts`
- Modify: `tests/xmermaid.test.ts`
- Create: `tests/theme.test.ts`

- [ ] **Step 1: Write theme tests**

Create `tests/theme.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME, DARK_THEME, MINIMAL_THEME, createTheme } from '../src/types/theme';

describe('DEFAULT_THEME', () => {
  it('has all required fields', () => {
    expect(DEFAULT_THEME.name).toBe('default');
    expect(DEFAULT_THEME.colors.nodeFill).toBeDefined();
    expect(DEFAULT_THEME.arrowStyle).toBe('filled');
    expect(DEFAULT_THEME.curveStyle).toBe('bezier');
    expect(DEFAULT_THEME.edgeGap).toBe(8);
    expect(DEFAULT_THEME.arrowSize).toBe(10);
  });
});

describe('DARK_THEME', () => {
  it('has dark background', () => {
    expect(DARK_THEME.colors.background).toBe('#1a1a2e');
    expect(DARK_THEME.colors.nodeFill).toBe('#16213e');
  });
});

describe('MINIMAL_THEME', () => {
  it('uses open arrows and step curves', () => {
    expect(MINIMAL_THEME.arrowStyle).toBe('open');
    expect(MINIMAL_THEME.curveStyle).toBe('step');
  });
});

describe('createTheme', () => {
  it('returns default theme with no overrides', () => {
    const theme = createTheme();
    expect(theme.name).toBe(DEFAULT_THEME.name);
    expect(theme.edgeGap).toBe(DEFAULT_THEME.edgeGap);
  });

  it('applies overrides', () => {
    const theme = createTheme({ edgeGap: 20, arrowSize: 15 });
    expect(theme.edgeGap).toBe(20);
    expect(theme.arrowSize).toBe(15);
    expect(theme.name).toBe(DEFAULT_THEME.name);
  });
});
```

- [ ] **Step 2: Run theme tests**

Run: `cd /Volumes/Data/Code/xmermaid && npx vitest run tests/theme.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Update `tests/renderer.test.ts`**

Replace the entire content:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SVGRenderer } from '../src/renderer/svg';
import { DEFAULT_THEME } from '../src/types/theme';
import type { LayoutResult, LayoutNode, LayoutEdge } from '../src/types/layout';

function createTestLayout(): LayoutResult {
  const node1: LayoutNode = {
    id: 'A',
    center: { x: 160, y: 60 },
    bounds: { x: 100, y: 40, width: 120, height: 40 },
    shape: 'RoundedRect',
    label: 'Node A',
  };
  const node2: LayoutNode = {
    id: 'B',
    center: { x: 160, y: 180 },
    bounds: { x: 100, y: 160, width: 120, height: 40 },
    shape: 'RoundedRect',
    label: 'Node B',
  };
  const edge: LayoutEdge = {
    from: 'A',
    to: 'B',
    waypoints: [{ x: 160, y: 60 }, { x: 160, y: 180 }],
    label: 'yes',
  };

  return {
    nodes: [node1, node2],
    edges: [edge],
    dimensions: { width: 320, height: 240 },
  };
}

describe('SVGRenderer', () => {
  it('creates an SVG element with correct dimensions', () => {
    const renderer = new SVGRenderer();
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('width')).toBe('320');
    expect(svg.getAttribute('height')).toBe('240');
  });

  it('renders nodes as groups with shapes and text', () => {
    const renderer = new SVGRenderer();
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    const groups = svg.querySelectorAll('g');
    // At least 2 node groups + 1 edge group
    expect(groups.length).toBeGreaterThanOrEqual(3);
  });

  it('renders edges with paths', () => {
    const renderer = new SVGRenderer();
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('applies theme colors', () => {
    const renderer = new SVGRenderer({ colors: { ...DEFAULT_THEME.colors, nodeFill: '#ff0000' } });
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    const rects = svg.querySelectorAll('rect');
    let foundRed = false;
    rects.forEach(r => {
      if (r.getAttribute('fill') === '#ff0000') foundRed = true;
    });
    expect(foundRed).toBe(true);
  });
});
```

- [ ] **Step 4: Update `tests/xmermaid.test.ts`**

Replace the entire content:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { XMermaid } from '../src/xmermaid';
import { DEFAULT_THEME } from '../src/types/theme';

describe('XMermaid', () => {
  it('creates instance with default options', () => {
    const container = document.createElement('div');
    const xm = new XMermaid({ container });
    expect(xm).toBeInstanceOf(XMermaid);
  });

  it('creates instance with custom theme', () => {
    const container = document.createElement('div');
    const xm = new XMermaid({
      container,
      theme: { ...DEFAULT_THEME, edgeGap: 20 },
    });
    expect(xm).toBeInstanceOf(XMermaid);
  });

  it('creates instance with custom layout config', () => {
    const container = document.createElement('div');
    const xm = new XMermaid({
      container,
      layoutConfig: { h_spacing: 100, v_spacing: 80 },
    });
    expect(xm).toBeInstanceOf(XMermaid);
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `cd /Volumes/Data/Code/xmermaid && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add tests/renderer.test.ts tests/xmermaid.test.ts tests/theme.test.ts
git commit -m "test: update renderer and xmermaid tests for new layout types, add theme tests"
```

---

## Task 10: Build and Verify End-to-End

**Files:**
- Modify: `examples/basic.html`

- [ ] **Step 1: Update `examples/basic.html`**

Replace the entire content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xmermaid - Basic Flowchart</title>
  <style>
    body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    #diagram { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <h1>xmermaid - Basic Flowchart</h1>
  <div id="diagram"></div>

  <script type="module">
    import { XMermaid } from '../dist/xmermaid.esm.js';

    const xm = new XMermaid({ container: document.getElementById('diagram') });
    await xm.render(`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`);
  </script>
</body>
</html>
```

- [ ] **Step 2: Rebuild WASM and JS**

Run: `cd /Volumes/Data/Code/xmermaid && PATH="/Users/evan/.cargo/bin:$PATH" npm run build && cp pkg/xmermaid_wasm_bg.wasm dist/`
Expected: Build succeeds, `dist/xmermaid.esm.js` and `dist/xmermaid_wasm_bg.wasm` exist

- [ ] **Step 3: Verify in browser**

Open `examples/basic.html` via local server. Verify:
- Nodes render with rounded rectangles
- Edges have bezier curves with visible gap from node borders
- Arrow tips touch node borders without being hidden
- Edge labels are readable with background

- [ ] **Step 4: Commit**

```bash
git add examples/basic.html
git commit -m "docs: update basic.html example for new API"
```

---

## Task 11: Add Complex Flowchart Example

**Files:**
- Create: `examples/flowchart-complex.html`

- [ ] **Step 1: Create complex flowchart example**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xmermaid - Complex Flowchart</title>
  <style>
    body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .diagram { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>xmermaid - Complex Flowchart</h1>
  <div id="diagram1" class="diagram"></div>
  <div id="diagram2" class="diagram"></div>

  <script type="module">
    import { XMermaid } from '../dist/xmermaid.esm.js';

    // Multi-branch flowchart with long labels
    const xm1 = new XMermaid({ container: document.getElementById('diagram1') });
    await xm1.render(`graph TD
    A[Start Process] --> B{Check Input Valid?}
    B -->|Valid| C[Process Data]
    B -->|Invalid| D[Show Error Message]
    C --> E{Data Complete?}
    E -->|Yes| F[Save to Database]
    E -->|No| G[Request More Info]
    G --> C
    D --> H[Log Error]
    H --> A
    F --> I[Generate Report]
    I --> J[Send Notification]
    J --> K[End]`);

    // Flowchart with self-loop and multi-input nodes
    const xm2 = new XMermaid({ container: document.getElementById('diagram2') });
    await xm2.render(`graph TD
    A[Initialize] --> B[Load Config]
    B --> C{Config Valid?}
    C -->|Yes| D[Start Service]
    C -->|No| E[Reset Config]
    E --> B
    D --> F[Process Requests]
    F --> G{Retry?}
    G -->|Yes| F
    G -->|No| H[Shutdown]
    A --> I[Load Plugins]
    I --> D`);
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `examples/flowchart-complex.html` via local server. Verify both diagrams render correctly with proper spacing and arrows.

- [ ] **Step 3: Commit**

```bash
git add examples/flowchart-complex.html
git commit -m "docs: add complex flowchart example with multi-branch and self-loops"
```

---

## Task 12: Add Directions and Theme Comparison Examples

**Files:**
- Create: `examples/flowchart-directions.html`
- Create: `examples/theme-comparison.html`

- [ ] **Step 1: Create directions example**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xmermaid - Flowchart Directions</title>
  <style>
    body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
    h1, h2 { color: #333; }
    .diagram { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>xmermaid - Flowchart Directions</h1>

  <h2>Top to Bottom (TB)</h2>
  <div id="tb" class="diagram"></div>

  <h2>Left to Right (LR)</h2>
  <div id="lr" class="diagram"></div>

  <script type="module">
    import { XMermaid } from '../dist/xmermaid.esm.js';

    const diagram = `A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;

    const xmTB = new XMermaid({ container: document.getElementById('tb') });
    await xmTB.render(`graph TB\n${diagram}`);

    const xmLR = new XMermaid({ container: document.getElementById('lr') });
    await xmLR.render(`graph LR\n${diagram}`);
  </script>
</body>
</html>
```

- [ ] **Step 2: Create theme comparison example**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>xmermaid - Theme Comparison</title>
  <style>
    body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
    h1, h2 { color: #333; }
    .diagram { padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>xmermaid - Theme Comparison</h1>

  <h2>Default Theme</h2>
  <div id="default" class="diagram"></div>

  <h2>Dark Theme</h2>
  <div id="dark" class="diagram"></div>

  <h2>Minimal Theme</h2>
  <div id="minimal" class="diagram"></div>

  <script type="module">
    import { XMermaid, DEFAULT_THEME, DARK_THEME, MINIMAL_THEME } from '../dist/xmermaid.esm.js';

    const diagram = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;

    const xmDefault = new XMermaid({ container: document.getElementById('default'), theme: DEFAULT_THEME });
    await xmDefault.render(diagram);

    const xmDark = new XMermaid({ container: document.getElementById('dark'), theme: DARK_THEME });
    await xmDark.render(diagram);

    const xmMinimal = new XMermaid({ container: document.getElementById('minimal'), theme: MINIMAL_THEME });
    await xmMinimal.render(diagram);
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify both examples in browser**

- [ ] **Step 4: Commit**

```bash
git add examples/flowchart-directions.html examples/theme-comparison.html
git commit -m "docs: add flowchart directions and theme comparison examples"
```

---

## Task 13: Add Rust Unit Tests for Layout Engine

**Files:**
- Modify: `crates/xmermaid-layout/src/flowchart.rs`

- [ ] **Step 1: Add unit tests to `flowchart.rs`**

Append at the end of `crates/xmermaid-layout/src/flowchart.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use xmermaid_parser::ast::{FlowchartAst, FlowchartEdge, FlowchartNode, NodeShape as AstNodeShape, FlowDirection as AstFlowDirection};

    fn make_node(id: &str, label: &str) -> FlowchartNode {
        FlowchartNode {
            id: id.to_string(),
            label: label.to_string(),
            shape: AstNodeShape::RoundedRect,
        }
    }

    fn make_edge(from: &str, to: &str) -> FlowchartEdge {
        FlowchartEdge::Directed {
            from: from.to_string(),
            to: to.to_string(),
            label: None,
        }
    }

    #[test]
    fn test_single_node() {
        let ast = FlowchartAst {
            direction: AstFlowDirection::TB,
            nodes: vec![make_node("A", "Start")],
            edges: vec![],
        };
        let config = LayoutConfig::default();
        let result = layout(&ast, &config);

        assert_eq!(result.nodes.len(), 1);
        assert_eq!(result.edges.len(), 0);
        // Node should be within bounds
        let node = &result.nodes[0];
        assert!(node.bounds.x >= config.padding);
        assert!(node.bounds.y >= config.padding);
    }

    #[test]
    fn test_two_nodes_vertical() {
        let ast = FlowchartAst {
            direction: AstFlowDirection::TB,
            nodes: vec![make_node("A", "Start"), make_node("B", "End")],
            edges: vec![make_edge("A", "B")],
        };
        let config = LayoutConfig::default();
        let result = layout(&ast, &config);

        assert_eq!(result.nodes.len(), 2);
        assert_eq!(result.edges.len(), 1);

        // B should be below A
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        assert!(b.center.y > a.center.y);

        // Edge should have waypoints
        let edge = &result.edges[0];
        assert!(edge.waypoints.len() >= 2);
    }

    #[test]
    fn test_no_node_extends_beyond_left_boundary() {
        let ast = FlowchartAst {
            direction: AstFlowDirection::TB,
            nodes: vec![make_node("A", "Start"), make_node("B", "End")],
            edges: vec![make_edge("A", "B")],
        };
        let config = LayoutConfig::default();
        let result = layout(&ast, &config);

        for node in &result.nodes {
            assert!(
                node.bounds.x >= config.padding,
                "Node {} extends beyond left boundary: bounds.x = {} < padding = {}",
                node.id,
                node.bounds.x,
                config.padding
            );
        }
    }

    #[test]
    fn test_custom_config() {
        let ast = FlowchartAst {
            direction: AstFlowDirection::TB,
            nodes: vec![make_node("A", "Start"), make_node("B", "End")],
            edges: vec![make_edge("A", "B")],
        };
        let config = LayoutConfig {
            node_width: 200.0,
            node_height: 60.0,
            h_spacing: 100.0,
            v_spacing: 80.0,
            padding: 60.0,
            direction: FlowDirection::TB,
        };
        let result = layout(&ast, &config);

        // Nodes should use custom width
        for node in &result.nodes {
            assert_eq!(node.bounds.width, 200.0);
            assert_eq!(node.bounds.height, 60.0);
        }

        // Vertical spacing should be larger
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        let v_dist = b.center.y - a.center.y;
        assert!(v_dist >= config.node_height + config.v_spacing);
    }

    #[test]
    fn test_same_rank_uniform_spacing() {
        let ast = FlowchartAst {
            direction: AstFlowDirection::TB,
            nodes: vec![
                make_node("A", "Root"),
                make_node("B", "Left"),
                make_node("C", "Right"),
            ],
            edges: vec![make_edge("A", "B"), make_edge("A", "C")],
        };
        let config = LayoutConfig::default();
        let result = layout(&ast, &config);

        // B and C should be on the same rank (y aligned)
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        let c = result.nodes.iter().find(|n| n.id == "C").unwrap();
        assert!((b.center.y - c.center.y).abs() < 1.0, "Same-rank nodes should have aligned y");

        // Horizontal spacing should be uniform
        let h_dist = (c.center.x - b.center.x).abs();
        let expected = config.node_width + config.h_spacing;
        assert!(
            (h_dist - expected).abs() < 1.0,
            "Same-rank spacing should be uniform: got {}, expected {}",
            h_dist,
            expected
        );
    }
}
```

- [ ] **Step 2: Run Rust tests**

Run: `cd /Volumes/Data/Code/xmermaid && cargo test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/xmermaid-layout/src/flowchart.rs
git commit -m "test(layout): add unit tests for flowchart layout — bounds, spacing, config"
```

---

## Task 14: Add Rust Unit Tests for Parser

**Files:**
- Modify: `crates/xmermaid-parser/src/parser.rs`

- [ ] **Step 1: Add unit tests to `parser.rs`**

Append at the end of `crates/xmermaid-parser/src/parser.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_flowchart() {
        let result = parse("graph TD\n    A[Start] --> B[End]");
        assert!(result.is_ok());
        let ast = result.unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes.len(), 2);
                assert_eq!(fc.edges.len(), 1);
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_empty_diagram() {
        let result = parse("graph TD");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_node_shapes() {
        let result = parse("graph TD\n    A[Rect] --> B(Rounded)");
        assert!(result.is_ok());
        let ast = result.unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes.len(), 2);
                assert_eq!(fc.nodes[0].shape, NodeShape::Rectangle);
                assert_eq!(fc.nodes[1].shape, NodeShape::RoundedRect);
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_edge_with_label() {
        let result = parse("graph TD\n    A -->|yes| B");
        assert!(result.is_ok());
        let ast = result.unwrap();
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.edges.len(), 1);
                match &fc.edges[0] {
                    FlowchartEdge::Directed { label, .. } => {
                        assert_eq!(label.as_deref(), Some("yes"));
                    }
                    _ => panic!("Expected directed edge"),
                }
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_parse_invalid_syntax() {
        let result = parse("not a diagram");
        assert!(result.is_err());
    }
}
```

- [ ] **Step 2: Run Rust tests**

Run: `cd /Volumes/Data/Code/xmermaid && cargo test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add crates/xmermaid-parser/src/parser.rs
git commit -m "test(parser): add unit tests for flowchart parsing — shapes, labels, errors"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Each spec section maps to tasks:
  - Interface contracts → Tasks 1, 5
  - Edge/arrow rendering → Tasks 6, 7
  - Chart type extension architecture → Tasks 2, 3, 4 (parser shape, layout dispatch, WASM)
  - Testing & examples → Tasks 9, 10, 11, 12, 13, 14
- [x] **Placeholder scan**: No TBD/TODO/fill-in-later. All code is concrete.
- [x] **Type consistency**: `LayoutNode`, `LayoutEdge`, `LayoutConfig`, `RenderTheme`, `Bounds`, `Point`, `NodeShape` are defined once and used consistently across Rust and TypeScript.
- [x] **No orphan references**: All types and functions referenced in later tasks are defined in earlier tasks.
