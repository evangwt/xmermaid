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
pub mod sequence;
pub mod packet;
pub mod venn;
pub mod swimlanes;
pub mod ishikawa;
pub mod event_modeling;
pub mod wardley;
pub mod cynefin;
pub mod types;
pub mod xychart;

pub use engine::compute_layout;
pub use error::LayoutError;
pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    BlockDiagramLayout, BlockLayout, CynefinDomainLayout, CynefinItemLayout, CynefinLayout, CynefinTransitionLayout, IshikawaCauseLayout, IshikawaLayout, KanbanBoardLayout, KanbanColumnLayout, KanbanTaskLayout, NodeShape, PacketFieldLayout, PacketLayout, Point, QuadrantChartLayout, QuadrantPointLayout, RadarAxisLayout, RadarCurveLayout, RadarLayout, SankeyLayout, SankeyLink, SankeyNode, SequenceActivationLayout, SequenceBlockDividerLayout, SequenceBlockLayout, SequenceLayout, SequenceLifelineLayout, SequenceMessageLayout, SequenceNoteLayout, SequenceNotePlacementLayout, SequenceParticipantLayout, SwimlaneLaneLayout, SwimlaneLayout, TreemapLayout, TreemapNodeLayout, VennLayout, VennSetLayout, VennUnionLayout, WardleyComponentLayout, WardleyDependencyLayout, WardleyLayout, XyChartLayout, XyChartSeries, XySeriesKind,
};
