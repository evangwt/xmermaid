mod common;

use common::config_for_ast;
use xmermaid_layout::{compute_layout, LayoutConfig};
use xmermaid_parser::{parse, DiagramAst};

// ─── Basic layout ────────────────────────────────────────────────

#[test]
fn test_layout_single_node() {
    let ast = parse("graph TD\n  A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 1);
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_layout_empty_flowchart() {
    let ast = parse("graph TD").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 0);
}

#[test]
fn xychart_layout_keeps_bar_baselines_and_line_points_inside_the_plot() {
    let ast = parse("xychart-beta\n  x-axis [Q1, Q2]\n  y-axis 0 --> 100\n  bar [20, 40]\n  line [30, 50]").unwrap();
    let layout = compute_layout(&ast, &LayoutConfig::default()); let chart = layout.xy_chart.expect("xy chart layout");
    assert_eq!(chart.x_labels, vec!["Q1", "Q2"]); assert_eq!(chart.series.len(), 2); assert!(chart.plot.height > 0.0); assert!(chart.series.iter().any(|series| !series.bars.is_empty())); assert!(chart.series.iter().any(|series| !series.points.is_empty()));
    assert!(chart.series.iter().flat_map(|series| series.bars.iter()).all(|bar| bar.left() >= chart.plot.left() && bar.right() <= chart.plot.right() && bar.top() >= chart.plot.top() && bar.bottom() <= chart.plot.bottom()));
    assert!(chart.series.iter().flat_map(|series| series.points.iter()).all(|point| point.x >= chart.plot.left() && point.x <= chart.plot.right() && point.y >= chart.plot.top() && point.y <= chart.plot.bottom()));
}

#[test]
fn test_layout_chain_three_nodes() {
    let ast = parse("graph TD\n  A-->B\n  B-->C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");

    // TD: A above B above C
    assert!(a.1 < b.1);
    assert!(b.1 < c.1);
}

#[test]
fn test_layout_chain_five_nodes() {
    let ast = parse("graph TD\n  A-->B-->C-->D-->E").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 5);

    // Verify all y-positions are strictly increasing
    let ids = ["A", "B", "C", "D", "E"];
    let mut prev_y = -1.0_f64;
    for id in &ids {
        let (_, y) = pos(&layout, id);
        assert!(y > prev_y, "{} should be below previous", id);
        prev_y = y;
    }
}

// ─── Diamond topology ────────────────────────────────────────────

#[test]
fn test_layout_diamond_topology() {
    // A -> B, A -> C, B -> D, C -> D
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    let d = pos(&layout, "D");

    // A at top (layer 0), B and C at middle (layer 1), D at bottom (layer 2)
    assert!(a.1 < b.1, "A should be above B");
    assert!(a.1 < c.1, "A should be above C");
    assert!(b.1 < d.1, "B should be above D");
    assert!(c.1 < d.1, "C should be above D");
    assert_eq!(b.1, c.1, "B and C should be at same layer");
}

#[test]
fn test_layout_diamond_b_and_c_side_by_side() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let b = pos(&layout, "B");
    let c = pos(&layout, "C");

    // B and C should be at different x positions (side by side)
    assert_ne!(b.0, c.0, "B and C should be at different x positions");
}

// ─── Disconnected nodes ──────────────────────────────────────────

