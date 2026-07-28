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

const GEOMETRY_VERSION: u8 = 2;
const DEFAULT_NODE_FONT_SIZE: f64 = 14.0;
const NODE_LABEL_HORIZONTAL_PADDING: f64 = 28.0;
const NODE_LABEL_VERTICAL_PADDING: f64 = 20.0;
const DEFAULT_EDGE_LABEL_FONT_SIZE: f64 = 12.0;
const EDGE_LABEL_HORIZONTAL_PADDING: f64 = 8.0;
const EDGE_LABEL_VERTICAL_PADDING: f64 = 6.0;
const MAX_LABEL_CHARS_PER_LINE: usize = 48;
const MAX_LABEL_LINES: usize = 8;
const NODE_LABEL_LINE_HEIGHT: f64 = 18.0;
const EDGE_LABEL_LINE_HEIGHT: f64 = 15.0;

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

fn rectangle_boundary_point(center: Point, toward: Point, bounds: Bounds) -> Point {
    let dx = toward.x - center.x;
    let dy = toward.y - center.y;

    if dx == 0.0 && dy == 0.0 {
        return center;
    }

    let mut t_min = f64::MAX;

    if dx > 0.0 {
        t_min = t_min.min((bounds.right() - center.x) / dx);
    } else if dx < 0.0 {
        t_min = t_min.min((bounds.left() - center.x) / dx);
    }

    if dy > 0.0 {
        t_min = t_min.min((bounds.bottom() - center.y) / dy);
    } else if dy < 0.0 {
        t_min = t_min.min((bounds.top() - center.y) / dy);
    }

    if !t_min.is_finite() || t_min < 0.0 {
        return center;
    }

    Point {
        x: center.x + dx * t_min,
        y: center.y + dy * t_min,
    }
}

fn polygon_boundary_point(center: Point, toward: Point, vertices: &[Point]) -> Point {
    let dx = toward.x - center.x;
    let dy = toward.y - center.y;
    if dx == 0.0 && dy == 0.0 {
        return center;
    }

    let mut t_max = -1.0_f64;
    for index in 0..vertices.len() {
        let start = vertices[index];
        let end = vertices[(index + 1) % vertices.len()];
        let segment_dx = end.x - start.x;
        let segment_dy = end.y - start.y;
        let denominator = dx * segment_dy - dy * segment_dx;
        if denominator.abs() < 1e-10 {
            continue;
        }

        let offset_x = start.x - center.x;
        let offset_y = start.y - center.y;
        let t = (offset_x * segment_dy - offset_y * segment_dx) / denominator;
        let u = (offset_x * dy - offset_y * dx) / denominator;
        if t > 0.0 && (0.0..=1.0).contains(&u) && t > t_max {
            t_max = t;
        }
    }

    if t_max <= 0.0 {
        center
    } else {
        Point {
            x: center.x + dx * t_max,
            y: center.y + dy * t_max,
        }
    }
}

fn circle_boundary_point(center: Point, toward: Point, radius: f64) -> Point {
    let dx = toward.x - center.x;
    let dy = toward.y - center.y;
    let length = (dx * dx + dy * dy).sqrt();
    if length == 0.0 {
        return center;
    }

    Point {
        x: center.x + dx / length * radius,
        y: center.y + dy / length * radius,
    }
}

fn stadium_boundary_point(center: Point, toward: Point, bounds: Bounds) -> Point {
    let dx = toward.x - center.x;
    let dy = toward.y - center.y;
    if dx == 0.0 && dy == 0.0 {
        return center;
    }

    let radius = bounds.height / 2.0;
    let half_straight_width = (bounds.width / 2.0 - radius).max(0.0);

    if dy != 0.0 {
        let vertical_t = radius / dy.abs();
        if (vertical_t * dx).abs() <= half_straight_width {
            return Point {
                x: center.x + dx * vertical_t,
                y: center.y + dy * vertical_t,
            };
        }
    }

    let cap_center = Point {
        x: center.x + if dx >= 0.0 { half_straight_width } else { -half_straight_width },
        y: center.y,
    };
    let offset_x = center.x - cap_center.x;
    let a = dx * dx + dy * dy;
    let b = 2.0 * offset_x * dx;
    let c = offset_x * offset_x - radius * radius;
    let discriminant = b * b - 4.0 * a * c;
    if discriminant < 0.0 {
        return rectangle_boundary_point(center, toward, bounds);
    }
    let sqrt_discriminant = discriminant.sqrt();
    let t1 = (-b - sqrt_discriminant) / (2.0 * a);
    let t2 = (-b + sqrt_discriminant) / (2.0 * a);
    let t = [t1, t2]
        .into_iter()
        .filter(|candidate| *candidate > 0.0)
        .fold(-1.0_f64, f64::max);

    if t <= 0.0 {
        rectangle_boundary_point(center, toward, bounds)
    } else {
        Point {
            x: center.x + dx * t,
            y: center.y + dy * t,
        }
    }
}

