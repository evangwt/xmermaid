# xmermaid Architecture Redesign & Extension

Date: 2026-04-27

## Problem Statement

1. **Tight coupling**: Layout engine hardcodes rendering constants (NODE_WIDTH, NODE_HEIGHT, etc.); SVG renderer computes edge start/end points, mixing layout logic with drawing logic.
2. **Edge/arrow rendering issues**: Arrows are partially hidden by node fills; edges overlap node borders; arrow direction is unclear; same-level nodes have inconsistent spacing.
3. **Single chart type**: Only flowchart is supported; adding new types requires scattered changes across all layers.
4. **Insufficient testing**: Only one basic HTML example; no coverage for complex layouts, edge cases, or visual regression.

## Design Decisions

- **Architecture**: Interface-driven decoupling (Approach A). Three layers communicate through typed contracts; each layer depends on interfaces, not implementations.
- **Visual style**: vue-flow style by default — smooth bezier curves, clear filled arrows, breathing space between edges and nodes. Theme switching supported via `RenderTheme`.
- **Extension strategy**: Strategy pattern for chart types. Each type implements its own Parser module, Layout function, and RenderStrategy. New types plug in without modifying existing code.
- **Implementation**: Incremental batches. Batch 1 completes decoupling + flowchart refinement; subsequent batches add 2-3 types each.

## Architecture: Interface-Driven Decoupling

### Data Flow

```
┌─────────┐     AST (pure syntax tree)     ┌─────────┐  LayoutResult   ┌───────────┐
│  Parser  │ ─────────────────────────────→ │  Layout  │ ─────────────→ │ Renderer  │ → SVG
└─────────┘                                 └─────────┘                 └───────────┘
                                                 ↑                           ↑
                                            LayoutConfig               RenderTheme
                                          (sizes/spacing/direction)  (colors/arrow/curve)
```

### AST (unchanged)

Parser outputs a pure syntax tree. Structure varies by diagram type but is always a data-only representation with no layout or rendering information.

### LayoutConfig (new)

Replaces all hardcoded constants in the layout engine. Passed as input to Layout.

```typescript
interface LayoutConfig {
  nodeWidth: number;      // default 120
  nodeHeight: number;     // default 40
  hSpacing: number;       // horizontal spacing between nodes, default 60
  vSpacing: number;       // vertical spacing between ranks, default 60
  padding: number;        // canvas padding, default 40
  direction: FlowDirection;
}
```

### LayoutResult (extended)

Layout output now includes edge paths and node bounding boxes, not just center positions.

```typescript
interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  dimensions: Dimensions;
}

interface LayoutNode {
  id: string;
  center: Point;
  bounds: Bounds;          // { x, y, width, height } — absolute bounding box
  shape: NodeShape;        // forwarded from AST; Layout may adjust bounds based on shape
}

interface LayoutEdge {
  from: string;
  to: string;
  waypoints: Point[];      // path points including start/end at node centers
  labelPosition?: Point;
}
```

### RenderTheme (new)

Renderer styling configuration. Supports theme switching.

```typescript
interface RenderTheme {
  name: string;
  colors: ThemeColors;
  arrowStyle: 'triangle' | 'filled' | 'open' | 'circle' | 'cross';
  curveStyle: 'bezier' | 'step' | 'straight';  // default bezier (vue-flow style)
  edgeGap: number;         // gap between edge endpoint and node border, default 8
  arrowSize: number;       // arrowhead size, default 10
  nodeBorderRadius: number;
  fontFamily: string;
  fontSize: number;
}
```

### Key Changes

1. Layout layer computes edge paths (waypoints); Renderer no longer calculates start/end points.
2. Layout layer receives sizes via LayoutConfig; no hardcoded constants.
3. Renderer draws edges from waypoints + theme only; it does not know the layout algorithm.
4. Each chart type has its own Layout strategy and Renderer strategy.

## Edge & Arrow Rendering

### Core Principle

Edges start from the source node border, terminate at the target node border. Arrow tip touches the target border. A configurable `edgeGap` separates the edge from the node.

### Edge Truncation & Arrow Positioning (Renderer responsibility)

```
Source border ──[edgeGap]──→ edge start ──────→ edge end ──[edgeGap + arrowSize]──→ Target border
                                                                      ↑
                                                               arrow tip position
```

Algorithm:
1. From the last segment of waypoints, compute the ray's intersection with the target node bounding box.
2. Place arrow tip at the intersection point. Arrow extends backward by `arrowSize`.
3. Edge endpoint is at the arrow tail (intersection - edgeGap - arrowSize direction).
4. Edge start: compute intersection with source node bounding box from the first segment, then offset by `edgeGap`.

### Curve Styles

- **bezier** (default): Smooth cubic bezier curves. Control points auto-calculated from segment direction. This is the vue-flow default style.
- **step**: Right-angle polyline with 90° turns at midpoints.
- **straight**: Direct line (only applicable when start/end are on the same horizontal or vertical axis).

