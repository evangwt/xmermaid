use crate::types::{Dimensions, LayoutConfig, LayoutResult, PieSlice};
use xmermaid_parser::ast::PieAst;
pub fn layout(pie: &PieAst, config: &LayoutConfig) -> LayoutResult {
 let total: f64 = pie.slices.iter().map(|slice| slice.value).sum(); let mut angle = -std::f64::consts::FRAC_PI_2;
 let slices = pie.slices.iter().map(|slice| { let next = angle + slice.value / total * std::f64::consts::TAU; let result = PieSlice { label: slice.label.clone(), value: slice.value, start_angle: angle, end_angle: next }; angle = next; result }).collect();
 LayoutResult { nodes: vec![], edges: vec![], dimensions: Dimensions { width: 420.0 + config.padding * 2.0, height: 320.0 + config.padding * 2.0 }, pie_slices: slices, xy_chart: None }
}