fn boundary_point(center: Point, toward: Point, bounds: Bounds, shape: NodeShape) -> Point {
    let cx = center.x;
    let cy = center.y;
    let x = bounds.x;
    let y = bounds.y;
    let width = bounds.width;
    let height = bounds.height;

    match shape {
        NodeShape::Circle => circle_boundary_point(center, toward, width.min(height) / 2.0),
        NodeShape::Diamond => polygon_boundary_point(
            center,
            toward,
            &[
                Point { x: cx, y },
                Point { x: x + width, y: cy },
                Point { x: cx, y: y + height },
                Point { x, y: cy },
            ],
        ),
        NodeShape::Hexagon => {
            let offset = width * 0.25;
            polygon_boundary_point(
                center,
                toward,
                &[
                    Point { x: x + offset, y },
                    Point { x: x + width - offset, y },
                    Point { x: x + width, y: cy },
                    Point { x: x + width - offset, y: y + height },
                    Point { x: x + offset, y: y + height },
                    Point { x, y: cy },
                ],
            )
        }
        NodeShape::Parallelogram => {
            let offset = width * 0.15;
            polygon_boundary_point(
                center,
                toward,
                &[
                    Point { x: x + offset, y },
                    Point { x: x + width, y },
                    Point { x: x + width - offset, y: y + height },
                    Point { x, y: y + height },
                ],
            )
        }
        NodeShape::Trapezoid => {
            let offset = width * 0.15;
            polygon_boundary_point(
                center,
                toward,
                &[
                    Point { x: x + offset, y },
                    Point { x: x + width - offset, y },
                    Point { x: x + width, y: y + height },
                    Point { x, y: y + height },
                ],
            )
        }
        NodeShape::Stadium => stadium_boundary_point(center, toward, bounds),
        NodeShape::Rectangle | NodeShape::RoundedRect => rectangle_boundary_point(center, toward, bounds),
    }
}

fn effective_label(node: &xmermaid_parser::ast::Node) -> String {
    node.label.clone().unwrap_or_else(|| node.id.clone())
}

fn wrap_label(label: &str) -> Vec<String> {
    if label.is_empty() {
        return vec![String::new()];
    }

    let mut chars = label.chars();
    let mut lines = Vec::new();
    for line_index in 0..MAX_LABEL_LINES {
        let line: String = chars.by_ref().take(MAX_LABEL_CHARS_PER_LINE).collect();
        if line.is_empty() {
            break;
        }

        if line_index == MAX_LABEL_LINES - 1 && chars.next().is_some() {
            let mut truncated: String = line.chars().take(MAX_LABEL_CHARS_PER_LINE - 1).collect();
            truncated.push('…');
            lines.push(truncated);
            break;
        }
        lines.push(line);
    }
    lines
}

fn label_size(
    lines: &[String],
    font_size: f64,
    line_height: f64,
    horizontal_padding: f64,
    vertical_padding: f64,
) -> (f64, f64) {
    let max_line_length = lines.iter().map(|line| line.chars().count()).max().unwrap_or(0);
    let content_height = if lines.is_empty() {
        0.0
    } else {
        font_size + (lines.len().saturating_sub(1) as f64 * line_height)
    };
    (
        max_line_length as f64 * font_size + horizontal_padding,
        content_height + vertical_padding,
    )
}

fn node_size(label_lines: &[String], shape: NodeShape, config: &LayoutConfig) -> (f64, f64) {
    // SVG text is measured by the browser, while layout runs in Rust/WASM. A full-em
    // width per Unicode scalar is intentionally conservative so layout owns the
    // viewport contract without relying on browser-only font measurement.
    let (content_width, content_height) = label_size(
        label_lines,
        DEFAULT_NODE_FONT_SIZE,
        NODE_LABEL_LINE_HEIGHT,
        NODE_LABEL_HORIZONTAL_PADDING,
        NODE_LABEL_VERTICAL_PADDING,
    );
    let mut width = config.node_width.max(content_width);
    let mut height = config.node_height.max(content_height);

    if shape == NodeShape::Circle {
        let diameter = width.max(height);
        width = diameter;
        height = diameter;
    }

    (width, height)
}

