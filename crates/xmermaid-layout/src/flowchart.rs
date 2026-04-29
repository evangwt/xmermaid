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
use xmermaid_parser::ast::{EdgeStyle as ParserEdgeStyle, FlowchartAst, NodeShape as ParserNodeShape};

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

fn map_edge_style(style: &ParserEdgeStyle) -> crate::types::EdgeStyle {
    match style {
        ParserEdgeStyle::Arrow => crate::types::EdgeStyle::Arrow,
        ParserEdgeStyle::Line => crate::types::EdgeStyle::Line,
        ParserEdgeStyle::Dotted => crate::types::EdgeStyle::Dotted,
        ParserEdgeStyle::Thick => crate::types::EdgeStyle::Thick,
        ParserEdgeStyle::Invisible => crate::types::EdgeStyle::Invisible,
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

    // ── Compute bounding extremes before edge routing ─────────────────
    let max_x = centers
        .iter()
        .map(|p| p.x + node_width / 2.0)
        .fold(0.0_f64, f64::max);
    let max_y = centers
        .iter()
        .map(|p| p.y + node_height / 2.0)
        .fold(0.0_f64, f64::max);
    let min_y = centers
        .iter()
        .map(|p| p.y - node_height / 2.0)
        .fold(f64::MAX, f64::min);

    // Route offset for back-edges: beyond the diagram boundary.
    // Only computed/used when back-edges exist.
    let has_back_edges = !back_edge_set.is_empty();
    let route_x = max_x + h_spacing * 0.75;
    let route_y = min_y - v_spacing * 0.75;

    // ── Build LayoutEdges ────────────────────────────────────────────
    let edges: Vec<LayoutEdge> = fc
        .edges
        .iter()
        .map(|edge| {
            let from_idx_opt = node_index.get(edge.from.as_str()).copied();
            let to_idx_opt = node_index.get(edge.to.as_str()).copied();
            let from_center = from_idx_opt.map(|idx| centers[idx]);
            let to_center = to_idx_opt.map(|idx| centers[idx]);

            let waypoints = match (from_center, to_center, from_idx_opt, to_idx_opt) {
                (Some(from), Some(to), Some(from_idx), Some(to_idx)) => {
                    let is_back = back_edge_set.contains(&(from_idx, to_idx));

                    if is_back {
                        // Back-edge: route around the side of the diagram
                        if is_horizontal {
                            // LR/RL: route above the diagram
                            vec![
                                from,
                                Point { x: from.x, y: route_y },
                                Point { x: to.x, y: route_y },
                                to,
                            ]
                        } else {
                            // TB/BT: route to the right side
                            vec![
                                from,
                                Point { x: route_x, y: from.y },
                                Point { x: route_x, y: to.y },
                                to,
                            ]
                        }
                    } else {
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
                }
                _ => vec![],
            };

            let label_position = if let (Some(from), Some(to)) = (from_center, to_center) {
                if waypoints.len() > 2 {
                    // For back-edges or multi-waypoint edges, place label at the
                    // midpoint of the routing segment (the outer segment)
                    let mid_idx = waypoints.len() / 2;
                    Some(Point {
                        x: (waypoints[mid_idx - 1].x + waypoints[mid_idx].x) / 2.0,
                        y: (waypoints[mid_idx - 1].y + waypoints[mid_idx].y) / 2.0,
                    })
                } else {
                    Some(Point {
                        x: (from.x + to.x) / 2.0,
                        y: (from.y + to.y) / 2.0,
                    })
                }
            } else {
                None
            };

            LayoutEdge {
                from: edge.from.clone(),
                to: edge.to.clone(),
                waypoints,
                label: edge.label.clone(),
                label_position,
                style: map_edge_style(&edge.style),
            }
        })
        .collect();

    // ── Compute final dimensions ─────────────────────────────────────
    // Expand dimensions and shift coordinates to accommodate back-edge routing.
    // Only applies when back-edges exist; otherwise, dimensions remain unchanged.
    let (final_nodes, final_edges, final_width, final_height) = if has_back_edges {
        // For LR/RL, route_y goes above the topmost node. Since coordinates
        // must stay positive, shift everything down if route_y < padding.
        let y_shift = if is_horizontal && route_y < padding {
            padding - route_y
        } else {
            0.0
        };

        let mut shifted_nodes = nodes;
        let mut shifted_edges = edges;

        if y_shift > 0.0 {
            for node in &mut shifted_nodes {
                node.center.y += y_shift;
                node.bounds.y += y_shift;
            }
            for edge in &mut shifted_edges {
                for wp in &mut edge.waypoints {
                    wp.y += y_shift;
                }
                if let Some(ref mut lp) = edge.label_position {
                    lp.y += y_shift;
                }
            }
        }

        let width = if !is_horizontal {
            // TB/BT: route_x extends to the right
            (max_x + padding).max(route_x + h_spacing * 0.25 + padding)
        } else {
            max_x + padding
        };
        let height = max_y + y_shift + padding;

        (shifted_nodes, shifted_edges, width, height)
    } else {
        let width = max_x + padding;
        let height = max_y + padding;
        (nodes, edges, width, height)
    };

    LayoutResult {
        nodes: final_nodes,
        edges: final_edges,
        dimensions: Dimensions {
            width: final_width,
            height: final_height,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use xmermaid_parser::parse;

    fn layout_from_dsl(dsl: &str) -> LayoutResult {
        let ast = parse(dsl).unwrap();
        match &ast {
            xmermaid_parser::ast::DiagramAst::Flowchart(fc) => {
                let mut config = LayoutConfig::default();
                config.direction = match fc.direction {
                    xmermaid_parser::ast::FlowDirection::TD => FlowDirection::TB,
                    xmermaid_parser::ast::FlowDirection::BT => FlowDirection::BT,
                    xmermaid_parser::ast::FlowDirection::LR => FlowDirection::LR,
                    xmermaid_parser::ast::FlowDirection::RL => FlowDirection::RL,
                };
                layout(fc, &config)
            }
            _ => panic!("Expected Flowchart"),
        }
    }

    #[test]
    fn test_single_node() {
        let result = layout_from_dsl("graph TD\n  A");
        assert_eq!(result.nodes.len(), 1);
        assert_eq!(result.nodes[0].id, "A");
        // Bare node IDs have no label in the parser, so layout uses empty string
        assert_eq!(result.nodes[0].label, "");
        assert!(result.dimensions.width > 0.0);
        assert!(result.dimensions.height > 0.0);
    }

    #[test]
    fn test_two_nodes_vertical() {
        let result = layout_from_dsl("graph TD\n  A-->B");
        assert_eq!(result.nodes.len(), 2);
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        assert!(a.center.y < b.center.y, "A should be above B in TD");
    }

    #[test]
    fn test_two_nodes_horizontal() {
        let result = layout_from_dsl("graph LR\n  A-->B");
        assert_eq!(result.nodes.len(), 2);
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        assert!(a.center.x < b.center.x, "A should be left of B in LR");
    }

    #[test]
    fn test_diamond_topology() {
        let result = layout_from_dsl("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D");
        assert_eq!(result.nodes.len(), 4);
        assert_eq!(result.edges.len(), 4);
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let d = result.nodes.iter().find(|n| n.id == "D").unwrap();
        assert!(a.center.y < d.center.y, "A should be above D");
    }

    #[test]
    fn test_self_loop_excluded() {
        let result = layout_from_dsl("graph TD\n  A-->A\n  A-->B");
        assert_eq!(result.nodes.len(), 2);
        // Self-loop edge should still be in edges
        assert_eq!(result.edges.len(), 2);
    }

    #[test]
    fn test_node_bounds_contain_center() {
        let result = layout_from_dsl("graph TD\n  A[Hello]-->B[World]");
        for node in &result.nodes {
            assert!(node.bounds.x <= node.center.x);
            assert!(node.bounds.y <= node.center.y);
            assert!(node.center.x <= node.bounds.x + node.bounds.width);
            assert!(node.center.y <= node.bounds.y + node.bounds.height);
        }
    }

    #[test]
    fn test_no_negative_coordinates() {
        let result = layout_from_dsl("graph TD\n  A-->B\n  B-->C\n  C-->D");
        for node in &result.nodes {
            assert!(node.center.x > 0.0, "Node {} has negative x", node.id);
            assert!(node.center.y > 0.0, "Node {} has negative y", node.id);
        }
    }

    #[test]
    fn test_dimensions_encompass_all_nodes() {
        let result = layout_from_dsl("graph TD\n  A-->B\n  B-->C");
        for node in &result.nodes {
            assert!(
                node.center.x + node.bounds.width / 2.0 <= result.dimensions.width,
                "Node {} right edge exceeds width",
                node.id
            );
            assert!(
                node.center.y + node.bounds.height / 2.0 <= result.dimensions.height,
                "Node {} bottom edge exceeds height",
                node.id
            );
        }
    }

    #[test]
    fn test_edge_waypoints() {
        let result = layout_from_dsl("graph TD\n  A-->B");
        assert_eq!(result.edges.len(), 1);
        let edge = &result.edges[0];
        assert_eq!(edge.from, "A");
        assert_eq!(edge.to, "B");
        assert!(edge.waypoints.len() >= 2);
    }

    #[test]
    fn test_cross_rank_edge_has_midpoint() {
        let result = layout_from_dsl("graph TD\n  A-->B-->C\n  A-->C");
        // A-->C is a cross-rank edge (skips B's layer)
        let ac_edge = result.edges.iter().find(|e| e.from == "A" && e.to == "C").unwrap();
        assert_eq!(ac_edge.waypoints.len(), 3, "Cross-rank edge should have midpoint");
    }

    #[test]
    fn test_shape_mapping() {
        let result = layout_from_dsl("graph TD\n  A[rect] B(rounded) C((circle))");
        assert_eq!(result.nodes[0].shape, NodeShape::Rectangle);
        assert_eq!(result.nodes[1].shape, NodeShape::RoundedRect);
        assert_eq!(result.nodes[2].shape, NodeShape::Circle);
    }

    #[test]
    fn test_empty_flowchart() {
        let result = layout_from_dsl("graph TD");
        assert_eq!(result.nodes.len(), 0);
        assert_eq!(result.edges.len(), 0);
    }

    #[test]
    fn test_bt_direction() {
        let result = layout_from_dsl("graph BT\n  A-->B");
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        assert!(a.center.y > b.center.y, "A should be below B in BT");
    }

    #[test]
    fn test_rl_direction() {
        let result = layout_from_dsl("graph RL\n  A-->B");
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();
        assert!(a.center.x > b.center.x, "A should be right of B in RL");
    }

    #[test]
    fn test_back_edge_routes_around_right_side_tb() {
        // A-->B-->C-->A creates a back-edge from C to A
        let result = layout_from_dsl("graph TD\n  A-->B\n  B-->C\n  C-->A");
        let back_edge = result.edges.iter().find(|e| e.from == "C" && e.to == "A").unwrap();
        // Back-edge should have 4 waypoints: from, right-side point at from.y,
        // right-side point at to.y, to
        assert_eq!(back_edge.waypoints.len(), 4, "Back-edge should have 4 waypoints");

        let from = back_edge.waypoints[0];
        let wp1 = back_edge.waypoints[1];
        let wp2 = back_edge.waypoints[2];
        let to = back_edge.waypoints[3];

        // The routing waypoints should be to the right of all nodes
        let max_node_x = result.nodes.iter().map(|n| n.center.x).fold(f64::MIN, f64::max);
        assert!(wp1.x > max_node_x, "Route waypoint x should be beyond rightmost node");
        assert!(wp2.x > max_node_x, "Route waypoint x should be beyond rightmost node");

        // The routing waypoints should preserve from.y and to.y respectively
        assert_eq!(wp1.y, from.y, "First route point should be at from.y");
        assert_eq!(wp2.y, to.y, "Second route point should be at to.y");
    }

    #[test]
    fn test_back_edge_routes_above_lr() {
        // A-->B-->C-->A creates a back-edge from C to A
        let result = layout_from_dsl("graph LR\n  A-->B\n  B-->C\n  C-->A");
        let back_edge = result.edges.iter().find(|e| e.from == "C" && e.to == "A").unwrap();
        assert_eq!(back_edge.waypoints.len(), 4, "Back-edge should have 4 waypoints");

        let from = back_edge.waypoints[0];
        let wp1 = back_edge.waypoints[1];
        let wp2 = back_edge.waypoints[2];
        let to = back_edge.waypoints[3];

        // The routing waypoints should be above all nodes
        let min_node_y = result.nodes.iter().map(|n| n.center.y).fold(f64::MAX, f64::min);
        assert!(wp1.y < min_node_y, "Route waypoint y should be above topmost node");
        assert!(wp2.y < min_node_y, "Route waypoint y should be above topmost node");

        // The routing waypoints should preserve from.x and to.x respectively
        assert_eq!(wp1.x, from.x, "First route point should be at from.x");
        assert_eq!(wp2.x, to.x, "Second route point should be at to.x");
    }

    #[test]
    fn test_forward_edge_not_routed_as_back_edge() {
        // A-->B is a normal forward edge, should have 2 waypoints
        let result = layout_from_dsl("graph TD\n  A-->B\n  B-->C\n  C-->A");
        let forward_edge = result.edges.iter().find(|e| e.from == "A" && e.to == "B").unwrap();
        assert!(forward_edge.waypoints.len() <= 3, "Forward edge should not be routed as back-edge");
    }

    #[test]
    fn test_back_edge_dimensions_expand_tb() {
        let result = layout_from_dsl("graph TD\n  A-->B\n  B-->C\n  C-->A");
        // All waypoints should fit within the diagram dimensions
        for edge in &result.edges {
            for wp in &edge.waypoints {
                assert!(
                    wp.x <= result.dimensions.width,
                    "Waypoint x={} exceeds width={}",
                    wp.x,
                    result.dimensions.width
                );
            }
        }
    }

    #[test]
    fn test_back_edge_no_negative_coordinates() {
        let result = layout_from_dsl("graph TD\n  A-->B\n  B-->C\n  C-->A");
        for edge in &result.edges {
            for wp in &edge.waypoints {
                assert!(wp.x > 0.0, "Waypoint has negative x");
                assert!(wp.y > 0.0, "Waypoint has negative y");
            }
        }
    }
}
