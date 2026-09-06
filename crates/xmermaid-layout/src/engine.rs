//! Layout engine dispatcher.
//!
//! Routes layout computation to the appropriate diagram-specific module
//! based on the `DiagramAst` variant.

use crate::{flowchart, gantt, sequence};
use crate::types::{LayoutConfig, LayoutResult};
use xmermaid_parser::ast::DiagramAst;

/// Compute layout for any supported diagram type.
///
/// Dispatches to the appropriate layout module based on the diagram type.
/// Returns a default empty `LayoutResult` for unsupported diagram types.
pub fn compute_layout(ast: &DiagramAst, config: &LayoutConfig) -> LayoutResult {
    match ast {
        DiagramAst::Flowchart(fc) => flowchart::layout(fc, config),
        DiagramAst::Sequence(sequence) => sequence::layout(sequence, config),
        DiagramAst::Class(class) => {
            let class_ast_styles = &class.styles;
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: class.classes.iter().map(|class| {
                    let mut label_lines = Vec::new();
                    if let Some(annotation) = &class.annotation {
                        label_lines.push(annotation.clone());
                    }
                    label_lines.push(class.label.clone());
                    label_lines.extend(class.members.iter().cloned());
                    let style = class_ast_styles
                        .iter()
                        .find(|assignment| assignment.class == class.id)
                        .map(|assignment| assignment.style.clone());
                    xmermaid_parser::ast::Node {
                        id: class.id.clone(), label: Some(label_lines.join("\n")), shape: xmermaid_parser::ast::NodeShape::Rect,
                        classes: vec![], styles: vec![], style,
                    }
                }).collect(),
                edges: class.relations.iter().map(|relation| {
                    let (style, start_marker, end_marker) = match relation.kind {
                        xmermaid_parser::ast::ClassRelationKind::Inheritance => (
                            xmermaid_parser::ast::EdgeStyle::Line, None, Some(xmermaid_parser::ast::EdgeMarker::Triangle),
                        ),
                        xmermaid_parser::ast::ClassRelationKind::Composition => (
                            xmermaid_parser::ast::EdgeStyle::Line, Some(xmermaid_parser::ast::EdgeMarker::Diamond), None,
                        ),
                        xmermaid_parser::ast::ClassRelationKind::Aggregation => (
                            xmermaid_parser::ast::EdgeStyle::Line, Some(xmermaid_parser::ast::EdgeMarker::Circle), None,
                        ),
                        xmermaid_parser::ast::ClassRelationKind::Association => (
                            xmermaid_parser::ast::EdgeStyle::Arrow, None, None,
                        ),
                        xmermaid_parser::ast::ClassRelationKind::Link => (
                            xmermaid_parser::ast::EdgeStyle::Line, None, None,
                        ),
                        xmermaid_parser::ast::ClassRelationKind::Dependency => (
                            xmermaid_parser::ast::EdgeStyle::Dotted, None, Some(xmermaid_parser::ast::EdgeMarker::Arrow),
                        ),
                        xmermaid_parser::ast::ClassRelationKind::Realization => (
                            xmermaid_parser::ast::EdgeStyle::Dotted, None, Some(xmermaid_parser::ast::EdgeMarker::Triangle),
                        ),
                    };
                    let mut label_parts: Vec<String> = Vec::new();
                    if let Some(cardinality) = &relation.from_cardinality {
                        label_parts.push(cardinality.clone());
                    }
                    if !relation.label.is_empty() {
                        label_parts.push(relation.label.clone());
                    }
                    if let Some(cardinality) = &relation.to_cardinality {
                        label_parts.push(cardinality.clone());
                    }
                    let label = (!label_parts.is_empty()).then(|| label_parts.join(" "));
                    xmermaid_parser::ast::Edge {
                        from: relation.from.clone(), to: relation.to.clone(), style,
                        label, min_length: 1, start_marker, end_marker,
                    }
                }).collect(),
                subgraphs: class
                    .namespaces
                    .iter()
                    .map(|namespace| xmermaid_parser::ast::Subgraph {
                        title: namespace.id.clone(),
                        id: Some(namespace.id.clone()),
                        nodes: namespace.classes.clone(),
                        subgraphs: vec![],
                    })
                    .collect(),
                link_styles: Vec::new(),
            };
            let mut class_config = config.clone();
            class_config.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&flowchart_ast, &class_config)
        }
        DiagramAst::State(state) => {
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: state
                    .states
                    .iter()
                    .map(|state| {
                        let shape = match state.pseudostate {
                            Some(xmermaid_parser::ast::StatePseudostate::Start) => xmermaid_parser::ast::NodeShape::Circle,
                            Some(xmermaid_parser::ast::StatePseudostate::End) => xmermaid_parser::ast::NodeShape::DoubleCircle,
                            Some(xmermaid_parser::ast::StatePseudostate::Choice) => xmermaid_parser::ast::NodeShape::Diamond,
                            Some(xmermaid_parser::ast::StatePseudostate::Fork) | Some(xmermaid_parser::ast::StatePseudostate::Join) => xmermaid_parser::ast::NodeShape::Bar,
                            None => xmermaid_parser::ast::NodeShape::Rounded,
                        };
                        let label = state.label.clone()
                            .or_else(|| (!state.composite
                                && !matches!(state.pseudostate, Some(xmermaid_parser::ast::StatePseudostate::Fork | xmermaid_parser::ast::StatePseudostate::Join)))
                                .then(|| state.id.clone()));
                        xmermaid_parser::ast::Node { id: state.id.clone(), label, shape, classes: vec![], styles: vec![], style: None }
                    })
                    .chain(state.notes.iter().map(|note| {
                        xmermaid_parser::ast::Node {
                            id: format!("__note__{}", note.target),
                            label: Some(note.text.clone()),
                            shape: xmermaid_parser::ast::NodeShape::Rounded,
                            classes: vec![],
                            styles: vec![],
                            style: None,
                        }
                    }))
                    .collect(),
                edges: state.transitions.iter().map(|transition| xmermaid_parser::ast::Edge {
                    from: transition.from.clone(), to: transition.to.clone(),
                    style: xmermaid_parser::ast::EdgeStyle::Arrow,
                    label: (!transition.label.is_empty()).then(|| transition.label.clone()),
                    min_length: 1, start_marker: None, end_marker: None,
                })
                .chain(state.notes.iter().map(|note| xmermaid_parser::ast::Edge {
                    from: note.target.clone(),
                    to: format!("__note__{}", note.target),
                    style: xmermaid_parser::ast::EdgeStyle::Dotted,
                    label: None, min_length: 1, start_marker: None, end_marker: None,
                }))
                .collect(),
                subgraphs: state
                    .states
                    .iter()
                    .filter(|candidate| candidate.composite)
                    .map(|composite| xmermaid_parser::ast::Subgraph {
                        title: composite.label.clone().unwrap_or_else(|| composite.id.clone()),
                        id: Some(composite.id.clone()),
                        nodes: state
                            .states
                            .iter()
                            .filter(|child| child.parent.as_deref() == Some(composite.id.as_str()))
                            .map(|child| child.id.clone())
                            .collect(),
                        subgraphs: vec![],
                    })
                    .collect(),
                link_styles: Vec::new(),
            };
            let mut state_config = config.clone(); state_config.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&flowchart_ast, &state_config)
        }
        DiagramAst::Er(er) => {
            let crow_marker = |cardinality: &xmermaid_parser::ast::ErCardinality| match cardinality {
                xmermaid_parser::ast::ErCardinality::ZeroOrOne => xmermaid_parser::ast::EdgeMarker::CrowZeroOne,
                xmermaid_parser::ast::ErCardinality::ExactlyOne => xmermaid_parser::ast::EdgeMarker::CrowOne,
                xmermaid_parser::ast::ErCardinality::ZeroOrMore => xmermaid_parser::ast::EdgeMarker::CrowMany,
                xmermaid_parser::ast::ErCardinality::OneOrMore => xmermaid_parser::ast::EdgeMarker::CrowOneOrMore,
            };
            let cardinality = |cardinality: &xmermaid_parser::ast::ErCardinality| match cardinality {
                xmermaid_parser::ast::ErCardinality::ZeroOrOne => "0..1",
                xmermaid_parser::ast::ErCardinality::ExactlyOne => "1",
                xmermaid_parser::ast::ErCardinality::ZeroOrMore => "0..*",
                xmermaid_parser::ast::ErCardinality::OneOrMore => "1..*",
            };
            let flowchart_ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: er
                    .entities
                    .iter()
                    .map(|entity| {
                        let mut label_lines = vec![entity.name.clone()];
                        for attribute in &entity.attributes {
                            let mut line = format!("{} {}", attribute.kind, attribute.name);
                            if !attribute.keys.is_empty() {
                                line.push_str(&format!(" {}", attribute.keys.join(" ")));
                            }
                            if let Some(comment) = &attribute.comment {
                                line.push_str(&format!(" \"{}\"", comment));
                            }
                            label_lines.push(line);
                        }
                        xmermaid_parser::ast::Node {
                            id: entity.name.clone(),
                            label: Some(label_lines.join("\n")),
                            shape: xmermaid_parser::ast::NodeShape::Rect,
                            classes: vec![],
                            styles: vec![],
                            style: None,
                        }
                    })
                    .collect(),
                edges: er
                    .relationships
                    .iter()
                    .map(|relationship| {
                        let mut label_parts = vec![cardinality(&relationship.from_cardinality).to_string()];
                        if !relationship.label.is_empty() {
                            label_parts.push(relationship.label.clone());
                        }
                        label_parts.push(cardinality(&relationship.to_cardinality).to_string());
                        xmermaid_parser::ast::Edge {
                            from: relationship.from.clone(),
                            to: relationship.to.clone(),
                            style: if relationship.non_identifying {
                                xmermaid_parser::ast::EdgeStyle::Dotted
                            } else {
                                xmermaid_parser::ast::EdgeStyle::Line
                            },
                            label: (!relationship.label.is_empty())
                                .then(|| relationship.label.clone()),
                            min_length: 1,
                            start_marker: Some(crow_marker(&relationship.from_cardinality)),
                            end_marker: Some(crow_marker(&relationship.to_cardinality)),
                        }
                    })
                    .collect(),
                subgraphs: vec![], link_styles: Vec::new(),
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
                nodes: architecture
                    .services
                    .iter()
                    .map(|service| xmermaid_parser::ast::Node {
                        id: service.id.clone(), label: Some(service.label.clone()),
                        shape: if matches!(service.icon.as_str(), "database" | "disk") { xmermaid_parser::ast::NodeShape::Cylinder } else { xmermaid_parser::ast::NodeShape::Rounded },
                        classes: vec![], styles: vec![], style: None,
                    })
                    .chain(architecture.junctions.iter().map(|junction| xmermaid_parser::ast::Node {
                        id: junction.id.clone(), label: None,
                        shape: xmermaid_parser::ast::NodeShape::Circle,
                        classes: vec![], styles: vec![], style: None,
                    }))
                    .collect(),
                edges: architecture.relationships.iter().map(|relationship| xmermaid_parser::ast::Edge {
                    from: relationship.from.clone(), to: relationship.to.clone(),
                    style: if relationship.arrow_at_target { xmermaid_parser::ast::EdgeStyle::Arrow } else { xmermaid_parser::ast::EdgeStyle::Line },
                    label: None, min_length: 1,
                    start_marker: relationship.arrow_at_source.then_some(xmermaid_parser::ast::EdgeMarker::Arrow),
                    end_marker: None,
                }).collect(),
                subgraphs: architecture
                    .groups
                    .iter()
                    .map(|group| xmermaid_parser::ast::Subgraph {
                        title: group.label.clone(),
                        id: Some(group.id.clone()),
                        nodes: architecture
                            .services
                            .iter()
                            .filter(|service| service.group.as_deref() == Some(group.id.as_str()))
                            .map(|service| service.id.clone())
                            .collect(),
                        subgraphs: vec![],
                    })
                    .collect(),
                link_styles: Vec::new(),
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Block(block) => crate::block::layout(block, config),
        DiagramAst::Kanban(board) => crate::kanban::layout(board, config),
        DiagramAst::Treemap(treemap) => crate::treemap::layout(treemap, config),
        DiagramAst::Radar(radar) => crate::radar::layout(radar, config),
        DiagramAst::Packet(packet) => crate::packet::layout(packet, config),
        DiagramAst::Venn(venn) => crate::venn::layout(venn, config),
        DiagramAst::Swimlanes(swimlanes) => crate::swimlanes::layout(swimlanes, config),
        DiagramAst::Ishikawa(ishikawa) => crate::ishikawa::layout(ishikawa, config),
        DiagramAst::EventModeling(event_modeling) => crate::event_modeling::layout(event_modeling, config),
        DiagramAst::Wardley(wardley) => crate::wardley::layout(wardley, config),
        DiagramAst::Cynefin(cynefin) => crate::cynefin::layout(cynefin, config),
        DiagramAst::UserJourney(journey) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::LR, nodes: journey.tasks.iter().enumerate().map(|(index, task)| xmermaid_parser::ast::Node { id: format!("journey-{}", index), label: Some(format!("{} · {}\n{}/5", task.section, task.label, task.score)), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![], style: None }).collect(), edges: (1..journey.tasks.len()).map(|index| xmermaid_parser::ast::Edge { from: format!("journey-{}", index - 1), to: format!("journey-{}", index), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1, start_marker: None, end_marker: None }).collect(), subgraphs: vec![], link_styles: Vec::new() }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::LR; flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Timeline(timeline) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::TD, nodes: timeline.entries.iter().enumerate().map(|(index, entry)| xmermaid_parser::ast::Node { id: format!("timeline-{}", index), label: Some(format!("{}\n{}", entry.period, entry.events.join(" · "))), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![], style: None }).collect(), edges: (1..timeline.entries.len()).map(|index| xmermaid_parser::ast::Edge { from: format!("timeline-{}", index - 1), to: format!("timeline-{}", index), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1, start_marker: None, end_marker: None }).collect(), subgraphs: vec![], link_styles: Vec::new() }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::TB; flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Mindmap(mindmap) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::LR, nodes: mindmap.nodes.iter().map(|node| xmermaid_parser::ast::Node { id: node.id.clone(), label: Some(match &node.icon {
                            Some(icon) => format!("fa:fa-{} {}", icon, node.label),
                            None => node.label.clone(),
                        }), shape: node.shape.clone(), classes: vec![], styles: vec![], style: None }).collect(), edges: mindmap.nodes.iter().filter_map(|node| node.parent.as_ref().map(|parent| xmermaid_parser::ast::Edge { from: parent.clone(), to: node.id.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1, start_marker: None, end_marker: None })).collect(), subgraphs: vec![], link_styles: Vec::new() }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::LR; flowchart::layout(&ast, &cfg)
        }
        DiagramAst::Treeview(tree) => {
            let ast = xmermaid_parser::ast::FlowchartAst { direction: xmermaid_parser::ast::FlowDirection::LR, nodes: tree.nodes.iter().map(|node| xmermaid_parser::ast::Node { id: node.id.clone(), label: Some(node.label.clone()), shape: xmermaid_parser::ast::NodeShape::Rounded, classes: vec![], styles: vec![], style: None }).collect(), edges: tree.nodes.iter().filter_map(|node| node.parent.as_ref().map(|parent| xmermaid_parser::ast::Edge { from: parent.clone(), to: node.id.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1, start_marker: None, end_marker: None })).collect(), subgraphs: vec![], link_styles: Vec::new() }; let mut cfg = config.clone(); cfg.direction = crate::types::FlowDirection::LR; flowchart::layout(&ast, &cfg)
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
                        classes: vec![], styles: vec![], style: None,
                    }
                }).collect(),
                edges: requirements.relationships.iter().map(|relationship| xmermaid_parser::ast::Edge {
                    from: relationship.from.clone(), to: relationship.to.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow,
                    label: Some(relationship.label.clone()), min_length: 1, start_marker: None, end_marker: None }).collect(),
                subgraphs: vec![], link_styles: Vec::new(),
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
                    let style = (commit.commit_type.as_deref() == Some("HIGHLIGHT")).then(|| xmermaid_parser::ast::NodeStyle {
                        fill: Some("#fbbf24".to_string()),
                        ..xmermaid_parser::ast::NodeStyle::default()
                    });
                    xmermaid_parser::ast::Node {
                        id: commit.id.clone(), label: Some(format!("{}\n{}{}", commit.id, commit.branch, tag)),
                        shape: xmermaid_parser::ast::NodeShape::Circle, classes: vec![], styles: vec![], style,
                    }
                }).collect(),
                edges: gitgraph.commits.iter().flat_map(|commit| commit.parents.iter().map(move |parent| xmermaid_parser::ast::Edge {
                    from: parent.clone(), to: commit.id.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow, label: None, min_length: 1, start_marker: None, end_marker: None })).collect(),
                subgraphs: vec![], link_styles: Vec::new(),
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
        DiagramAst::C4(c4) => {
            fn c4_subgraphs(boundaries: &[xmermaid_parser::ast::C4Boundary]) -> Vec<xmermaid_parser::ast::Subgraph> {
                boundaries
                    .iter()
                    .map(|boundary| xmermaid_parser::ast::Subgraph {
                        title: boundary.label.clone(),
                        id: Some(boundary.id.clone()),
                        nodes: boundary.elements.clone(),
                        subgraphs: c4_subgraphs(&boundary.boundaries),
                    })
                    .collect()
            }
            let ast = xmermaid_parser::ast::FlowchartAst {
                direction: xmermaid_parser::ast::FlowDirection::LR,
                nodes: c4.elements.iter().map(|element| {
                    let label = element.description.as_ref().map(|description| format!("{}\n{}", element.label, description)).unwrap_or_else(|| element.label.clone());
                    let shape = if element.kind.starts_with("Person") { xmermaid_parser::ast::NodeShape::Rounded } else if element.kind.ends_with("_Ext") { xmermaid_parser::ast::NodeShape::Hexagon } else { xmermaid_parser::ast::NodeShape::Rect };
                    xmermaid_parser::ast::Node { id: element.id.clone(), label: Some(label), shape, classes: vec![], styles: vec![], style: None }
                }).collect(),
                edges: c4.relationships.iter().map(|relationship| xmermaid_parser::ast::Edge {
                    from: relationship.from.clone(), to: relationship.to.clone(), style: xmermaid_parser::ast::EdgeStyle::Arrow,
                    label: Some(relationship.label.clone()), min_length: 1,
                    start_marker: relationship.bidirectional.then_some(xmermaid_parser::ast::EdgeMarker::Arrow),
                    end_marker: None,
                }).collect(),
                subgraphs: c4_subgraphs(&c4.boundaries),
                link_styles: Vec::new(),
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
                        style: None,
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
                        start_marker: None,
                        end_marker: None,
                    })
                    .collect(),
                subgraphs: vec![], link_styles: Vec::new(),
            };
            let mut cfg = config.clone();
            cfg.direction = crate::types::FlowDirection::LR;
            flowchart::layout(&ast, &cfg)
        }
    }
}
