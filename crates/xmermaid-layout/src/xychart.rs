use crate::types::{
    Bounds, Dimensions, LayoutConfig, LayoutResult, Point, XyChartLayout, XyChartSeries,
    XySeriesKind,
};
use xmermaid_parser::ast::{XyChartAst, XySeriesKind as ParserXySeriesKind};

const MIN_CHART_WIDTH: f64 = 480.0;
const MIN_CHART_HEIGHT: f64 = 320.0;
const CATEGORY_WIDTH: f64 = 88.0;
const PLOT_LEFT: f64 = 64.0;
const PLOT_RIGHT: f64 = 28.0;
const PLOT_TOP: f64 = 44.0;
const PLOT_BOTTOM: f64 = 60.0;

pub fn layout(chart: &XyChartAst, config: &LayoutConfig) -> LayoutResult {
    let category_count = if chart.x_range.is_some() {
        6.0_f64.max(2.0) // numeric axes render six tick slots
    } else {
        chart.x_labels.len() as f64
    };
    let inner_width =
        MIN_CHART_WIDTH.max(category_count as f64 * CATEGORY_WIDTH + PLOT_LEFT + PLOT_RIGHT);
    let inner_height = if chart.horizontal {
        (MIN_CHART_HEIGHT).max(category_count * CATEGORY_WIDTH * 0.62)
    } else {
        MIN_CHART_HEIGHT
    };
    let dimensions = Dimensions {
        width: inner_width + config.padding * 2.0,
        height: inner_height + config.padding * 2.0,
    };
    let plot = Bounds {
        x: config.padding + PLOT_LEFT,
        y: config.padding + PLOT_TOP,
        width: inner_width - PLOT_LEFT - PLOT_RIGHT,
        height: inner_height - PLOT_TOP - PLOT_BOTTOM,
    };
    let category_width = if chart.horizontal {
        plot.height / category_count
    } else {
        plot.width / category_count
    };
    let bar_series_count = chart
        .series
        .iter()
        .filter(|series| matches!(series.kind, ParserXySeriesKind::Bar))
        .count()
        .max(1);
    let bar_width = (category_width * 0.68 / bar_series_count as f64).max(4.0);
    let mut next_bar_series = 0_usize;

    let value_ratio = |value: f64| -> f64 {
        ((value - chart.y_min) / (chart.y_max - chart.y_min)).clamp(0.0, 1.0)
    };
    let zero_position = plot_value_baseline(chart, plot);

    let series = chart
        .series
        .iter()
        .map(|source| {
            let kind = match source.kind {
                ParserXySeriesKind::Bar => XySeriesKind::Bar,
                ParserXySeriesKind::Line => XySeriesKind::Line,
            };
            match kind {
                XySeriesKind::Bar => {
                    let offset = (next_bar_series as f64 - (bar_series_count as f64 - 1.0) / 2.0)
                        * bar_width;
                    next_bar_series += 1;
                    let count = source.values.len();
                    let bars = source
                        .values
                        .iter()
                        .enumerate()
                        .map(|(index, value)| {
                            let value_position = if chart.horizontal {
                                plot.x + plot.width * value_ratio(*value)
                            } else {
                                plot.y + plot.height * (1.0 - value_ratio(*value))
                            };
                            let slot = slot_for_index(chart, index, count, plot);
                            if chart.horizontal {
                                Bounds {
                                    x: zero_position.min(value_position),
                                    y: slot + offset - bar_width / 2.0,
                                    width: (value_position - zero_position).abs(),
                                    height: bar_width,
                                }
                            } else {
                                Bounds {
                                    x: slot + offset - bar_width / 2.0,
                                    y: zero_position.min(value_position),
                                    width: bar_width,
                                    height: (value_position - zero_position).abs(),
                                }
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
                    let count = source.values.len();
                    let points = source
                        .values
                        .iter()
                        .enumerate()
                        .map(|(index, value)| {
                            let value_position = if chart.horizontal {
                                plot.x + plot.width * value_ratio(*value)
                            } else {
                                plot.y + plot.height * (1.0 - value_ratio(*value))
                            };
                            let slot = slot_for_index(chart, index, count, plot);
                            if chart.horizontal {
                                Point { x: value_position, y: slot }
                            } else {
                                Point { x: slot, y: value_position }
                            }
                        })
                        .collect();
                    XyChartSeries {
                        kind,
                        bars: vec![],
                        points,
                    }
                }
            }
        })
        .collect();

    // In horizontal orientation the y-value range runs along the bottom edge.
    let value_labels = if chart.horizontal {
        numeric_ticks(chart.y_min, chart.y_max)
    } else {
        Vec::new()
    };
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
                _ => chart.x_labels.clone(),
            },
            y_min: chart.y_min,
            y_max: chart.y_max,
            series,
            horizontal: chart.horizontal,
            x_title: chart.x_title.clone(),
            y_title: chart.y_title.clone(),
            // Consumed by the renderer to label the horizontal value axis.
            value_axis_labels: value_labels,
        }),
        sankey: None,
        quadrant_chart: None,
        block_diagram: None,
        kanban_board: None, treemap: None, radar: None, packet: None, venn: None, swimlanes: None, sequence: None, ishikawa: None, wardley: None, cynefin: None,
    }
}

/// Category slot center for a data index; numeric axes spread the index
/// between the axis bounds instead of using fixed slots.
fn slot_for_index(chart: &XyChartAst, index: usize, count: usize, plot: Bounds) -> f64 {
    match chart.x_range {
        Some((x_min, x_max)) => {
            if x_max <= x_min || count < 2 {
                return if chart.horizontal {
                    plot.y + plot.height / 2.0
                } else {
                    plot.x + plot.width / 2.0
                };
            }
            let value = x_min + (x_max - x_min) * index as f64 / (count - 1) as f64;
            let ratio = ((value - x_min) / (x_max - x_min)).clamp(0.0, 1.0);
            if chart.horizontal {
                plot.y + plot.height * (1.0 - ratio)
            } else {
                plot.x + plot.width * ratio
            }
        }
        None => {
            let total = count as f64;
            let slot = if chart.horizontal { plot.height } else { plot.width } / total;
            let axis_origin = if chart.horizontal { plot.y } else { plot.x };
            axis_origin + slot * (index as f64 + 0.5)
        }
    }
}

/// The value-axis position of zero (clamped into the plot) that bars grow from.
fn plot_value_baseline(chart: &XyChartAst, plot: Bounds) -> f64 {
    let ratio = ((0.0 - chart.y_min) / (chart.y_max - chart.y_min)).clamp(0.0, 1.0);
    if chart.horizontal {
        plot.x + plot.width * ratio
    } else {
        plot.y + plot.height * (1.0 - ratio)
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
