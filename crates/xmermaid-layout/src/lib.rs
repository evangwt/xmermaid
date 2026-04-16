//! xmermaid-layout: Diagram layout engine
//!
//! Computes positions for diagram elements.

pub mod coordinate;
pub mod error;

use coordinate::{Point, Dimensions};
use serde::{Deserialize, Serialize};

/// Layout result containing positions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LayoutResult {
    /// Node positions (id -> Point)
    pub positions: Vec<(String, Point)>,
    /// Diagram dimensions
    pub dimensions: Dimensions,
}

/// Compute layout for a diagram (placeholder)
pub fn layout() -> LayoutResult {
    LayoutResult::default()
}