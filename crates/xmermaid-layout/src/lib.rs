//! xmermaid-layout: Diagram layout engine
//!
//! Computes positions for diagram elements.

pub mod coordinate;
pub mod engine;
pub mod error;
pub mod types;

pub use error::LayoutError;
pub use types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    NodeShape, Point,
};
