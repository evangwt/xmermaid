//! Layout engine dispatcher.
//!
//! Routes layout computation to the appropriate diagram-specific module
//! based on the `DiagramAst` variant.

use crate::flowchart;
use crate::types::{LayoutConfig, LayoutResult};
use xmermaid_parser::ast::DiagramAst;

/// Compute layout for any supported diagram type.
///
/// Dispatches to the appropriate layout module based on the diagram type.
/// Returns a default empty `LayoutResult` for unsupported diagram types.
pub fn compute_layout(ast: &DiagramAst, config: &LayoutConfig) -> LayoutResult {
    match ast {
        DiagramAst::Flowchart(fc) => flowchart::layout(fc, config),
        _ => LayoutResult {
            nodes: vec![],
            edges: vec![],
            dimensions: crate::types::Dimensions {
                width: config.padding * 2.0,
                height: config.padding * 2.0,
            },
        },
    }
}
