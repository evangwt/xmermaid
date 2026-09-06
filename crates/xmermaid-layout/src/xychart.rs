use crate::types::{
    Bounds, Dimensions, LayoutConfig, LayoutResult, Point, XyChartLayout, XyChartSeries,
    XySeriesKind,
};
use xmermaid_parser::ast::{XyChartAst, XySeriesKind as ParserXySeriesKind};

const MIN_CHART_WIDTH: f64 = 480.0;
const CATEGORY_WIDTH: f64 = 88.0;
const PLOT_LEFT: f64 = 64.0;
const PLOT_RIGHT: f64 = 28.0;
const PLOT_TOP: f64 = 44.0;
const PLOT_BOTTOM: f64 = 60.0;
const CHART_HEIGHT: f64 = 320.0;

pub fn layout(chart: &XyChartAst, config: &LayoutConfig) -> LayoutResult {
    let category_count = if chart.x_range.is_some() {
        6.0_f64.max(2.0) // numeric axes render six tick slots
    } else {
        chart.x_labels.len() as f64
    };
    let inner_width =
        MIN_CHART_WIDTH.max(category_count as f64 * CATEGORY_WIDTH + PLOT_LEFT + PLOT_RIGHT);
    let dimensions = Dimensions {
        width: inner_width + config.padding * 2.0,
        height: CHART_HEIGHT + config.padding * 2.0,
    };
    let plot = Bounds {
        x: config.padding + PLOT_LEFT,
        y: config.padding + PLOT_TOP,
        width: inner_width - PLOT_LEFT - PLOT_RIGHT,
        height: CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM,
    };
    let category_width = plot.width / category_count as f64;
    // Numeric axes spread `count` points evenly between x_min and x_max;
    // categorical axes give each label an even slot.
    let x_for_point = |index: usize, count: usize, total: f64| -> f64 {
        match chart.x_range {
            Some((x_min, x_max)) => {
                if x_max <= x_min || count < 2 {
                    return plot.x + plot.width / 2.0;
                }
                let value = x_min + (x_max - x_min) * index as f64 / (count - 1) as f64;
                let ratio = ((value - x_min) / (x_max - x_min)).clamp(0.0, 1.0);
                plot.x + plot.width * ratio
            }
            _ => plot.x + (plot.width / total) * (index as f64 + 0.5),
        }
    };
    let bar_series_count = chart
        .series
        .iter()
        .filter(|series| matches!(series.kind, ParserXySeriesKind::Bar))
        .count()
        .max(1);
    let bar_width = (category_width * 0.68 / bar_series_count as f64).max(4.0);
    let baseline = y_for_value(0.0, chart, plot);
    let mut next_bar_series = 0_usize;

    let series = chart
        .series
        .iter()
        .map(|source| {
            let kind = match source.kind {
                ParserXySeriesKind::Bar => XySeriesKind::Bar,
                ParserXySeriesKind::Line => XySeriesKind::Line,
            };
            let result = match kind {
                XySeriesKind::Bar => {
                    let offset = (next_bar_series as f64 - (bar_series_count as f64 - 1.0) / 2.0)
                        * bar_width;
                    next_bar_series += 1;
                    let total = source.values.len() as f64;
                    let bars = source
                        .values
                        .iter()
                        .enumerate()
                        .map(|(index, value)| {
                            let center_x = x_for_point(index, source.values.len(), total) + offset;
                            let value_y = y_for_value(*value, chart, plot);
                            Bounds {
                                x: center_x - bar_width / 2.0,
                                y: baseline.min(value_y),
                                width: bar_width,
                                height: (baseline - value_y).abs(),
                            }
                        })
                        .collect();
                    XyChartSeries {
                        kind,
                        bars,
                        points: vec![],
                    }
                }
                XySeriesKind::Line => {
                    let total = source.values.len() as f64;
                    let points = source
                        .values
                        .iter()
                        .enumerate()
                        .map(|(index, value)| Point {
                            x: x_for_point(index, source.values.len(), total),
                            y: y_for_value(*value, chart, plot),
                        })
                        .collect();
                    XyChartSeries {
                        kind,
                        bars: vec![],
                        points,
                    }
                }
            };
            result
        })
        .collect();

    LayoutResult { pie_show_data: false, pie_title: None, subgraph_boxes: Vec::new(),
        nodes: vec![],
        edges: vec![],
        dimensions,
        pie_slices: vec![],
        xy_chart: Some(XyChartLayout {
            title: chart.title.clone(),
            plot,
            x_labels: match &chart.x_range {
                Some((x_min, x_max)) => numeric_ticks(*x_min, *x_max),
                None => chart.x_labels.clone(),
            },
            y_min: chart.y_min,
            y_max: chart.y_max,
            series,
        }),
        sankey: None,
        quadrant_chart: None,
        block_diagram: None,
        kanban_board: None, treemap: None, radar: None, packet: None, venn: None, swimlanes: None, sequence: None, ishikawa: None, wardley: None, cynefin: None,
    }
}

/// Generate ~6 human-friendly tick labels spanning `min..=max`.
fn numeric_ticks(min: f64, max: f64) -> Vec<String> {
    if max <= min {
        return vec![format!("{}", min)];
    }
    let raw_step = (max - min) / 5.0;
    let magnitude = 10_f64.powf(raw_step.abs().log10().floor());
    let candidates = [1.0, 2.0, 5.0, 10.0];
    let step = candidates
        .iter()
        .map(|candidate| candidate * magnitude)
        .find(|step| (max - min) / step <= 5.5)
        .unwrap_or(magnitude * 10.0);
    let first = (min / step).ceil() * step;
    let mut ticks = Vec::new();
    let mut value = first;
    while value <= max + f64::EPSILON {
        let label = if (value - value.round()).abs() < f64::EPSILON {
            format!("{}", value.round() as i64)
        } else {
            format!("{}", (value * 100.0).round() / 100.0)
        };
        ticks.push(label);
        value += step;
    }
    if ticks.is_empty() {
        ticks.push(format!("{}", min));
    }
    ticks
}

fn y_for_value(value: f64, chart: &XyChartAst, plot: Bounds) -> f64 {
    let ratio = ((value - chart.y_min) / (chart.y_max - chart.y_min)).clamp(0.0, 1.0);
    plot.y + plot.height * (1.0 - ratio)
}