fn compute_edge_geometry(
    waypoints: &[Point],
    from_node: Option<&LayoutNode>,
    to_node: Option<&LayoutNode>,
) -> (Option<Point>, Option<Point>, Option<Point>, Option<f64>) {
    if waypoints.len() < 2 {
        return (None, None, None, None);
    }

    let first = waypoints[0];
    let last = waypoints[waypoints.len() - 1];
    let source_approach = waypoints[1];
    let target_approach = waypoints[waypoints.len() - 2];

    let source_boundary = from_node
        .map(|node| boundary_point(first, source_approach, node.bounds, node.shape));
    let target_boundary = to_node
        .map(|node| boundary_point(last, target_approach, node.bounds, node.shape));
    let angle = Some((last.y - target_approach.y).atan2(last.x - target_approach.x));

    let path_end = target_boundary;

    (source_boundary, target_boundary, path_end, angle)
}

fn translate_layout(nodes: &mut [LayoutNode], edges: &mut [LayoutEdge], x_shift: f64, y_shift: f64) {
    for node in nodes {
        node.center.x += x_shift;
        node.center.y += y_shift;
        node.bounds.x += x_shift;
        node.bounds.y += y_shift;
    }
    for edge in edges {
        for waypoint in &mut edge.waypoints {
            waypoint.x += x_shift;
            waypoint.y += y_shift;
        }
        for point in [
            &mut edge.label_position,
            &mut edge.source_boundary,
            &mut edge.target_boundary,
            &mut edge.path_end,
            &mut edge.label_anchor,
        ] {
            if let Some(point) = point {
                point.x += x_shift;
                point.y += y_shift;
            }
        }
    }
}

