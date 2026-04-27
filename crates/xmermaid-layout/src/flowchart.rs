//! Flowchart layout engine using Sugiyama-style layered graph drawing.
//!
//! Algorithm stages:
//! 1. Cycle detection via DFS (back-edges excluded from layering)
//! 2. Longest-path layering (assigns nodes to layers)
//! 3. Layer compaction (renumber layers contiguously from 0)
//! 4. Barycenter crossing minimization (forward + backward passes)
//! 5. Center nodes within layers
//! 6. BT/RL coordinate reversal
//! 7. Normalization (ensure no node extends beyond left/top boundary)

use crate::types::{
    Bounds, Dimensions, FlowDirection, LayoutConfig, LayoutEdge, LayoutNode, LayoutResult,
    NodeShape, Point,
};
use xmermaid_parser::ast::{FlowchartAst, NodeShape as ParserNodeShape};

/// Map parser NodeShape to layout NodeShape.
/// Some shapes are simplified for layout purposes.
fn map_shape(parser_shape: &ParserNodeShape) -> NodeShape {
    match parser_shape {
        ParserNodeShape::Rect => NodeShape::Rectangle,
        ParserNodeShape::Rounded => NodeShape::RoundedRect,
        ParserNodeShape::Circle => NodeShape::Circle,
        ParserNodeShape::DoubleCircle => NodeShape::Circle,     // simplify
        ParserNodeShape::Diamond => NodeShape::Diamond,
        ParserNodeShape::Hexagon => NodeShape::Hexagon,
        ParserNodeShape::Stadium => NodeShape::Stadium,
        ParserNodeShape::Subroutine => NodeShape::Rectangle,     // simplify
        ParserNodeShape::Parallelogram => NodeShape::Parallelogram,
        ParserNodeShape::Trapezoid => NodeShape::Trapezoid,
        ParserNodeShape::Asymmetric => NodeShape::Rectangle,     // simplify
        ParserNodeShape::Cylinder => NodeShape::Rectangle,       // simplify
    }
}

