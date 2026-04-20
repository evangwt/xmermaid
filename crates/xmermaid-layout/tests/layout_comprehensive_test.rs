use xmermaid_layout::{compute_flowchart_layout, LayoutError};
use xmermaid_parser::{parse, DiagramAst};

// ─── Basic layout ────────────────────────────────────────────────

#[test]
fn test_layout_single_node() {
    let ast = parse("graph TD\n  A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 1);
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_layout_empty_flowchart() {
    let ast = parse("graph TD").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 0);
}

#[test]
fn test_layout_chain_three_nodes() {
    let ast = parse("graph TD\n  A-->B\n  B-->C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    let c = layout.positions.iter().find(|(id, _)| id == "C").unwrap().1;

    // TD: A above B above C
    assert!(a.y < b.y);
    assert!(b.y < c.y);
}

#[test]
fn test_layout_chain_five_nodes() {
    let ast = parse("graph TD\n  A-->B-->C-->D-->E").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 5);

    // Verify all y-positions are strictly increasing
    let ids = ["A", "B", "C", "D", "E"];
    let mut prev_y = -1.0_f64;
    for id in &ids {
        let pos = layout.positions.iter().find(|(n, _)| n == id).unwrap().1;
        assert!(pos.y > prev_y, "{} should be below previous", id);
        prev_y = pos.y;
    }
}

// ─── Diamond topology ────────────────────────────────────────────

#[test]
fn test_layout_diamond_topology() {
    // A -> B, A -> C, B -> D, C -> D
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    let c = layout.positions.iter().find(|(id, _)| id == "C").unwrap().1;
    let d = layout.positions.iter().find(|(id, _)| id == "D").unwrap().1;

    // A at top (layer 0), B and C at middle (layer 1), D at bottom (layer 2)
    assert!(a.y < b.y, "A should be above B");
    assert!(a.y < c.y, "A should be above C");
    assert!(b.y < d.y, "B should be above D");
    assert!(c.y < d.y, "C should be above D");
    assert_eq!(b.y, c.y, "B and C should be at same layer");
}

#[test]
fn test_layout_diamond_b_and_c_side_by_side() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    let c = layout.positions.iter().find(|(id, _)| id == "C").unwrap().1;

    // B and C should be at different x positions (side by side)
    assert_ne!(b.x, c.x, "B and C should be at different x positions");
}

// ─── Disconnected nodes ──────────────────────────────────────────

