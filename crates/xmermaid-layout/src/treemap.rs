use crate::types::{Bounds, Dimensions, LayoutConfig, LayoutResult, TreemapLayout, TreemapNodeLayout};
use xmermaid_parser::ast::TreemapAst;

const CHART_WIDTH: f64 = 640.0;
const CHART_HEIGHT: f64 = 400.0;
const GROUP_INSET: f64 = 8.0;
const GROUP_LABEL_HEIGHT: f64 = 22.0;

pub fn layout(chart: &TreemapAst, config: &LayoutConfig) -> LayoutResult {
    let mut result = Vec::new();
    let roots = chart.nodes.iter().enumerate()
        .filter_map(|(index, node)| node.parent.is_none().then_some(index))
        .collect::<Vec<_>>();
    let bounds = Bounds {
        x: config.padding,
        y: config.padding,
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
    };
    layout_children(chart, &roots, bounds, 0, &mut result);
    LayoutResult {
        nodes: vec![],
        edges: vec![],
        dimensions: Dimensions { width: CHART_WIDTH + config.padding * 2.0, height: CHART_HEIGHT + config.padding * 2.0 },
        pie_slices: vec![],
        xy_chart: None,
        sankey: None,
        quadrant_chart: None,
        block_diagram: None,
        kanban_board: None,
        treemap: Some(TreemapLayout { nodes: result }),
        radar: None,
    }
}

fn layout_children(
    chart: &TreemapAst,
    indices: &[usize],
    bounds: Bounds,
    depth: usize,
    result: &mut Vec<TreemapNodeLayout>,
) {
    let total = indices.iter().map(|index| subtree_value(chart, *index)).sum::<f64>();
    if total <= 0.0 { return; }
    let horizontal = depth % 2 == 0;
    let mut cursor = if horizontal { bounds.x } else { bounds.y };
    for index in indices {
        let value = subtree_value(chart, *index);
        let share = value / total;
        let child_bounds = if horizontal {
            let width = bounds.width * share;
            let child = Bounds { x: cursor, y: bounds.y, width, height: bounds.height };
            cursor += width;
            child
        } else {
            let height = bounds.height * share;
            let child = Bounds { x: bounds.x, y: cursor, width: bounds.width, height };
            cursor += height;
            child
        };
        let node = &chart.nodes[*index];
        let children = child_indices(chart, &node.label);
        result.push(TreemapNodeLayout {
            label: node.label.clone(),
            value,
            bounds: child_bounds,
            depth,
            is_leaf: children.is_empty(),
        });
        if !children.is_empty() {
            let content = Bounds {
                x: child_bounds.x + GROUP_INSET,
                y: child_bounds.y + GROUP_LABEL_HEIGHT,
                width: (child_bounds.width - GROUP_INSET * 2.0).max(0.0),
                height: (child_bounds.height - GROUP_LABEL_HEIGHT - GROUP_INSET).max(0.0),
            };
            layout_children(chart, &children, content, depth + 1, result);
        }
    }
}

fn child_indices(chart: &TreemapAst, parent: &str) -> Vec<usize> {
    chart.nodes.iter().enumerate()
        .filter_map(|(index, node)| (node.parent.as_deref() == Some(parent)).then_some(index))
        .collect()
}

fn subtree_value(chart: &TreemapAst, index: usize) -> f64 {
    let node = &chart.nodes[index];
    match node.value {
        Some(value) => value,
        None => child_indices(chart, &node.label).iter().map(|child| subtree_value(chart, *child)).sum(),
    }
}
