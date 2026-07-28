use std::collections::HashMap;

use crate::types::{
    Bounds, Dimensions, LayoutConfig, LayoutResult, SankeyLayout, SankeyLink, SankeyNode,
};
use xmermaid_parser::ast::SankeyAst;

const CHART_WIDTH: f64 = 720.0;
const CHART_HEIGHT: f64 = 400.0;
const NODE_WIDTH: f64 = 18.0;
const NODE_GAP: f64 = 16.0;
const CHART_TOP: f64 = 30.0;
const CHART_BOTTOM: f64 = 30.0;

pub fn layout(chart: &SankeyAst, config: &LayoutConfig) -> LayoutResult {
    let index_by_id = chart.nodes.iter().enumerate().map(|(index, id)| (id.as_str(), index)).collect::<HashMap<_, _>>();
    let mut columns = vec![0_usize; chart.nodes.len()];
    for _ in 0..chart.nodes.len() {
        let mut changed = false;
        for link in &chart.links {
            let source = index_by_id[link.source.as_str()];
            let target = index_by_id[link.target.as_str()];
            let next = columns[source] + 1;
            if next > columns[target] {
                columns[target] = next;
                changed = true;
            }
        }
        if !changed { break; }
    }
    let max_column = columns.iter().copied().max().unwrap_or_default();
    let mut incoming = vec![0.0; chart.nodes.len()];
    let mut outgoing = vec![0.0; chart.nodes.len()];
    for link in &chart.links {
        outgoing[index_by_id[link.source.as_str()]] += link.value;
        incoming[index_by_id[link.target.as_str()]] += link.value;
    }
    let values = incoming.iter().zip(outgoing.iter()).map(|(input, output)| input.max(*output)).collect::<Vec<_>>();
    let mut by_column = vec![Vec::new(); max_column + 1];
    for (index, column) in columns.iter().copied().enumerate() { by_column[column].push(index); }
    let plot_height = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
    let scale = by_column.iter().filter_map(|indices| {
        let gaps = NODE_GAP * indices.len().saturating_sub(1) as f64;
        let total = indices.iter().map(|index| values[*index]).sum::<f64>();
        (total > 0.0).then_some((plot_height - gaps) / total)
    }).fold(f64::INFINITY, f64::min);
    let scale = if scale.is_finite() { scale } else { 1.0 };
    let horizontal_span = CHART_WIDTH - NODE_WIDTH;
    let mut bounds = vec![Bounds { x: 0.0, y: 0.0, width: NODE_WIDTH, height: 0.0 }; chart.nodes.len()];
    for (column, indices) in by_column.iter().enumerate() {
        let x = config.padding + if max_column == 0 { horizontal_span / 2.0 } else { horizontal_span * column as f64 / max_column as f64 };
        let group_height = indices.iter().map(|index| values[*index] * scale).sum::<f64>() + NODE_GAP * indices.len().saturating_sub(1) as f64;
        let mut y = config.padding + CHART_TOP + (plot_height - group_height) / 2.0;
        for index in indices {
            let height = values[*index] * scale;
            bounds[*index] = Bounds { x, y, width: NODE_WIDTH, height };
            y += height + NODE_GAP;
        }
    }
    let nodes = chart.nodes.iter().enumerate().map(|(index, id)| SankeyNode { id: id.clone(), bounds: bounds[index], value: values[index], column: columns[index] }).collect::<Vec<_>>();
    let mut source_offsets = bounds.iter().map(|bounds| bounds.y).collect::<Vec<_>>();
    let mut target_offsets = bounds.iter().map(|bounds| bounds.y).collect::<Vec<_>>();
    let links = chart.links.iter().map(|link| {
        let source = index_by_id[link.source.as_str()];
        let target = index_by_id[link.target.as_str()];
        let thickness = link.value * scale;
        let source_y = source_offsets[source] + thickness / 2.0;
        let target_y = target_offsets[target] + thickness / 2.0;
        source_offsets[source] += thickness;
        target_offsets[target] += thickness;
        SankeyLink { source: link.source.clone(), target: link.target.clone(), value: link.value, source_y, target_y, thickness }
    }).collect();
    LayoutResult {
        nodes: vec![], edges: vec![],
        dimensions: Dimensions { width: CHART_WIDTH + config.padding * 2.0, height: CHART_HEIGHT + config.padding * 2.0 },
        pie_slices: vec![], xy_chart: None,
        sankey: Some(SankeyLayout { nodes, links }),
        quadrant_chart: None,
        block_diagram: None,
    }
}
