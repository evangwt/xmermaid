//! Deep layout tests with real-world diagram examples
//! and falsification of known layout limitations.

use xmermaid_layout::{compute_flowchart_layout, LayoutError};
use xmermaid_parser::{parse, DiagramAst};

// ═══════════════════════════════════════════════════════════════════
//  REAL-WORLD LAYOUT EXAMPLES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_ci_cd_pipeline_lr() {
    let ast = parse("graph LR\n  Code-->Build-->Test-->Deploy").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let positions: Vec<_> = ["Code", "Build", "Test", "Deploy"]
        .iter()
        .map(|id| layout.positions.iter().find(|(n, _)| n == id).unwrap().1)
        .collect();

    for i in 0..3 {
        assert!(positions[i].x < positions[i + 1].x, "LR: nodes should increase in x");
    }
}

#[test]
fn test_layout_decision_tree_td() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->E").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");

    assert!(a.1 < b.1);
    assert!(a.1 < c.1);
    assert_eq!(b.1, c.1, "B and C should be at same layer");
    assert_ne!(b.0, c.0, "B and C should be at different x positions");
}

#[test]
fn test_layout_diamond_merge() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    let d = pos(&layout, "D");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");

    assert!(a.1 < b.1);
    assert!(b.1 < d.1);
    assert_eq!(b.1, c.1);
    assert!(d.1 > c.1);
}

#[test]
fn test_layout_wide_graph_10_nodes() {
    let ast = parse("graph LR\n  N1-->N2-->N3-->N4-->N5-->N6-->N7-->N8-->N9-->N10").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 10);
    for i in 1..=9 {
        let prev = pos(&layout, &format!("N{}", i));
        let curr = pos(&layout, &format!("N{}", i + 1));
        assert!(prev.0 < curr.0, "N{} should be left of N{}", i, i + 1);
    }
}

#[test]
fn test_layout_star_topology() {
    let ast = parse("graph TD\n  Hub-->S1\n  Hub-->S2\n  Hub-->S3\n  Hub-->S4").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let hub = pos(&layout, "Hub");
    for id in &["S1", "S2", "S3", "S4"] {
        let s = pos(&layout, id);
        assert!(hub.1 < s.1, "Hub should be above {}", id);
    }
    let s1_y = pos(&layout, "S1").1;
    for id in &["S2", "S3", "S4"] {
        assert_eq!(pos(&layout, id).1, s1_y, "{} should be at same layer as S1", id);
    }
}

#[test]
fn test_falsify_state_machine_back_edge() {
    // Paused-->Running is a back-edge; longest-path layering places Running
    // before Paused, so the back-edge goes upward — no proper handling.
    let ast = parse("graph TD\n  Idle-->Running\n  Running-->Paused\n  Paused-->Running\n  Running-->Stopped").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 4);
    let idle = pos(&layout, "Idle");
    let running = pos(&layout, "Running");
    let stopped = pos(&layout, "Stopped");

    // Idle is a source so it's at layer 0
    // Stopped is a sink so it's at the bottom
    assert!(idle.1 < running.1, "Idle above Running");
    assert!(running.1 < stopped.1, "Running above Stopped");
    // Known bug: Paused-->Running back-edge not handled — Paused may not be
    // below Running as the diagram implies
}