/// Compute layout for a flowchart diagram.
///
/// Takes a `FlowchartAst` directly (not a `DiagramAst`) and a `LayoutConfig`,
/// and returns a `LayoutResult` with positioned nodes and edges.
pub fn layout(fc: &FlowchartAst, config: &LayoutConfig) -> LayoutResult {
    let node_width = config.node_width;
    let node_height = config.node_height;
    let h_spacing = config.h_spacing;
    let v_spacing = config.v_spacing;
    let padding = config.padding;
    let is_horizontal = matches!(config.direction, FlowDirection::LR | FlowDirection::RL);

    if fc.nodes.is_empty() {
        return LayoutResult {
            nodes: vec![],
            edges: vec![],
            dimensions: Dimensions {
                width: padding * 2.0,
                height: padding * 2.0,
            },
        };
    }

    let node_count = fc.nodes.len();
    let node_ids: Vec<&str> = fc.nodes.iter().map(|n| n.id.as_str()).collect();
    let node_index: std::collections::HashMap<&str, usize> = node_ids
        .iter()
        .enumerate()
        .map(|(i, &id)| (id, i))
        .collect();

    // Build forward adjacency and compute in-degrees
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    let mut in_degree = vec![0usize; node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) =
            (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str()))
        {
            // Skip self-loops
            if from == to {
                continue;
            }
            adj[from].push(to);
            in_degree[to] += 1;
        }
    }

    // Deduplicate adjacency lists (multiple edges between same pair)
    for list in &mut adj {
        list.sort();
        list.dedup();
    }

    // ── Cycle detection via DFS ──────────────────────────────────────
    // Detect back-edges and mark them for exclusion from layering.
    // DFS states: 0 = unvisited, 1 = in-progress, 2 = done
    let mut dfs_state = vec![0u8; node_count];
    let mut is_back_edge: Vec<(usize, usize, bool)> = Vec::new(); // (from, to, is_back)

    fn dfs_cycle(
        node: usize,
        adj: &[Vec<usize>],
        dfs_state: &mut [u8],
        is_back_edge: &mut Vec<(usize, usize, bool)>,
    ) {
        dfs_state[node] = 1; // in-progress
        for &neighbor in &adj[node] {
            match dfs_state[neighbor] {
                0 => {
                    is_back_edge.push((node, neighbor, false));
                    dfs_cycle(neighbor, adj, dfs_state, is_back_edge);
                }
                1 => {
                    // Back-edge: neighbor is an ancestor in the DFS tree
                    is_back_edge.push((node, neighbor, true));
                }
                _ => {
                    // Cross/forward edge — not a back-edge
                    is_back_edge.push((node, neighbor, false));
                }
            }
        }
        dfs_state[node] = 2; // done
    }

    for i in 0..node_count {
        if dfs_state[i] == 0 {
            dfs_cycle(i, &adj, &mut dfs_state, &mut is_back_edge);
        }
    }

    // Build a set of back-edge pairs for quick lookup
    let back_edge_set: std::collections::HashSet<(usize, usize)> = is_back_edge
        .iter()
        .filter(|(_, _, is_back)| *is_back)
        .map(|(from, to, _)| (*from, *to))
        .collect();

    // ── Longest-path layering (excluding back-edges) ─────────────────
    // Build reverse adjacency excluding back-edges
    let mut rev_adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) =
            (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str()))
        {
            if from == to {
                continue;
            }
            // Skip back-edges
            if back_edge_set.contains(&(from, to)) {
                continue;
            }
            rev_adj[to].push(from);
        }
    }

    // Deduplicate reverse adjacency
    for list in &mut rev_adj {
        list.sort();
        list.dedup();
    }

    let mut layers = vec![0usize; node_count];
    let mut visited = vec![false; node_count];

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

    // ── Rank balancing: renumber layers to be contiguous from 0 ──────
    let mut layer_values: Vec<usize> = layers.iter().copied().collect();
    layer_values.sort();
    layer_values.dedup();
    let layer_remap: std::collections::HashMap<usize, usize> = layer_values
        .iter()
        .enumerate()
        .map(|(i, &v)| (v, i))
        .collect();
    for l in &mut layers {
        *l = *layer_remap.get(l).unwrap_or(l);
    }

    // ── Group nodes by layer ─────────────────────────────────────────
    let max_layer = layers.iter().copied().max().unwrap_or(0);
    let mut layer_groups: Vec<Vec<usize>> = vec![Vec::new(); max_layer + 1];
    for (i, &layer) in layers.iter().enumerate() {
        layer_groups[layer].push(i);
    }

    // ── Crossing minimization: barycenter heuristic ──────────────────
    // Build forward adjacency (excluding back-edges) for the heuristic.
    let mut clean_adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) =
            (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str()))
        {
            if from == to {
                continue;
            }
            if back_edge_set.contains(&(from, to)) {
                continue;
            }
            clean_adj[from].push(to);
        }
    }
    for list in &mut clean_adj {
        list.sort();
        list.dedup();
    }

    // Reverse adjacency for the heuristic
    let mut clean_rev_adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) =
            (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str()))
        {
            if from == to {
                continue;
            }
            if back_edge_set.contains(&(from, to)) {
                continue;
            }
            clean_rev_adj[to].push(from);
        }
    }
    for list in &mut clean_rev_adj {
        list.sort();
        list.dedup();
    }

    // Barycenter crossing minimization iterations
    let num_layers = layer_groups.len();
    const CROSSING_MIN_ITERATIONS: usize = 3;

    for _iteration in 0..CROSSING_MIN_ITERATIONS {
        // Forward pass: order layer k by barycenter of neighbors in layer k-1
        for k in 1..num_layers {
            let mut prev_position: std::collections::HashMap<usize, f64> =
                std::collections::HashMap::new();
            for (pos, &node_idx) in layer_groups[k - 1].iter().enumerate() {
                prev_position.insert(node_idx, pos as f64);
            }

            let mut barycenters: Vec<(usize, f64)> = Vec::new();
            for &node_idx in &layer_groups[k] {
                let neighbors_in_prev: Vec<usize> = clean_rev_adj[node_idx]
                    .iter()
                    .filter(|&&n| layers[n] == k - 1)
                    .copied()
                    .collect();

                let bary = if neighbors_in_prev.is_empty() {
                    layer_groups[k]
                        .iter()
                        .position(|&n| n == node_idx)
                        .unwrap_or(0) as f64
                } else {
                    let sum: f64 = neighbors_in_prev
                        .iter()
                        .map(|n| prev_position.get(n).copied().unwrap_or(0.0))
                        .sum();
                    sum / neighbors_in_prev.len() as f64
                };
                barycenters.push((node_idx, bary));
            }

            barycenters.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
            layer_groups[k] = barycenters.iter().map(|(idx, _)| *idx).collect();
        }

        // Backward pass: order layer k by barycenter of neighbors in layer k+1
        for k in (0..num_layers.saturating_sub(1)).rev() {
            let mut next_position: std::collections::HashMap<usize, f64> =
                std::collections::HashMap::new();
            for (pos, &node_idx) in layer_groups[k + 1].iter().enumerate() {
                next_position.insert(node_idx, pos as f64);
            }

            let mut barycenters: Vec<(usize, f64)> = Vec::new();
            for &node_idx in &layer_groups[k] {
                let neighbors_in_next: Vec<usize> = clean_adj[node_idx]
                    .iter()
                    .filter(|&&n| layers[n] == k + 1)
                    .copied()
                    .collect();

                let bary = if neighbors_in_next.is_empty() {
                    layer_groups[k]
                        .iter()
                        .position(|&n| n == node_idx)
                        .unwrap_or(0) as f64
                } else {
                    let sum: f64 = neighbors_in_next
                        .iter()
                        .map(|n| next_position.get(n).copied().unwrap_or(0.0))
                        .sum();
                    sum / neighbors_in_next.len() as f64
                };
                barycenters.push((node_idx, bary));
            }

            barycenters.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
            layer_groups[k] = barycenters.iter().map(|(idx, _)| *idx).collect();
        }
    }

    // ── Assign positions based on direction ──────────────────────────
    // Temporary storage: node index -> center Point
    let mut centers: Vec<Point> = vec![Point { x: 0.0, y: 0.0 }; node_count];

    // First pass: position nodes left-to-right per layer (no centering yet)
    for (layer_idx, group) in layer_groups.iter().enumerate() {
        for (pos_in_layer, &node_idx) in group.iter().enumerate() {
            let x = if is_horizontal {
                padding + layer_idx as f64 * (node_width + h_spacing)
            } else {
                padding + pos_in_layer as f64 * (node_width + h_spacing)
            };
            let y = if is_horizontal {
                padding + pos_in_layer as f64 * (node_height + v_spacing)
            } else {
                padding + layer_idx as f64 * (node_height + v_spacing)
            };
            centers[node_idx] = Point { x, y };
        }
    }

    // ── Center nodes within layers ──────────────────────────────────
    if !is_horizontal {
        // Center each layer horizontally relative to the widest layer
        let mut layer_widths: Vec<f64> = Vec::with_capacity(layer_groups.len());
        for group in &layer_groups {
            let width = if group.is_empty() {
                0.0
            } else {
                group.len() as f64 * node_width
                    + group.len().saturating_sub(1) as f64 * h_spacing
            };
            layer_widths.push(width);
        }
        let max_width = layer_widths.iter().copied().fold(0.0_f64, f64::max);

        for (layer_idx, group) in layer_groups.iter().enumerate() {
            if group.is_empty() {
                continue;
            }
            let layer_width = layer_widths[layer_idx];
            let shift = (max_width - layer_width) / 2.0;
            if shift > 0.0 {
                for &node_idx in group {
                    centers[node_idx].x += shift;
                }
            }
        }
    } else {
        // Center each layer vertically relative to the tallest layer
        let mut layer_heights: Vec<f64> = Vec::with_capacity(layer_groups.len());
        for group in &layer_groups {
            let height = if group.is_empty() {
                0.0
            } else {
                group.len() as f64 * node_height
                    + group.len().saturating_sub(1) as f64 * v_spacing
            };
            layer_heights.push(height);
        }
        let max_height = layer_heights.iter().copied().fold(0.0_f64, f64::max);

        for (layer_idx, group) in layer_groups.iter().enumerate() {
            if group.is_empty() {
                continue;
            }
            let layer_height = layer_heights[layer_idx];
            let shift = (max_height - layer_height) / 2.0;
            if shift > 0.0 {
                for &node_idx in group {
                    centers[node_idx].y += shift;
                }
            }
        }
    }

    // ── BT/RL reversal ───────────────────────────────────────────────
    if config.direction == FlowDirection::BT {
        // Reverse y: mirror vertically so source is below target
        let max_y = centers.iter().map(|p| p.y).fold(f64::MIN, f64::max);
        for p in &mut centers {
            p.y = max_y - p.y;
        }
    } else if config.direction == FlowDirection::RL {
        // Reverse x: mirror horizontally so source is right of target
        let max_x = centers.iter().map(|p| p.x).fold(f64::MIN, f64::max);
        for p in &mut centers {
            p.x = max_x - p.x;
        }
    }

    // ── Normalize: ensure no node extends beyond left/top boundary ───
    let min_x = centers
        .iter()
        .map(|p| p.x - node_width / 2.0)
        .fold(f64::MAX, f64::min);
    let min_y = centers
        .iter()
        .map(|p| p.y - node_height / 2.0)
        .fold(f64::MAX, f64::min);
    if min_x < padding {
        let shift = padding - min_x;
        for p in &mut centers {
            p.x += shift;
        }
    }
    if min_y < padding {
        let shift = padding - min_y;
        for p in &mut centers {
            p.y += shift;
        }
    }

    // ── Build LayoutNodes ────────────────────────────────────────────
    let nodes: Vec<LayoutNode> = fc
        .nodes
        .iter()
        .enumerate()
        .map(|(i, node)| LayoutNode {
            id: node.id.clone(),
            center: centers[i],
            bounds: Bounds::from_center(centers[i], node_width, node_height),
            shape: map_shape(&node.shape),
            label: node.label.clone().unwrap_or_default(),
        })
        .collect();

    // ── Build LayoutEdges ────────────────────────────────────────────
    let edges: Vec<LayoutEdge> = fc
        .edges
        .iter()
        .map(|edge| {
            let from_center = node_index
                .get(edge.from.as_str())
                .map(|&idx| centers[idx]);
            let to_center = node_index
                .get(edge.to.as_str())
                .map(|&idx| centers[idx]);

            let waypoints = match (from_center, to_center) {
                (Some(from), Some(to)) => {
                    // For edges that cross layers, add a midpoint
                    let from_idx = node_index[edge.from.as_str()];
                    let to_idx = node_index[edge.to.as_str()];
                    let from_layer = layers[from_idx];
                    let to_layer = layers[to_idx];

                    if (to_layer as isize - from_layer as isize).abs() > 1 {
                        // Cross-rank edge: insert midpoint
                        let mid = Point {
                            x: (from.x + to.x) / 2.0,
                            y: (from.y + to.y) / 2.0,
                        };
                        vec![from, mid, to]
                    } else {
                        vec![from, to]
                    }
                }
                _ => vec![],
            };

            let label_position = if let (Some(from), Some(to)) = (from_center, to_center) {
                Some(Point {
                    x: (from.x + to.x) / 2.0,
                    y: (from.y + to.y) / 2.0,
                })
            } else {
                None
            };

            LayoutEdge {
                from: edge.from.clone(),
                to: edge.to.clone(),
                waypoints,
                label: edge.label.clone(),
                label_position,
            }
        })
        .collect();

    // ── Compute final dimensions ─────────────────────────────────────
    let max_x = centers
        .iter()
        .map(|p| p.x + node_width / 2.0)
        .fold(0.0_f64, f64::max);
    let max_y = centers
        .iter()
        .map(|p| p.y + node_height / 2.0)
        .fold(0.0_f64, f64::max);

    LayoutResult {
        nodes,
        edges,
        dimensions: Dimensions {
            width: max_x + padding,
            height: max_y + padding,
        },
    }
}