/// Compute layout for a flowchart diagram.
///
/// Takes a `FlowchartAst` directly (not a `DiagramAst`) and a `LayoutConfig`,
/// and returns a `LayoutResult` with positioned nodes and edges.
pub fn layout(fc: &FlowchartAst, config: &LayoutConfig) -> LayoutResult {
    let h_spacing = config.h_spacing;
    let v_spacing = config.v_spacing;
    let padding = config.padding;
    let is_horizontal = matches!(config.direction, FlowDirection::LR | FlowDirection::RL);

    if fc.nodes.is_empty() {
        return LayoutResult {
            nodes: vec![],
            edges: vec![],
            pie_slices: vec![],
            xy_chart: None,
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
    let node_shapes: Vec<NodeShape> = fc.nodes.iter().map(|node| map_shape(&node.shape)).collect();
    let node_labels: Vec<String> = fc.nodes.iter().map(effective_label).collect();
    let node_label_lines: Vec<Vec<String>> = node_labels.iter().map(|label| wrap_label(label)).collect();
    let node_sizes: Vec<(f64, f64)> = node_label_lines
        .iter()
        .zip(node_shapes.iter().copied())
        .map(|(lines, shape)| node_size(lines, shape, config))
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

    // Rank size comes from the largest node in that rank. Nodes are positioned
    // one after another on the cross axis, so variable label-driven sizes never
    // overlap and every rank can still be centered against the widest/tallest one.
    let rank_sizes: Vec<f64> = layer_groups
        .iter()
        .map(|group| {
            group
                .iter()
                .map(|&node_idx| {
                    if is_horizontal {
                        node_sizes[node_idx].0
                    } else {
                        node_sizes[node_idx].1
                    }
                })
                .fold(0.0_f64, f64::max)
        })
        .collect();
    let cross_sizes: Vec<f64> = layer_groups
        .iter()
        .map(|group| {
            if group.is_empty() {
                return 0.0;
            }
            group
                .iter()
                .map(|&node_idx| {
                    if is_horizontal {
                        node_sizes[node_idx].1
                    } else {
                        node_sizes[node_idx].0
                    }
                })
                .sum::<f64>()
                + group.len().saturating_sub(1) as f64
                    * if is_horizontal { v_spacing } else { h_spacing }
        })
        .collect();
    let max_cross_size = cross_sizes.iter().copied().fold(0.0_f64, f64::max);

    let mut rank_cursor = padding;
    for (layer_idx, group) in layer_groups.iter().enumerate() {
        let rank_center = rank_cursor + rank_sizes[layer_idx] / 2.0;
        let mut cross_cursor = padding + (max_cross_size - cross_sizes[layer_idx]) / 2.0;

        for &node_idx in group {
            let (width, height) = node_sizes[node_idx];
            if is_horizontal {
                centers[node_idx] = Point {
                    x: rank_center,
                    y: cross_cursor + height / 2.0,
                };
                cross_cursor += height + v_spacing;
            } else {
                centers[node_idx] = Point {
                    x: cross_cursor + width / 2.0,
                    y: rank_center,
                };
                cross_cursor += width + h_spacing;
            }
        }

        rank_cursor += rank_sizes[layer_idx] + if is_horizontal { h_spacing } else { v_spacing };
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
        .enumerate()
        .map(|(index, p)| p.x - node_sizes[index].0 / 2.0)
        .fold(f64::MAX, f64::min);
    let min_y = centers
        .iter()
        .enumerate()
        .map(|(index, p)| p.y - node_sizes[index].1 / 2.0)
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
            bounds: Bounds::from_center(centers[i], node_sizes[i].0, node_sizes[i].1),
            shape: node_shapes[i],
            label: node_labels[i].clone(),
            label_lines: node_label_lines[i].clone(),
        })
        .collect();

    // ── Compute bounding extremes before edge routing ─────────────────
    let max_x = centers
        .iter()
        .enumerate()
        .map(|(index, p)| p.x + node_sizes[index].0 / 2.0)
        .fold(0.0_f64, f64::max);
    let max_y = centers
        .iter()
        .enumerate()
        .map(|(index, p)| p.y + node_sizes[index].1 / 2.0)
        .fold(0.0_f64, f64::max);
    let min_y = centers
        .iter()
        .enumerate()
        .map(|(index, p)| p.y - node_sizes[index].1 / 2.0)
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

            let style = map_edge_style(&edge.style);
            let label_lines = edge.label.as_deref().map(wrap_label);
            let from_node = from_idx_opt.map(|idx| &nodes[idx]);
            let to_node = to_idx_opt.map(|idx| &nodes[idx]);
            let (source_boundary, target_boundary, path_end, final_tangent_angle) =
                compute_edge_geometry(&waypoints, from_node, to_node);

            LayoutEdge {
                from: edge.from.clone(),
                to: edge.to.clone(),
                waypoints,
                label: edge.label.clone(),
                label_lines,
                label_position,
                style,
                source_boundary,
                target_boundary,
                path_end,
                final_tangent_angle,
                label_anchor: label_position,
                geometry_version: GEOMETRY_VERSION,
            }
        })
        .collect();

    // ── Compute final dimensions ─────────────────────────────────────
    // Expand dimensions and shift coordinates to accommodate back-edge routing.
    // Only applies when back-edges exist; otherwise, dimensions remain unchanged.
    let (mut final_nodes, mut final_edges, mut final_width, mut final_height) = if has_back_edges {
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
            translate_layout(&mut shifted_nodes, &mut shifted_edges, 0.0, y_shift);
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

    // Edge labels are rendered by the TypeScript SVG layer, but their bounds are
    // layout-owned so the root viewport must reserve room for them here.
    let mut label_min_x = f64::MAX;
    let mut label_min_y = f64::MAX;
    let mut label_max_x = f64::MIN;
    let mut label_max_y = f64::MIN;
    for edge in &final_edges {
        if let (Some(lines), Some(anchor)) = (edge.label_lines.as_deref(), edge.label_anchor) {
            let (width, height) = label_size(
                lines,
                DEFAULT_EDGE_LABEL_FONT_SIZE,
                EDGE_LABEL_LINE_HEIGHT,
                EDGE_LABEL_HORIZONTAL_PADDING,
                EDGE_LABEL_VERTICAL_PADDING,
            );
            label_min_x = label_min_x.min(anchor.x - width / 2.0);
            label_max_x = label_max_x.max(anchor.x + width / 2.0);
            label_min_y = label_min_y.min(anchor.y - height / 2.0);
            label_max_y = label_max_y.max(anchor.y + height / 2.0);
        }
    }

    if label_min_x.is_finite() {
        let x_shift = (padding - label_min_x).max(0.0);
        let y_shift = (padding - label_min_y).max(0.0);
        if x_shift > 0.0 || y_shift > 0.0 {
            translate_layout(&mut final_nodes, &mut final_edges, x_shift, y_shift);
            final_width += x_shift;
            final_height += y_shift;
        }
        final_width = final_width.max(label_max_x + x_shift + padding);
        final_height = final_height.max(label_max_y + y_shift + padding);
    }

    LayoutResult {
        nodes: final_nodes,
        edges: final_edges,
        pie_slices: vec![],
        xy_chart: None,
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
        // Bare node IDs are user-visible labels when no explicit label is supplied.
        assert_eq!(result.nodes[0].label, "A");
        assert!(result.dimensions.width > 0.0);
        assert!(result.dimensions.height > 0.0);
    }

    #[test]
    fn test_circle_edge_geometry_ends_on_the_circle() {
        let result = layout_from_dsl("graph LR\n  A[Start] --> B((Circle))");
        let circle = result.nodes.iter().find(|node| node.id == "B").unwrap();
        let edge = result.edges.first().unwrap();
        let target = edge.target_boundary.unwrap();

        assert_eq!(circle.shape, NodeShape::Circle);
        assert!(
            (target.x - (circle.center.x - circle.bounds.width.min(circle.bounds.height) / 2.0)).abs()
                < f64::EPSILON,
            "arrow tip must meet the rendered circle boundary",
        );
        assert!((target.y - circle.center.y).abs() < f64::EPSILON);
    }

    #[test]
    fn test_long_node_labels_expand_their_bounds_and_viewport() {
        let label = "A label long enough to exceed the default node width without clipping";
        let result = layout_from_dsl(&format!("graph TD\n  A[{label}]"));
        let node = result.nodes.first().unwrap();

        assert!(node.bounds.width > LayoutConfig::default().node_width);
        assert!(node.bounds.right() + LayoutConfig::default().padding <= result.dimensions.width);
    }

    #[test]
    fn test_extreme_node_labels_have_bounded_layout_dimensions() {
        let label = "W".repeat(50_000);
        let result = layout_from_dsl(&format!("graph TD\n  A[{label}]"));
        let node = result.nodes.first().unwrap();

        assert!(node.bounds.width <= 1_000.0);
        assert!(node.bounds.height <= 1_000.0);
        assert!(result.dimensions.width <= 1_200.0);
        assert!(result.dimensions.height <= 1_200.0);
    }

    #[test]
    fn test_long_edge_labels_stay_inside_the_layout_viewport() {
        let label = "wide edge label ".repeat(20);
        let result = layout_from_dsl(&format!("graph TD\n  A -->|{label}| B"));
        let edge = result.edges.first().unwrap();
        let anchor = edge.label_anchor.unwrap();
        let estimated_width = 48.0 * 12.0 + 8.0;

        assert!(anchor.x - estimated_width / 2.0 >= LayoutConfig::default().padding);
        assert!(anchor.x + estimated_width / 2.0 <= result.dimensions.width - LayoutConfig::default().padding);
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
    fn test_custom_config() {
        let ast = parse("graph TD\n  A-->B").unwrap();
        let fc = match &ast {
            xmermaid_parser::ast::DiagramAst::Flowchart(fc) => fc,
            _ => panic!("Expected Flowchart"),
        };
        let config = LayoutConfig {
            node_width: 200.0,
            node_height: 80.0,
            h_spacing: 120.0,
            v_spacing: 140.0,
            padding: 30.0,
            direction: FlowDirection::TB,
        };

        let result = layout(fc, &config);
        let a = result.nodes.iter().find(|n| n.id == "A").unwrap();
        let b = result.nodes.iter().find(|n| n.id == "B").unwrap();

        assert_eq!(a.bounds.width, 200.0);
        assert_eq!(a.bounds.height, 80.0);
        assert_eq!(b.center.y - a.center.y, 220.0);
    }

    #[test]
    fn test_same_rank_uniform_spacing() {
        let result = layout_from_dsl("graph TD\n  A-->B\n  A-->C\n  A-->D");
        let mut children: Vec<_> = result
            .nodes
            .iter()
            .filter(|n| n.id == "B" || n.id == "C" || n.id == "D")
            .collect();
        children.sort_by(|a, b| a.center.x.partial_cmp(&b.center.x).unwrap());

        assert_eq!(children.len(), 3);
        assert_eq!(children[0].center.y, children[1].center.y);
        assert_eq!(children[1].center.y, children[2].center.y);

        let first_gap = children[1].center.x - children[0].center.x;
        let second_gap = children[2].center.x - children[1].center.x;
        assert_eq!(first_gap, second_gap);
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