#[test]
fn test_layout_microservices() {
    let ast = parse("graph LR\n  GW-->Auth\n  GW-->Order\n  GW-->User\n  Order-->DB\n  User-->DB\n  Auth-->Cache").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 6);
    for (_, p) in &layout.positions {
        assert!(p.x >= 0.0 && p.y >= 0.0);
        assert!(p.x < layout.dimensions.width);
        assert!(p.y < layout.dimensions.height);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  EXACT COORDINATE TESTS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_exact_td_chain() {
    let ast = parse("graph TD\n  A-->B-->C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // Constants: PADDING=40, NODE_HEIGHT=40, V_SPACING=60
    // A at layer 0: (40, 40)
    // B at layer 1: (40, 40+40+60) = (40, 140)
    // C at layer 2: (40, 140+40+60) = (40, 240)
    assert_eq!(pos(&layout, "A"), (40.0, 40.0));
    assert_eq!(pos(&layout, "B"), (40.0, 140.0));
    assert_eq!(pos(&layout, "C"), (40.0, 240.0));
}

#[test]
fn test_layout_exact_lr_chain() {
    let ast = parse("graph LR\n  A-->B-->C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // Constants: PADDING=40, NODE_WIDTH=120, H_SPACING=60
    // A at layer 0: (40, 40)
    // B at layer 1: (40+120+60, 40) = (220, 40)
    // C at layer 2: (220+120+60, 40) = (400, 40)
    assert_eq!(pos(&layout, "A"), (40.0, 40.0));
    assert_eq!(pos(&layout, "B"), (220.0, 40.0));
    assert_eq!(pos(&layout, "C"), (400.0, 40.0));
}

#[test]
fn test_layout_exact_diamond_dimensions() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    assert_eq!(a, (40.0, 40.0));
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    assert_eq!(b.1, c.1);
    assert!(c.0 > b.0, "C should be right of B");
}

// ═══════════════════════════════════════════════════════════════════
//  DIMENSION TESTS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_dimensions_encompass_all_nodes() {
    let ast = parse("graph TD\n  A-->B-->C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    for (_, p) in &layout.positions {
        assert!(p.x + 60.0 <= layout.dimensions.width, "x + half_width within bounds");
        assert!(p.y + 20.0 <= layout.dimensions.height, "y + half_height within bounds");
    }
}

#[test]
fn test_layout_dimensions_increase_with_nodes() {
    let ast2 = parse("graph TD\n  A-->B").unwrap();
    let ast4 = parse("graph TD\n  A-->B-->C-->D").unwrap();
    let layout2 = compute_flowchart_layout(&ast2).unwrap();
    let layout4 = compute_flowchart_layout(&ast4).unwrap();

    assert!(layout4.dimensions.height > layout2.dimensions.height, "More nodes = taller");
}

// ═══════════════════════════════════════════════════════════════════
//  FALSIFICATION: KNOWN LAYOUT BUGS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_bt_does_not_reverse_y() {
    let ast = parse("graph BT\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // Correct BT: A.y > B.y (A below B)
    // Current bug: A.y < B.y (same as TD)
    assert!(a.1 < b.1, "Known bug: BT direction doesn't reverse y coordinates");
}

#[test]
fn test_falsify_rl_does_not_reverse_x() {
    let ast = parse("graph RL\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // Correct RL: A.x > B.x (A right of B)
    // Current bug: A.x < B.x (same as LR)
    assert!(a.0 < b.0, "Known bug: RL direction doesn't reverse x coordinates");
}

#[test]
fn test_falsify_cycle_no_detection() {
    let ast = parse("graph TD\n  A-->B\n  B-->A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 2);
}

#[test]
fn test_falsify_long_cycle_no_stack_overflow() {
    let ast = parse("graph TD\n  A-->B\n  B-->C\n  C-->A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 3);
}

#[test]
fn test_falsify_self_loop_layout() {
    let ast = parse("graph TD\n  A-->A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 1);
}

#[test]
fn test_falsify_non_flowchart_rejected() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
    });
    let result = compute_flowchart_layout(&ast);
    assert!(matches!(result.unwrap_err(), LayoutError::UnsupportedDiagramType));
}

#[test]
fn test_falsify_no_crossing_minimization() {
    let ast = parse("graph TD\n  A-->D\n  B-->C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    let d = pos(&layout, "D");

    assert!(a.0 < b.0, "A declared before B");
    assert_ne!(a.0, b.0, "A and B at different x positions");
    assert_ne!(c.0, d.0, "C and D at different x positions");
}

#[test]
fn test_falsify_no_rank_balancing() {
    let ast = parse("graph TD\n  A-->B-->D\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    let d = pos(&layout, "D");

    assert!(a.1 < b.1);
    assert!(b.1 < d.1);
    assert_eq!(a.1, c.1, "A and C both at layer 0");
}

// ═══════════════════════════════════════════════════════════════════
//  EDGE CASES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_empty_graph() {
    let ast = parse("graph TD").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 0);
    assert_eq!(layout.dimensions.width, 80.0);
    assert_eq!(layout.dimensions.height, 80.0);
}

#[test]
fn test_layout_single_isolated_node() {
    let ast = parse("graph TD\n  A").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 1);
    assert_eq!(pos(&layout, "A"), (40.0, 40.0));
}

#[test]
fn test_layout_many_isolated_nodes() {
    let ast = parse("graph TD\n  A B C D E").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 5);
    let y = pos(&layout, "A").1;
    for id in &["B", "C", "D", "E"] {
        assert_eq!(pos(&layout, id).1, y, "{} at same layer as A", id);
    }
}

#[test]
fn test_layout_multiple_edges_same_pair() {
    let ast = parse("graph TD\n  A-->B\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 2);
}

#[test]
fn test_layout_disconnected_subgraphs() {
    let ast = parse("graph TD\n  A-->B\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 4);
    assert_eq!(pos(&layout, "A").1, pos(&layout, "C").1);
    assert_eq!(pos(&layout, "B").1, pos(&layout, "D").1);
}

// ═══════════════════════════════════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════════════════════════════════

fn pos(layout: &xmermaid_layout::LayoutResult, id: &str) -> (f64, f64) {
    let p = layout.positions.iter().find(|(n, _)| n == id).unwrap().1;
    (p.x, p.y)
}
