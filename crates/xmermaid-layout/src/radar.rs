use crate::types::{Dimensions, LayoutConfig, LayoutResult, Point, RadarAxisLayout, RadarCurveLayout, RadarLayout};
use xmermaid_parser::ast::RadarAst;

const CHART_SIZE: f64 = 520.0;
const CHART_RADIUS: f64 = 172.0;
const LABEL_RADIUS: f64 = 212.0;

pub fn layout(chart: &RadarAst, config: &LayoutConfig) -> LayoutResult {
    let center = Point { x: config.padding + CHART_SIZE / 2.0, y: config.padding + CHART_SIZE / 2.0 };
    let angles = (0..chart.axes.len()).map(|index| radar_angle(index, chart.axes.len())).collect::<Vec<_>>();
    let axes = chart.axes.iter().zip(angles.iter()).map(|(axis, angle)| RadarAxisLayout {
        label: axis.label.clone(),
        end: polar_point(center, CHART_RADIUS, *angle),
        label_position: polar_point(center, LABEL_RADIUS, *angle),
    }).collect();
    let curves = chart.curves.iter().map(|curve| RadarCurveLayout {
        label: curve.label.clone(),
        points: curve.values.iter().zip(angles.iter()).map(|(value, angle)| {
            let ratio = ((value - chart.min) / (chart.max - chart.min)).clamp(0.0, 1.0);
            polar_point(center, CHART_RADIUS * ratio, *angle)
        }).collect(),
    }).collect();

    LayoutResult {
        nodes: vec![], edges: vec![],
        dimensions: Dimensions { width: CHART_SIZE + config.padding * 2.0, height: CHART_SIZE + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None, sankey: None, quadrant_chart: None,
        block_diagram: None, kanban_board: None, treemap: None,
        radar: Some(RadarLayout { title: chart.title.clone(), center, radius: CHART_RADIUS, axes, curves, min: chart.min, max: chart.max }),
        packet: None, venn: None, swimlanes: None, sequence: None, ishikawa: None, wardley: None, cynefin: None,
    }
}

fn radar_angle(index: usize, total: usize) -> f64 {
    -std::f64::consts::FRAC_PI_2 + std::f64::consts::TAU * index as f64 / total as f64
}

fn polar_point(center: Point, radius: f64, angle: f64) -> Point {
    Point { x: center.x + radius * angle.cos(), y: center.y + radius * angle.sin() }
}
