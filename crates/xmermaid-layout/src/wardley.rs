use crate::types::{Bounds, Dimensions, LayoutConfig, LayoutResult, Point, WardleyComponentLayout, WardleyDependencyLayout, WardleyLayout};
use xmermaid_parser::ast::WardleyAst;

const PLOT_WIDTH: f64 = 760.0;
const PLOT_HEIGHT: f64 = 460.0;
const TITLE_SPACE: f64 = 54.0;

pub fn layout(diagram: &WardleyAst, config: &LayoutConfig) -> LayoutResult {
    let plot = Bounds { x: config.padding + 56.0, y: config.padding + TITLE_SPACE, width: PLOT_WIDTH, height: PLOT_HEIGHT };
    let components = diagram.components.iter().map(|component| WardleyComponentLayout {
        id: component.id.clone(),
        label: component.label.clone(),
        center: Point { x: plot.x + component.x * plot.width, y: plot.y + (1.0 - component.y) * plot.height },
        anchor: component.anchor,
    }).collect();
    let dependencies = diagram.dependencies.iter().map(|dependency| WardleyDependencyLayout { from: dependency.from.clone(), to: dependency.to.clone() }).collect();
    LayoutResult {
        nodes: vec![], edges: vec![], dimensions: Dimensions { width: plot.x + plot.width + config.padding, height: plot.y + plot.height + config.padding },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None, block_diagram: None, kanban_board: None,
        treemap: None, radar: None, packet: None, venn: None, swimlanes: None, sequence: None, ishikawa: None,
        wardley: Some(WardleyLayout { title: diagram.title.clone(), plot, components, dependencies }), cynefin: None,
    }
}
