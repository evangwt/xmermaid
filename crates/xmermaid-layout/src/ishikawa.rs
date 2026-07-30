use std::collections::HashMap;

use crate::types::{Bounds, Dimensions, IshikawaCauseLayout, IshikawaLayout, LayoutConfig, LayoutResult, Point};
use xmermaid_parser::ast::IshikawaAst;

const WIDTH: f64 = 840.0;
const HEIGHT: f64 = 480.0;

pub fn layout(diagram: &IshikawaAst, config: &LayoutConfig) -> LayoutResult {
    let origin = config.padding;
    let spine_start = Point { x: origin + 84.0, y: origin + HEIGHT / 2.0 };
    let spine_end = Point { x: origin + 670.0, y: spine_start.y };
    let roots = diagram.causes.iter().filter(|cause| cause.parent.is_none()).count().max(1);
    let spacing = (spine_end.x - spine_start.x - 100.0) / roots as f64;
    let mut root_index = 0usize;
    let mut positions = HashMap::new();
    let mut causes = Vec::new();

    for cause in &diagram.causes {
        let (branch_anchor, position) = if cause.parent.is_none() {
            let side = if root_index % 2 == 0 { -1.0 } else { 1.0 };
            let anchor = Point { x: spine_start.x + 64.0 + spacing * root_index as f64, y: spine_start.y };
            root_index += 1;
            (anchor, Point { x: anchor.x - 92.0, y: anchor.y + side * 122.0 })
        } else {
            let parent_position = positions.get(cause.parent.as_ref().unwrap()).copied().unwrap_or(spine_start);
            let step = (spine_start.y - parent_position.y).signum() * 42.0;
            (parent_position, Point { x: parent_position.x - 68.0, y: parent_position.y + step })
        };
        positions.insert(cause.label.clone(), position);
        causes.push(IshikawaCauseLayout {
            label: cause.label.clone(), parent: cause.parent.clone(), depth: cause.depth, branch_anchor, position,
        });
    }

    let effect_bounds = Bounds { x: spine_end.x + 22.0, y: spine_end.y - 31.0, width: 128.0, height: 62.0 };
    LayoutResult {
        nodes: vec![], edges: vec![], dimensions: Dimensions { width: WIDTH + config.padding * 2.0, height: HEIGHT + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None, kanban_board: None,
        treemap: None, radar: None, packet: None, venn: None, swimlanes: None, sequence: None, wardley: None, cynefin: None,
        ishikawa: Some(IshikawaLayout { effect: diagram.effect.clone(), effect_bounds, spine_start, spine_end, causes }),
    }
}
