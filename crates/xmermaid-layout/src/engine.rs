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
        DiagramAst::XyChart(chart) => crate::xychart::layout(chart, config),
        DiagramAst::Sankey(chart) => crate::sankey::layout(chart, config),
        DiagramAst::Quadrant(chart) => crate::quadrant::layout(chart, config),
        DiagramAst::Architecture(architecture) => {
            let ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: architecture.services.iter().map(|service| xmermaid_parser::ast::Node {
                    id: service.id.clone(), label: Some(service.label.clone()),
                    shape: if matches!(service.icon.as_str(), "database" | "disk") { xmermaid_parser::ast::NodeShape::Cylinder } else { xmermaid_parser::ast::NodeShape::Rounded },
                    classes: vec![], styles: vec![],
                }).collect(),
                edges: architecture.relationships.iter().map(|relationship| xmermaid_parser::ast::Edge {
                    from: relationship.from.clone(), to: relationship.to.clone(),
                    style: if relationship.arrow_at_target { xmermaid_parser::ast::EdgeStyle::Arrow } else { xmermaid_parser::ast::EdgeStyle::Line },
                    label: None, min_length: 1,
                }).collect(),
                subgraphs: vec![],
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Block(block) => crate::block::layout(block, config),
        DiagramAst::UserJourney(journey) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::LR, nodes: journey.tasks.iter().enumerate().map(|(index, task)| xmermaid_parser::ast::Node { id: format!("journey-{}", index), label: Some(format!("{} · {}\\n{}/5", task.section, task.label, task.score)), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![] }).collect(), edges: (1..journey.tasks.len()).map(|index| xmermaid_parser::ast::Edge { from: format!("journey-{}", index - 1), to: format!("journey-{}", index), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1 }).collect(), subgraphs: vec![] }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::LR; flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Timeline(timeline) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::TD, nodes: timeline.entries.iter().enumerate().map(|(index, entry)| xmermaid_parser::ast::Node { id: format!("timeline-{}", index), label: Some(format!("{}\\n{}", entry.period, entry.events.join(" · "))), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![] }).collect(), edges: (1..timeline.entries.len()).map(|index| xmermaid_parser::ast::Edge { from: format!("timeline-{}", index - 1), to: format!("timeline-{}", index), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1 }).collect(), subgraphs: vec![] }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::TB; flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Mindmap(mindmap) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::LR, nodes: mindmap.nodes.iter().map(|node| xmermaid_parser::ast::Node { id: node.id.clone(), label: Some(node.label.clone()), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![] }).collect(), edges: mindmap.nodes.iter().filter_map(|node| node.parent.as_ref().map(|parent| xmermaid_parser::ast::Edge { from: parent.clone(), to: node.id.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1 })).collect(), subgraphs: vec![] }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::LR; flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Requirement(requirements) => {
            let ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: requirements.requirements.iter().map(|requirement| {
                    let label = requirement.text.as_ref()
                        .map(|text| format!("{}\n{}", requirement.name, text))
                        .unwrap_or_else(|| requirement.name.clone());
                    xmermaid_parser::ast::Node {
                        id: requirement.name.clone(), label: Some(label),
                        shape: if requirement.kind == "requirement" { xmermaid_parser::ast::NodeShape::Rect } else { xmermaid_parser::ast::NodeShape::Rounded },
                        classes: vec![], styles: vec![],
                    }
                }).collect(),
                edges: requirements.relationships.iter().map(|relationship| xmermaid_parser::ast::Edge {
                    from: relationship.from.clone(), to: relationship.to.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow,
                    label: Some(relationship.label.clone()), min_length: 1,
                }).collect(),
                subgraphs: vec![],
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
        DiagramAst::GitGraph(gitgraph) => {
            let ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: gitgraph.commits.iter().map(|commit| {
                    let tag = commit.tag.as_ref().map(|tag| format!("\n{}", tag)).unwrap_or_default();
                    xmermaid_parser::ast::Node {
                        id: commit.id.clone(), label: Some(format!("{}\n{}{}", commit.id, commit.branch, tag)),
                        shape: xmermaid_parser::ast::NodeShape::Circle, classes: vec![], styles: vec![],
                    }
                }).collect(),
                edges: gitgraph.commits.iter().flat_map(|commit| commit.parents.iter().map(move |parent| xmermaid_parser::ast::Edge {
                    from: parent.clone(), to: commit.id.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1,
                })).collect(),
                subgraphs: vec![],
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
        DiagramAst::C4(c4) => {
            let ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: c4.elements.iter().map(|element| {
                    let label = element.description.as_ref().map(|description| format!("{}\n{}", element.label, description)).unwrap_or_else(|| element.label.clone());
                    let shape = if element.kind.starts_with("Person") { xmermaid_parser::ast::NodeShape::Rounded } else if element.kind.ends_with("_Ext") { xmermaid_parser::ast::NodeShape::Hexagon } else { xmermaid_parser::ast::NodeShape::Rect };
                    xmermaid_parser::ast::Node { id: element.id.clone(), label: Some(label), shape, classes: vec![], styles: vec![] }
                }).collect(),
                edges: c4.relationships.iter().map(|relationship| xmermaid_parser::ast::Edge {
                    from: relationship.from.clone(), to: relationship.to.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow,
                    label: Some(relationship.label.clone()), min_length: 1,
                }).collect(),
                subgraphs: vec![],
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
        DiagramAst::ZenUml(zenuml) => {
            let ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: zenuml
                    .participants
                    .iter()
                    .map(|id| xmermaid_parser::ast::Node {
                        id: id.clone(),
                        label: Some(id.clone()),
                        shape: xmermaid_parser::ast::NodeShape::Rect,
                        classes: vec![],
                        styles: vec![],
                    })
                    .collect(),
                edges: zenuml
                    .messages
                    .iter()
                    .map(|message| xmermaid_parser::ast::Edge {
                        from: message.from.clone(),
                        to: message.to.clone(),
                        style: if message.kind == "return" {
                            xmermaid_parser::ast::EdgeStyle::Dotted
                        } else {
                            xmermaid_parser::ast::EdgeStyle::Arrow
                        },
                        label: Some(message.label.clone()),
                        min_length: 1,
                    })
                    .collect(),
                subgraphs: vec![],
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
    }
}
