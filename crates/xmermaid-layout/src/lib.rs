//! xmermaid-layout: Diagram layout engine
//!
//! Computes positions for diagram elements.

pub mod engine;
pub mod block;
pub mod error;
pub mod flowchart;
pub mod gantt;
pub mod pie;
pub mod quadrant;
pub mod sankey;
pub mod types;
pub mod xychart;

pub use engine::compute_layout;
pub use error::LayoutError;
pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    BlockDiagramLayout, BlockLayout, NodeShape, Point, QuadrantChartLayout, QuadrantPointLayout, SankeyLayout, SankeyLink, SankeyNode, XyChartLayout, XyChartSeries, XySeriesKind,
};
