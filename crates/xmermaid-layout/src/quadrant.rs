use crate::types::{Bounds, Dimensions, LayoutConfig, LayoutResult, Point, QuadrantChartLayout, QuadrantPointLayout};
use xmermaid_parser::ast::QuadrantAst;

const CHART_SIZE: f64 = 460.0;
const PLOT_LEFT: f64 = 72.0;
const PLOT_TOP: f64 = 64.0;
const PLOT_SIZE: f64 = 340.0;

pub fn layout(chart: &QuadrantAst, config: &LayoutConfig) -> LayoutResult {
    let plot = Bounds { x: config.padding + PLOT_LEFT, y: config.padding + PLOT_TOP, width: PLOT_SIZE, height: PLOT_SIZE };
    let points = chart.points.iter().map(|point| QuadrantPointLayout {
        label: point.label.clone(),
        center: Point {
            x: plot.x + point.x * plot.width,
            y: plot.y + (1.0 - point.y) * plot.height,
        },
    }).collect();
    LayoutResult {
        nodes: vec![], edges: vec![],
        dimensions: Dimensions { width: CHART_SIZE + config.padding * 2.0, height: CHART_SIZE + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None,
        block_diagram: None,
        kanban_board: None,
        quadrant_chart: Some(QuadrantChartLayout {
            title: chart.title.clone(), plot, x_axis: chart.x_axis.clone(), y_axis: chart.y_axis.clone(), quadrants: chart.quadrants.clone(), points,
        }),
    }
}
