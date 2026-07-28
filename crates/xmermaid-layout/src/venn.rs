use crate::types::{Dimensions, LayoutConfig, LayoutResult, Point, VennLayout, VennSetLayout, VennUnionLayout};
use xmermaid_parser::ast::VennAst;

const SIZE: f64 = 520.0;
const RADIUS: f64 = 142.0;

pub fn layout(venn: &VennAst, config: &LayoutConfig) -> LayoutResult {
    let origin = config.padding;
    let centers = match venn.sets.len() {
        2 => vec![Point { x: origin + 210.0, y: origin + 280.0 }, Point { x: origin + 310.0, y: origin + 280.0 }],
        _ => (0..venn.sets.len()).map(|index| { let angle = -std::f64::consts::FRAC_PI_2 + std::f64::consts::TAU * index as f64 / venn.sets.len() as f64; Point { x: origin + 260.0 + 86.0 * angle.cos(), y: origin + 290.0 + 86.0 * angle.sin() } }).collect(),
    };
    let sets = venn.sets.iter().zip(centers.iter()).map(|(set, center)| VennSetLayout { id: set.id.clone(), label: set.label.clone(), center: *center, radius: RADIUS }).collect::<Vec<_>>();
    let unions = venn.unions.iter().map(|union| {
        let members = union.sets.iter().filter_map(|id| sets.iter().find(|set| set.id == *id)).collect::<Vec<_>>();
        let position = Point { x: members.iter().map(|set| set.center.x).sum::<f64>() / members.len() as f64, y: members.iter().map(|set| set.center.y).sum::<f64>() / members.len() as f64 };
        VennUnionLayout { label: union.label.clone(), position }
    }).collect();
    LayoutResult { nodes: vec![], edges: vec![], dimensions: Dimensions { width: SIZE + config.padding * 2.0, height: SIZE + config.padding * 2.0 }, pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None, kanban_board: None, treemap: None, radar: None, packet: None, venn: Some(VennLayout { title: venn.title.clone(), sets, unions }) }
}
