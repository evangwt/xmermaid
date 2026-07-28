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
    let inner_width =
        MIN_CHART_WIDTH.max(chart.x_labels.len() as f64 * CATEGORY_WIDTH + PLOT_LEFT + PLOT_RIGHT);
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
    let category_width = plot.width / chart.x_labels.len() as f64;
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
                    let bars = source
                        .values
                        .iter()
                        .enumerate()
                        .map(|(index, value)| {
                            let center_x = plot.x + category_width * (index as f64 + 0.5) + offset;
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
                    let points = source
                        .values
                        .iter()
                        .enumerate()
                        .map(|(index, value)| Point {
                            x: plot.x + category_width * (index as f64 + 0.5),
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

    LayoutResult {
        nodes: vec![],
        edges: vec![],
        dimensions,
        pie_slices: vec![],
        xy_chart: Some(XyChartLayout {
            title: chart.title.clone(),
            plot,
            x_labels: chart.x_labels.clone(),
            y_min: chart.y_min,
            y_max: chart.y_max,
            series,
        }),
        sankey: None,
        quadrant_chart: None,
        block_diagram: None,
        kanban_board: None, treemap: None,
    }
}

fn y_for_value(value: f64, chart: &XyChartAst, plot: Bounds) -> f64 {
    let ratio = ((value - chart.y_min) / (chart.y_max - chart.y_min)).clamp(0.0, 1.0);
    plot.y + plot.height * (1.0 - ratio)
}