### Arrow Style

Default `filled` (solid triangle), consistent with vue-flow style. Size controlled by `arrowSize`, ensuring visibility at any zoom level.

### Uniform Same-Level Spacing

Layout algorithm improvements:
- Nodes on the same rank have aligned y-coordinates.
- Horizontal spacing between adjacent same-rank nodes is uniformly `hSpacing`.
- Each rank is center-aligned relative to the overall layout width.

## Chart Type Extension Architecture

### Parser Layer: One Module Per Type

```
xmermaid-parser/src/
  ast.rs              # DiagramAst enum (shared across all types)
  lexer.rs            # Common lexer base
  parser.rs           # Entry: dispatch by keyword to specific parser
  flowchart/
    lexer.rs
    parser.rs
  sequence/
    lexer.rs
    parser.rs
  class_diagram/
    ...
```

`DiagramAst` enum extends with each type:

```rust
enum DiagramAst {
  Flowchart(FlowchartAst),
  Sequence(SequenceAst),
  ClassDiagram(ClassAst),
  StateDiagram(StateAst),
  ErDiagram(ErAst),
}
```

### Layout Layer: Strategy Dispatch

```rust
fn compute_layout(ast: &DiagramAst, config: &LayoutConfig) -> LayoutResult {
    match ast {
        DiagramAst::Flowchart(fc) => flowchart::layout(fc, config),
        DiagramAst::Sequence(seq) => sequence::layout(seq, config),
        // ...
    }
}
```

Each type's layout function has a unified signature: `fn layout(ast: &T, config: &LayoutConfig) -> LayoutResult`. Output is always the same `LayoutResult` structure, so the Renderer does not need to know the diagram type.

### Renderer Layer: Strategy Registration

```typescript
class SVGRenderer {
  private strategies: Map<string, RenderStrategy>;

  render(ast: DiagramAst, layout: LayoutResult): SVGElement {
    const typeKey = getDiagramType(ast);
    const strategy = this.strategies.get(typeKey) ?? this.defaultStrategy;
    return strategy.render(ast, layout, this.theme);
  }
}

interface RenderStrategy {
  render(ast: DiagramAst, layout: LayoutResult, theme: RenderTheme): SVGElement;
}
```

Each chart type can have its own node shapes, edge styles, and special elements (e.g., Sequence lifelines, Class compartments), all plugged in through the unified `RenderStrategy` interface.

### Batch Implementation Plan

| Batch | Types | Rationale |
|-------|-------|-----------|
| 1 | Flowchart (refactor & refine) | Existing base; complete decoupling and edge/arrow optimization first |
| 2 | Sequence + State | Most commonly used; relatively regular layout (vertical timeline) |
| 3 | Class + ER | UML/database scenarios; structured layout |
| 4 | Gantt + Pie + Quadrant | Chart types; very different layout logic |
| 5 | Remaining types | Mindmap, Timeline, Sankey, C4, etc. |

Each batch delivers a working increment; no long periods without runnable output.

## Testing & Examples

### Rust Unit Tests (Parser + Layout)

Inline `#[cfg(test)]` modules in each parser and layout file.

Coverage:
- Parser: valid syntax parsing, invalid syntax error reporting, edge cases (empty diagram, single node, self-loops).
- Layout: nodes stay within bounds, same-rank spacing is uniform, edge paths are reasonable, all directions (TB/LR/RL/BT).

### JS Integration Tests (End-to-End)

Snapshot tests on HTML examples using Playwright or similar, verifying rendered output does not regress.

### Example Files

```
examples/
  basic.html                # Simple flowchart
  flowchart-complex.html    # 15+ nodes, subgraphs, long labels, self-loops, multi-in/out
  flowchart-directions.html # Same diagram in TB/LR/RL/BT
  sequence-basic.html       # Basic sequence diagram
  sequence-complex.html     # 6+ participants, alt/opt/loop groups, self-calls
  state-basic.html          # Basic state diagram
  class-basic.html          # Basic class diagram
  er-basic.html             # Basic ER diagram
  theme-comparison.html     # Same chart in 3 themes
```

Complex scenario requirements:
- **flowchart-complex**: 15+ nodes with subgraphs, long text labels, self-loops, multi-input/multi-output nodes.
- **flowchart-directions**: Same diagram rendered in all four directions for visual comparison.
- **sequence-complex**: 6+ participants with alt/opt/loop groups, self-invocation, delay annotations.
- **theme-comparison**: Same flowchart rendered with 3 different themes for visual comparison.

### Test Priority

Batch 1 focuses on Flowchart-related tests and examples. Subsequent batches add tests and examples alongside new chart types.

## Scope

This spec covers Batch 1 only: architecture decoupling, edge/arrow optimization, and Flowchart refinement. Subsequent batches will be specified separately as each batch completes.
