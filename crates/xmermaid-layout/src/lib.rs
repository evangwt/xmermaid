//! xmermaid-layout: Diagram layout engine
//!
//! Computes positions for diagram elements.

pub mod engine;
pub mod error;
pub mod flowchart;
pub mod gantt;
pub mod pie;
pub mod types;

pub use engine::compute_layout;
pub use error::LayoutError;
pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    NodeShape, Point,
};
