use crate::types::{Bounds, Dimensions, EdgeStyle, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult, NodeShape, Point, SwimlaneLaneLayout, SwimlaneLayout};
use xmermaid_parser::ast::{EventFrame, EventModelingAst};

const HEADER_HEIGHT: f64 = 34.0;
const LANE_HEIGHT: f64 = 116.0;
const LANE_GAP: f64 = 16.0;

const LANES: [(&str, &str); 3] = [
    ("automation", "UI / Automation"),
    ("command-readmodel", "Command / Read Model"),
    ("events", "Events"),
];

fn lane_index(frame: &EventFrame) -> usize {
    match frame.entity_type.as_str() {
        "ui" | "pcr" => 0,
        "cmd" | "rmo" => 1,
        "evt" => 2,
        _ => unreachable!("Event Modeling parser normalizes frame entity types"),
    }
}

pub fn layout(diagram: &EventModelingAst, config: &LayoutConfig) -> LayoutResult {
    let column_width = config.node_width + config.h_spacing * 0.65;
    let lane_width = (diagram.frames.len() as f64 * column_width + config.padding * 2.0).max(520.0);
    let mut lanes = Vec::with_capacity(LANES.len());
    for (index, (id, label)) in LANES.iter().enumerate() {
        lanes.push(SwimlaneLaneLayout {
            id: (*id).to_string(),
            label: (*label).to_string(),
            bounds: Bounds { x: config.padding, y: config.padding + index as f64 * (LANE_HEIGHT + LANE_GAP), width: lane_width, height: LANE_HEIGHT },
        });
    }

    let nodes = diagram.frames.iter().enumerate().map(|(index, frame)| {
        let lane = &lanes[lane_index(frame)];
        let center = Point {
            x: config.padding * 2.0 + config.node_width / 2.0 + index as f64 * column_width,
            y: lane.bounds.y + HEADER_HEIGHT + (LANE_HEIGHT - HEADER_HEIGHT) / 2.0,
        };
        LayoutNode {
            id: format!("frame-{}", frame.id),
            center,
            bounds: Bounds::from_center(center, config.node_width, config.node_height),
            shape: NodeShape::RoundedRect,
            label: format!("{} · {}", frame.id, frame.entity),
            label_lines: vec![],
        }
    }).collect::<Vec<_>>();

    let edges = (1..diagram.frames.len()).filter_map(|index| {
        let current = &diagram.frames[index];
        if current.reset {
            return None;
        }
        let source = &nodes[index - 1];
        let target = &nodes[index];
        Some(LayoutEdge {
            from: source.id.clone(), to: target.id.clone(), waypoints: vec![source.center, target.center],
            label: None, label_lines: None, label_position: None, style: EdgeStyle::Arrow,
            source_boundary: None, target_boundary: None, path_end: None, final_tangent_angle: None,
            label_anchor: None, geometry_version: 1,
        })
    }).collect();

    LayoutResult {
        nodes,
        edges,
        dimensions: Dimensions { width: lane_width + config.padding * 2.0, height: LANES.len() as f64 * LANE_HEIGHT + (LANES.len() - 1) as f64 * LANE_GAP + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None, kanban_board: None,
        treemap: None, radar: None, packet: None, venn: None,
        swimlanes: Some(SwimlaneLayout { direction: crate::types::FlowDirection::LR, lanes }), sequence: None,
        ishikawa: None, wardley: None, cynefin: None,
    }
}
