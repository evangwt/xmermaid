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
        DiagramAst::Flowchart(fc) => {
            let mut cfg = config.clone();
            cfg.direction = match fc.direction {
                xmermaid_parser::ast::FlowDirection::TD => crate::types::FlowDirection::TB,
                xmermaid_parser::ast::FlowDirection::BT => crate::types::FlowDirection::BT,
                xmermaid_parser::ast::FlowDirection::LR => crate::types::FlowDirection::LR,
                xmermaid_parser::ast::FlowDirection::RL => crate::types::FlowDirection::RL,
            };
            flowchart::layout(fc, &cfg)
        }
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
