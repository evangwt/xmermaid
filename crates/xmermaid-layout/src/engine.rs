use crate::coordinate::{Dimensions, Point};
use crate::{LayoutError, LayoutResult};
use xmermaid_parser::{DiagramAst, FlowDirection};

const NODE_WIDTH: f64 = 120.0;
const NODE_HEIGHT: f64 = 40.0;
const H_SPACING: f64 = 60.0;
const V_SPACING: f64 = 60.0;
const PADDING: f64 = 40.0;

pub fn compute_flowchart_layout(ast: &DiagramAst) -> Result<LayoutResult, LayoutError> {
    let fc = match ast {
        DiagramAst::Flowchart(fc) => fc,
        _ => return Err(LayoutError::UnsupportedDiagramType),
    };

    if fc.nodes.is_empty() {
        return Ok(LayoutResult {
            positions: Vec::new(),
            dimensions: Dimensions {
                width: PADDING * 2.0,
                height: PADDING * 2.0,
            },
        });
    }

    // Build adjacency for topological layering
    let node_count = fc.nodes.len();
    let node_ids: Vec<&str> = fc.nodes.iter().map(|n| n.id.as_str()).collect();
    let node_index: std::collections::HashMap<&str, usize> = node_ids
        .iter()
        .enumerate()
        .map(|(i, &id)| (id, i))
        .collect();

    // Compute in-degree for each node
    let mut in_degree = vec![0usize; node_count];
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) = (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str())) {
            adj[from].push(to);
            in_degree[to] += 1;
        }
    }

    // Longest-path layering: sources get higher layers (lower y in TD)
    let mut layers = vec![0usize; node_count];
    let mut visited = vec![false; node_count];

    // Reverse adjacency for longest path from sources
    let mut rev_adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) = (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str())) {
            rev_adj[to].push(from);
        }
    }

    fn assign_layers(
        node: usize,
        rev_adj: &[Vec<usize>],
        layers: &mut [usize],
        visited: &mut [bool],
    ) {
        if visited[node] {
            return;
        }
        visited[node] = true;
        for &prev in &rev_adj[node] {
            assign_layers(prev, rev_adj, layers, visited);
            layers[node] = layers[node].max(layers[prev] + 1);
        }
    }

    for i in 0..node_count {
        assign_layers(i, &rev_adj, &mut layers, &mut visited);
    }

    // Group nodes by layer
    let max_layer = layers.iter().copied().max().unwrap_or(0);
    let mut layer_groups: Vec<Vec<usize>> = vec![Vec::new(); max_layer + 1];
    for (i, &layer) in layers.iter().enumerate() {
        layer_groups[layer].push(i);
    }

    // Assign positions based on direction
    let is_horizontal = matches!(fc.direction, FlowDirection::LR | FlowDirection::RL);
    let mut positions: Vec<(String, Point)> = Vec::with_capacity(node_count);

    for (layer_idx, group) in layer_groups.iter().enumerate() {
        let _count = group.len();
        for (pos_in_layer, &node_idx) in group.iter().enumerate() {
            let x = if is_horizontal {
                PADDING + layer_idx as f64 * (NODE_WIDTH + H_SPACING)
            } else {
                PADDING + pos_in_layer as f64 * (NODE_WIDTH + H_SPACING)
            };
            let y = if is_horizontal {
                PADDING + pos_in_layer as f64 * (NODE_HEIGHT + V_SPACING)
            } else {
                PADDING + layer_idx as f64 * (NODE_HEIGHT + V_SPACING)
            };
            positions.push((fc.nodes[node_idx].id.clone(), Point { x, y }));
        }
    }

    // Compute dimensions
    let max_x = positions.iter().map(|(_, p)| p.x + NODE_WIDTH).fold(0.0_f64, f64::max);
    let max_y = positions.iter().map(|(_, p)| p.y + NODE_HEIGHT).fold(0.0_f64, f64::max);

    Ok(LayoutResult {
        positions,
        dimensions: Dimensions {
            width: max_x + PADDING,
            height: max_y + PADDING,
        },
    })
}