//! xmermaid-layout: Diagram layout engine
//!
//! Computes positions for diagram elements.

pub mod engine;
pub mod block;
pub mod error;
pub mod flowchart;
pub mod gantt;
pub mod kanban;
pub mod pie;
pub mod quadrant;
pub mod sankey;
pub mod treemap;
pub mod radar;
pub mod packet;
pub mod types;
pub mod xychart;

pub use engine::compute_layout;
pub use error::LayoutError;
pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    BlockDiagramLayout, BlockLayout, KanbanBoardLayout, KanbanColumnLayout, KanbanTaskLayout, NodeShape, PacketFieldLayout, PacketLayout, Point, QuadrantChartLayout, QuadrantPointLayout, RadarAxisLayout, RadarCurveLayout, RadarLayout, SankeyLayout, SankeyLink, SankeyNode, TreemapLayout, TreemapNodeLayout, XyChartLayout, XyChartSeries, XySeriesKind,
};
