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

    // Build forward adjacency and compute in-degrees
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    let mut in_degree = vec![0usize; node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) = (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str())) {
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
        if let (Some(&from), Some(&to)) = (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str())) {
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

    // ── Rank balancing: promote nodes upward when possible ────────────
    // After longest-path layering, some nodes can be shifted up without
    // violating edge constraints. We compact layers from the top.
    // Re-assign layers so that sources are at 0 and each node is as
    // high as possible while respecting all forward edges.
    // The longest-path algorithm already does this correctly, so
    // rank balancing here means: renumber layers to be contiguous from 0.
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
    // Run a few iterations of barycenter sorting to reduce edge crossings.
    // Build forward adjacency (excluding back-edges) for the heuristic.
    let mut clean_adj: Vec<Vec<usize>> = vec![Vec::new(); node_count];
    for edge in &fc.edges {
        if let (Some(&from), Some(&to)) = (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str())) {
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
        if let (Some(&from), Some(&to)) = (node_index.get(edge.from.as_str()), node_index.get(edge.to.as_str())) {
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

    // Map from node index to its current position within its layer
    // (position = index within layer_groups[layer])
    let num_layers = layer_groups.len();
    const CROSSING_MIN_ITERATIONS: usize = 3;

    for _iteration in 0..CROSSING_MIN_ITERATIONS {
        // Forward pass: order layer k by barycenter of neighbors in layer k-1
        for k in 1..num_layers {
            // Build a map: node_index -> position in previous layer
            let mut prev_position: std::collections::HashMap<usize, f64> =
                std::collections::HashMap::new();
            for (pos, &node_idx) in layer_groups[k - 1].iter().enumerate() {
                prev_position.insert(node_idx, pos as f64);
            }

            // Compute barycenter for each node in current layer
            let mut barycenters: Vec<(usize, f64)> = Vec::new();
            for &node_idx in &layer_groups[k] {
                let neighbors_in_prev: Vec<usize> = clean_rev_adj[node_idx]
                    .iter()
                    .filter(|&&n| layers[n] == k - 1)
                    .copied()
                    .collect();

                let bary = if neighbors_in_prev.is_empty() {
                    // No neighbors in previous layer: use current position as tiebreaker
                    layer_groups[k].iter().position(|&n| n == node_idx).unwrap_or(0) as f64
                } else {
                    let sum: f64 = neighbors_in_prev
                        .iter()
                        .map(|n| prev_position.get(n).copied().unwrap_or(0.0))
                        .sum();
                    sum / neighbors_in_prev.len() as f64
                };
                barycenters.push((node_idx, bary));
            }

            // Sort by barycenter (stable to preserve relative order for ties)
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
                    layer_groups[k].iter().position(|&n| n == node_idx).unwrap_or(0) as f64
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
    let is_horizontal = matches!(fc.direction, FlowDirection::LR | FlowDirection::RL);
    let mut positions: Vec<(String, Point)> = Vec::with_capacity(node_count);

    // First pass: position nodes left-to-right per layer (no centering yet)
    for (layer_idx, group) in layer_groups.iter().enumerate() {
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

    // ── Center nodes within layers ──────────────────────────────────
    // Compute the width of the widest layer (or tallest for horizontal)
    // and shift each layer to be centered relative to it.
    if !is_horizontal {
        // Center each layer horizontally relative to the widest layer
        let mut layer_widths: Vec<f64> = Vec::with_capacity(layer_groups.len());
        for group in &layer_groups {
            let width = if group.is_empty() {
                0.0
            } else {
                group.len() as f64 * NODE_WIDTH + group.len().saturating_sub(1) as f64 * H_SPACING
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
                    let entry = positions.iter_mut().find(|(id, _)| id == &fc.nodes[node_idx].id).unwrap();
                    entry.1.x += shift;
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
                group.len() as f64 * NODE_HEIGHT + group.len().saturating_sub(1) as f64 * V_SPACING
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
                    let entry = positions.iter_mut().find(|(id, _)| id == &fc.nodes[node_idx].id).unwrap();
                    entry.1.y += shift;
                }
            }
        }
    }

    // ── BT/RL reversal ───────────────────────────────────────────────
    // After computing positions as if TD/LR, mirror coordinates for
    // reversed directions.
    if fc.direction == FlowDirection::BT {
        // Reverse y: mirror vertically so source is below target
        let max_y = positions.iter().map(|(_, p)| p.y).fold(f64::MIN, f64::max);
        for (_, p) in &mut positions {
            p.y = max_y - p.y;
        }
    } else if fc.direction == FlowDirection::RL {
        // Reverse x: mirror horizontally so source is right of target
        let max_x = positions.iter().map(|(_, p)| p.x).fold(f64::MIN, f64::max);
        for (_, p) in &mut positions {
            p.x = max_x - p.x;
        }
    }

    // ── Compute dimensions ───────────────────────────────────────────
    // Ensure no negative coordinates after reversal
    let min_x = positions.iter().map(|(_, p)| p.x).fold(f64::MAX, f64::min);
    let min_y = positions.iter().map(|(_, p)| p.y).fold(f64::MAX, f64::min);
    if min_x < 0.0 {
        for (_, p) in &mut positions {
            p.x -= min_x;
        }
    }
    if min_y < 0.0 {
        for (_, p) in &mut positions {
            p.y -= min_y;
        }
    }

    // Compute final dimensions
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
