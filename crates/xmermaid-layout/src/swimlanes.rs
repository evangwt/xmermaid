use crate::types::{Bounds, Dimensions, EdgeStyle, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult, NodeShape, Point, SwimlaneLaneLayout, SwimlaneLayout};
use xmermaid_parser::ast::SwimlaneAst;

const HEADER_HEIGHT: f64 = 34.0;
const LANE_HEIGHT: f64 = 146.0;
const LANE_GAP: f64 = 18.0;

pub fn layout(diagram: &SwimlaneAst, config: &LayoutConfig) -> LayoutResult {
    let max_nodes = diagram.lanes.iter().map(|lane| lane.nodes.len()).max().unwrap_or(1).max(1);
    let lane_width = (max_nodes as f64 * config.node_width + max_nodes.saturating_sub(1) as f64 * config.h_spacing + config.padding * 2.0).max(460.0);
    let mut nodes = Vec::new();
    let mut lanes = Vec::new();
    for (lane_index, lane) in diagram.lanes.iter().enumerate() {
        let y = config.padding + lane_index as f64 * (LANE_HEIGHT + LANE_GAP);
        lanes.push(SwimlaneLaneLayout { id: lane.id.clone(), label: lane.label.clone(), bounds: Bounds { x: config.padding, y, width: lane_width, height: LANE_HEIGHT } });
        for (node_index, id) in lane.nodes.iter().enumerate() {
            let ast_node = diagram.nodes.iter().find(|node| node.id == *id).expect("lane node exists");
            let center = Point { x: config.padding * 2.0 + config.node_width / 2.0 + node_index as f64 * (config.node_width + config.h_spacing), y: y + HEADER_HEIGHT + (LANE_HEIGHT - HEADER_HEIGHT) / 2.0 };
            nodes.push(LayoutNode { id: id.clone(), center, bounds: Bounds::from_center(center, config.node_width, config.node_height), shape: NodeShape::RoundedRect, label: ast_node.label.clone().unwrap_or_else(|| id.clone()), label_lines: vec![] });
        }
    }
    let edges = diagram.edges.iter().filter_map(|edge| {
        let source = nodes.iter().find(|node| node.id == edge.from)?;
        let target = nodes.iter().find(|node| node.id == edge.to)?;
        Some(LayoutEdge { from: edge.from.clone(), to: edge.to.clone(), waypoints: vec![source.center, target.center], label: edge.label.clone(), label_lines: None, label_position: None, style: EdgeStyle::Arrow, source_boundary: None, target_boundary: None, path_end: None, final_tangent_angle: None, label_anchor: None, geometry_version: 1 })
    }).collect();
    let direction = match diagram.direction { xmermaid_parser::ast::FlowDirection::TD => crate::types::FlowDirection::TB, xmermaid_parser::ast::FlowDirection::BT => crate::types::FlowDirection::BT, xmermaid_parser::ast::FlowDirection::LR => crate::types::FlowDirection::LR, xmermaid_parser::ast::FlowDirection::RL => crate::types::FlowDirection::RL };
    LayoutResult { nodes, edges, dimensions: Dimensions { width: lane_width + config.padding * 2.0, height: diagram.lanes.len() as f64 * LANE_HEIGHT + diagram.lanes.len().saturating_sub(1) as f64 * LANE_GAP + config.padding * 2.0 }, pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None, kanban_board: None, treemap: None, radar: None, packet: None, venn: None, swimlanes: Some(SwimlaneLayout { direction, lanes }), sequence: None, ishikawa: None, wardley: None, cynefin: None }
}