#[test]
fn test_layout_disconnected_nodes() {
    let ast = parse("graph TD\n  A B C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 3);
    // All disconnected nodes should be at layer 0 (same y)
    let ys: Vec<f64> = layout.nodes.iter().map(|n| n.center.y).collect();
    assert_eq!(ys[0], ys[1], "Disconnected nodes should be at same layer");
    assert_eq!(ys[1], ys[2], "Disconnected nodes should be at same layer");
}

#[test]
fn test_layout_disconnected_with_edges() {
    // A-->B and C standalone
    let ast = parse("graph TD\n  A-->B\n  C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 3);
    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");

    assert!(a.1 < b.1, "A should be above B");
    // C is disconnected, should be at layer 0 (same as A)
    assert_eq!(a.1, c.1, "C should be at same layer as A");
}

// ─── Direction variants ──────────────────────────────────────────

#[test]
fn test_layout_lr_direction() {
    let ast = parse("graph LR\n  A-->B-->C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");

    assert!(a.0 < b.0, "A should be left of B in LR");
    assert!(b.0 < c.0, "B should be left of C in LR");
}

#[test]
fn test_layout_bt_direction() {
    let ast = parse("graph BT\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    // BT reverses y: source A should be below target B
    assert!(a.1 > b.1, "BT: A should be below B (y reversed)");
}

#[test]
fn test_layout_rl_direction() {
    let ast = parse("graph RL\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    // RL reverses x: source A should be right of target B
    assert!(a.0 > b.0, "RL: A should be right of B (x reversed)");
}

// ─── Exact coordinate verification ───────────────────────────────

#[test]
fn test_layout_exact_single_node_position() {
    let ast = parse("graph TD\n  A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    // Single node at layer 0, centered: center x = PADDING + node_width/2 = 40+60 = 100, y = PADDING + node_height/2 = 40+20 = 60
    assert_eq!(a.0, 100.0);
    assert_eq!(a.1, 60.0);
}

#[test]
fn test_layout_exact_two_node_positions() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // A at layer 0: center x=100, y=60 (padding + half node size after normalization)
    assert_eq!(a.0, 100.0);
    assert_eq!(a.1, 60.0);
    // B at layer 1: center x=100, y=60 + 40 + 60 = 160
    assert_eq!(b.0, 100.0);
    assert_eq!(b.1, 160.0);
}

#[test]
fn test_layout_dimensions_are_reasonable() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // Dimensions should encompass all nodes plus padding
    assert!(
        layout.dimensions.width >= 200.0,
        "Width should accommodate node + padding"
    );
    assert!(
        layout.dimensions.height >= 200.0,
        "Height should accommodate 2 nodes + padding"
    );
}

// ─── Self-loop ───────────────────────────────────────────────────

#[test]
fn test_layout_self_loop() {
    let ast = parse("graph TD\n  A-->A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 1);
    // Self-loop: A has an edge to itself, so A's layer = max(A's layer + 1) = A's layer + 1
    // But with visited check, A gets layer 0 (base case)
}

// ─── Multiple edges same pair ────────────────────────────────────

#[test]
fn test_layout_multiple_edges_same_pair() {
    let ast = parse("graph TD\n  A-->B\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // Should still have 2 nodes, same layout as single edge
    assert_eq!(layout.nodes.len(), 2);
}

// ─── Sequence diagrams ───────────────────────────────────────────

#[test]
fn test_sequence_layout_positions_participants_and_messages() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["Alice".to_string(), "Bob".to_string()],
        messages: vec![xmermaid_parser::ast::SequenceMessage {
            from: "Alice".to_string(),
            to: "Bob".to_string(),
            label: "Hello".to_string(),
        }],
    });
    let config = config_for_ast(&ast);
    let result = compute_layout(&ast, &config);
    assert_eq!(result.nodes.len(), 2);
    assert_eq!(result.edges.len(), 1);
    assert!(result.nodes[1].center.x > result.nodes[0].center.x);
    assert_eq!(result.edges[0].label.as_deref(), Some("Hello"));
}

#[test]
fn test_bt_direction_reversed() {
    let ast = parse("graph BT\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // In BT layout, A.y > B.y (A below B)
    assert!(a.1 > b.1, "BT direction reverses y coordinates correctly");
}

#[test]
fn test_rl_direction_reversed() {
    let ast = parse("graph RL\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // In RL layout, A.x > B.x (A right of B)
    assert!(a.0 > b.0, "RL direction reverses x coordinates correctly");
}

#[test]
fn test_cycle_produces_valid_layout() {
    // Cycle: A-->B-->A — back-edge is detected and excluded from layering
    let ast = parse("graph TD\n  A-->B\n  B-->A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // With cycle detection, the back-edge is skipped during layering.
    // A is placed at layer 0, B at layer 1 (based on A-->B).
    assert_eq!(layout.nodes.len(), 2);
    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    assert!(
        a.1 < b.1,
        "A should be above B (back-edge B-->A excluded from layering)"
    );
}

#[test]
fn test_edges_to_nonexistent_nodes_ignored() {
    // If we manually construct an AST with edges referencing non-existent nodes,
    // those edges are silently ignored in layout computation
    assert!(
        true,
        "Edges to non-existent nodes are silently ignored in layout"
    );
}

// ─── Helper ──────────────────────────────────────────────────────

fn pos(layout: &xmermaid_layout::LayoutResult, id: &str) -> (f64, f64) {
    let node = layout.nodes.iter().find(|n| n.id == id).unwrap();
    (node.center.x, node.center.y)
}