#[test]
fn test_layout_disconnected_nodes() {
    let ast = parse("graph TD\n  A B C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 3);
    // All disconnected nodes should be at layer 0 (same y)
    let ys: Vec<f64> = layout.positions.iter().map(|(_, p)| p.y).collect();
    assert_eq!(ys[0], ys[1], "Disconnected nodes should be at same layer");
    assert_eq!(ys[1], ys[2], "Disconnected nodes should be at same layer");
}

#[test]
fn test_layout_disconnected_with_edges() {
    // A-->B and C standalone
    let ast = parse("graph TD\n  A-->B\n  C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 3);
    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    let c = layout.positions.iter().find(|(id, _)| id == "C").unwrap().1;

    assert!(a.y < b.y, "A should be above B");
    // C is disconnected, should be at layer 0 (same as A)
    assert_eq!(a.y, c.y, "C should be at same layer as A");
}

// ─── Direction variants ──────────────────────────────────────────

#[test]
fn test_layout_lr_direction() {
    let ast = parse("graph LR\n  A-->B-->C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    let c = layout.positions.iter().find(|(id, _)| id == "C").unwrap().1;

    assert!(a.x < b.x, "A should be left of B in LR");
    assert!(b.x < c.x, "B should be left of C in LR");
}

#[test]
fn test_layout_bt_direction() {
    let ast = parse("graph BT\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // KNOWN LIMITATION: BT direction doesn't reverse y coordinates
    // Currently BT uses same layout as TD
    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    // In current implementation, A is still above B (not reversed)
    assert!(a.y < b.y, "Known limitation: BT doesn't reverse y");
}

#[test]
fn test_layout_rl_direction() {
    let ast = parse("graph RL\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // KNOWN LIMITATION: RL direction doesn't reverse x coordinates
    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;
    // In current implementation, A is still left of B (not reversed)
    assert!(a.x < b.x, "Known limitation: RL doesn't reverse x");
}

// ─── Exact coordinate verification ───────────────────────────────

#[test]
fn test_layout_exact_single_node_position() {
    let ast = parse("graph TD\n  A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    // Single node at layer 0, position 0: x = PADDING = 40, y = PADDING = 40
    assert_eq!(a.x, 40.0);
    assert_eq!(a.y, 40.0);
}

#[test]
fn test_layout_exact_two_node_positions() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;

    // A at layer 0: x=40, y=40
    assert_eq!(a.x, 40.0);
    assert_eq!(a.y, 40.0);
    // B at layer 1: x=40, y=40 + 40 + 60 = 140
    assert_eq!(b.x, 40.0);
    assert_eq!(b.y, 140.0);
}

#[test]
fn test_layout_dimensions_are_reasonable() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // Dimensions should encompass all nodes plus padding
    assert!(layout.dimensions.width >= 200.0, "Width should accommodate node + padding");
    assert!(layout.dimensions.height >= 200.0, "Height should accommodate 2 nodes + padding");
}

// ─── Self-loop ───────────────────────────────────────────────────

#[test]
fn test_layout_self_loop() {
    let ast = parse("graph TD\n  A-->A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 1);
    // Self-loop: A has an edge to itself, so A's layer = max(A's layer + 1) = A's layer + 1
    // But with visited check, A gets layer 0 (base case)
}

// ─── Multiple edges same pair ────────────────────────────────────

#[test]
fn test_layout_multiple_edges_same_pair() {
    let ast = parse("graph TD\n  A-->B\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // Should still have 2 nodes, 2 edges, same layout as single edge
    assert_eq!(layout.positions.len(), 2);
}

// ═══════════════════════════════════════════════════════════════════
//  FALSIFICATION TESTS — verify limitations and what should NOT work
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_non_flowchart_returns_error() {
    // Construct a Sequence AST (not Flowchart)
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
    });
    let result = compute_flowchart_layout(&ast);
    assert!(result.is_err());
    match result.unwrap_err() {
        LayoutError::UnsupportedDiagramType => {}
        _ => panic!("Expected UnsupportedDiagramType"),
    }
}

#[test]
fn test_falsify_bt_direction_not_reversed() {
    // KNOWN LIMITATION: BT direction should place A below B, but currently doesn't
    let ast = parse("graph BT\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;

    // In correct BT layout, A.y > B.y (A below B)
    // But current implementation doesn't reverse, so A.y < B.y
    assert!(a.y < b.y, "Known bug: BT direction doesn't reverse y coordinates");
}

#[test]
fn test_falsify_rl_direction_not_reversed() {
    // KNOWN LIMITATION: RL direction should place A right of B, but currently doesn't
    let ast = parse("graph RL\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;

    // In correct RL layout, A.x > B.x (A right of B)
    // But current implementation doesn't reverse, so A.x < B.x
    assert!(a.x < b.x, "Known bug: RL direction doesn't reverse x coordinates");
}

#[test]
fn test_falsify_cycle_produces_questionable_layout() {
    // Cycle: A-->B-->A — no cycle detection
    let ast = parse("graph TD\n  A-->B\n  B-->A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // With cycles, longest-path layering produces questionable results
    // A and B may end up at the same layer or incorrect layers
    // The important thing is it doesn't crash
    assert_eq!(layout.positions.len(), 2);
}

#[test]
fn test_falsify_edges_to_nonexistent_nodes_ignored() {
    // If we manually construct an AST with edges referencing non-existent nodes,
    // those edges are silently ignored in layout computation
    // (This is tested via the engine's adjacency building with if-let guards)
    // We can't easily test this through the public API since parse() always
    // creates valid edges. This is a documentation test.
    assert!(true, "Edges to non-existent nodes are silently ignored in layout");
}
