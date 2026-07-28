//! Layout engine dispatcher.
//!
//! Routes layout computation to the appropriate diagram-specific module
//! based on the `DiagramAst` variant.

use crate::{flowchart, gantt};
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
        DiagramAst::Class(class) => {
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: class.classes.iter().map(|class| xmermaid_parser::ast::Node {
                    id: class.id.clone(), label: Some(class.label.clone()), shape: xmermaid_parser::ast::NodeShape::Rect,
                    classes: vec![], styles: vec![],
                }).collect(),
                edges: class.relations.iter().map(|relation| xmermaid_parser::ast::Edge {
                    from: relation.from.clone(), to: relation.to.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow,
                    label: None, min_length: 1,
                }).collect(),
                subgraphs: vec![],
            };
            let mut class_config = config.clone();
            class_config.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&flowchart_ast, &class_config)
        }
        DiagramAst::State(state) => {
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: state.states.iter().map(|id| xmermaid_parser::ast::Node { id: id.clone(), label: Some(id.clone()), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![] }).collect(),
                edges: state.transitions.iter().map(|transition| xmermaid_parser::ast::Edge { from: transition.from.clone(), to: transition.to.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: (!transition.label.is_empty()).then(|| transition.label.clone()), min_length: 1 }).collect(),
                subgraphs: vec![],
            };
            let mut state_config = config.clone(); state_config.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&flowchart_ast, &state_config)
        }
        DiagramAst::Er(er) => {
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: er
                    .entities
                    .iter()
                    .map(|id| xmermaid_parser::ast::Node {
                        id: id.clone(),
                        label: Some(id.clone()),
                        shape: xmermaid_parser::ast::NodeShape::Rect,
                        classes: vec![],
                        styles: vec![],
                    })
                    .collect(),
                edges: er
                    .relationships
                    .iter()
                    .map(|relationship| xmermaid_parser::ast::Edge {
                        from: relationship.from.clone(),
                        to: relationship.to.clone(),
                        style: xmermaid_parser::ast::EdgeStyle::Arrow,
                        label: (!relationship.label.is_empty()).then(|| relationship.label.clone()),
                        min_length: 1,
                    })
                    .collect(),
                subgraphs: vec![],
            };
            let mut er_config = config.clone();
            er_config.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&flowchart_ast, &er_config)
        }
        DiagramAst::Gantt(gantt_ast) => gantt::layout(gantt_ast, config),
        DiagramAst::Pie(pie_ast) => crate::pie::layout(pie_ast, config),
    }
}
