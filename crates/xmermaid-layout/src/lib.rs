//! xmermaid-layout: Diagram layout engine
//!
//! Computes positions for diagram elements.

pub mod coordinate;
pub mod engine;
pub mod error;

use coordinate::{Dimensions, Point};
use serde::{Deserialize, Serialize};

pub use engine::compute_flowchart_layout;
pub use error::LayoutError;

/// Layout result containing positions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LayoutResult {
    /// Node positions (id -> Point)
    pub positions: Vec<(String, Point)>,
    /// Diagram dimensions
    pub dimensions: Dimensions,
}
