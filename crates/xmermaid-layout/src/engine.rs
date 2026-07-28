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
        DiagramAst::Sequence(sequence) => {
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: sequence
                    .participants
                    .iter()
                    .map(|participant| xmermaid_parser::ast::Node {
                        id: participant.clone(),
                        label: Some(participant.clone()),
                        shape: xmermaid_parser::ast::NodeShape::Rect,
                        classes: vec![],
                        styles: vec![],
                    })
                    .collect(),
                edges: sequence
                    .messages
                    .iter()
                    .map(|message| xmermaid_parser::ast::Edge {
                        from: message.from.clone(),
                        to: message.to.clone(),
                        style: xmermaid_parser::ast::EdgeStyle::Arrow,
                        label: Some(message.label.clone()),
                        min_length: 1,
                    })
                    .collect(),
                subgraphs: vec![],
            };
            let mut sequence_config = config.clone();
            sequence_config.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&flowchart_ast, &sequence_config)
        }
    }
}
