//! Deep layout tests with real-world diagram examples
//! and falsification of known layout limitations.

mod common;

use common::config_for_ast;
use xmermaid_layout::compute_layout;
use xmermaid_parser::{parse, DiagramAst};

// ═══════════════════════════════════════════════════════════════════
//  REAL-WORLD LAYOUT EXAMPLES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_ci_cd_pipeline_lr() {
    let ast = parse("graph LR\n  Code-->Build-->Test-->Deploy").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let positions: Vec<_> = ["Code", "Build", "Test", "Deploy"]
        .iter()
        .map(|id| pos(&layout, id))
        .collect();

    for i in 0..3 {
        assert!(
            positions[i].0 < positions[i + 1].0,
            "LR: nodes should increase in x"
        );
    }
}

#[test]
fn test_layout_decision_tree_td() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->E").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

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
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

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
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 10);
    for i in 1..=9 {
        let prev = pos(&layout, &format!("N{}", i));
        let curr = pos(&layout, &format!("N{}", i + 1));
        assert!(prev.0 < curr.0, "N{} should be left of N{}", i, i + 1);
    }
}

#[test]
fn test_layout_star_topology() {
    let ast = parse("graph TD\n  Hub-->S1\n  Hub-->S2\n  Hub-->S3\n  Hub-->S4").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let hub = pos(&layout, "Hub");
    for id in &["S1", "S2", "S3", "S4"] {
        let s = pos(&layout, id);
        assert!(hub.1 < s.1, "Hub should be above {}", id);
    }
    let s1_y = pos(&layout, "S1").1;
    for id in &["S2", "S3", "S4"] {
        assert_eq!(
            pos(&layout, id).1,
            s1_y,
            "{} should be at same layer as S1",
            id
        );
    }
}

#[test]
fn test_falsify_state_machine_back_edge() {
    // Paused-->Running is a back-edge; cycle detection now handles it.
    let ast = parse(
        "graph TD\n  Idle-->Running\n  Running-->Paused\n  Paused-->Running\n  Running-->Stopped",
    )
    .unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 4);
    let idle = pos(&layout, "Idle");
    let running = pos(&layout, "Running");
    let paused = pos(&layout, "Paused");
    let stopped = pos(&layout, "Stopped");

    // Idle is a source so it's at layer 0
    // Running is at layer 1
    // Paused is at layer 2 (forward edge Running-->Paused)
    // Stopped is at layer 3 (Running-->Stopped via longest path through Paused or directly)
    // The back-edge Paused-->Running is excluded from layering
    assert!(idle.1 < running.1, "Idle above Running");
    assert!(
        running.1 < paused.1,
        "Running above Paused (back-edge excluded)"
    );
    assert!(running.1 < stopped.1, "Running above Stopped");
}

#[test]
fn test_layout_microservices() {
    let ast = parse("graph LR\n  GW-->Auth\n  GW-->Order\n  GW-->User\n  Order-->DB\n  User-->DB\n  Auth-->Cache").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 6);
    for n in &layout.nodes {
        assert!(n.center.x >= 0.0 && n.center.y >= 0.0);
        assert!(n.center.x < layout.dimensions.width);
        assert!(n.center.y < layout.dimensions.height);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  EXACT COORDINATE TESTS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_exact_td_chain() {
    let ast = parse("graph TD\n  A-->B-->C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // With normalization ensuring node bounds start at padding:
    // A at layer 0: center (100, 60) — padding(40) + half_width(60), padding(40) + half_height(20)
    // B at layer 1: center (100, 160)
    // C at layer 2: center (100, 260)
    assert_eq!(pos(&layout, "A"), (100.0, 60.0));
    assert_eq!(pos(&layout, "B"), (100.0, 160.0));
    assert_eq!(pos(&layout, "C"), (100.0, 260.0));
}

#[test]
fn test_layout_exact_lr_chain() {
    let ast = parse("graph LR\n  A-->B-->C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // LR direction: layers go horizontally
    // A at layer 0: center (100, 60) — after normalization
    // B at layer 1: center (280, 60) — 100 + 180 = 280
    // C at layer 2: center (460, 60) — 280 + 180 = 460
    assert_eq!(pos(&layout, "A"), (100.0, 60.0));
    assert_eq!(pos(&layout, "B"), (280.0, 60.0));
    assert_eq!(pos(&layout, "C"), (460.0, 60.0));
}

#[test]
fn test_layout_exact_diamond_dimensions() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // With centering and normalization:
    // Layer 1 (B,C) is widest at 300px, layers 0 and 2 get centered
    // After centering: A at (130, 40), B at (40, 140), C at (220, 140), D at (130, 240)
    // After normalization (shift x+60, y+20): A at (190, 60), B at (100, 160), C at (280, 160), D at (190, 260)
    let a = pos(&layout, "A");
    assert_eq!(a, (190.0, 60.0));
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    assert_eq!(b.1, c.1);
    assert_eq!(b.0, 100.0); // B at left of layer 1
    assert_eq!(c.0, 280.0); // C at right of layer 1
    assert!(c.0 > b.0, "C should be right of B");
    let d = pos(&layout, "D");
    assert_eq!(d.0, 190.0); // centered like A
}

// ═══════════════════════════════════════════════════════════════════
//  DIMENSION TESTS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_dimensions_encompass_all_nodes() {
    let ast = parse("graph TD\n  A-->B-->C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    for n in &layout.nodes {
        assert!(
            n.center.x + 60.0 <= layout.dimensions.width,
            "x + half_width within bounds"
        );
        assert!(
            n.center.y + 20.0 <= layout.dimensions.height,
            "y + half_height within bounds"
        );
    }
}

#[test]
fn test_layout_dimensions_increase_with_nodes() {
    let ast2 = parse("graph TD\n  A-->B").unwrap();
    let ast4 = parse("graph TD\n  A-->B-->C-->D").unwrap();
    let config = config_for_ast(&ast2);
    let layout2 = compute_layout(&ast2, &config);
    let layout4 = compute_layout(&ast4, &config);

    assert!(
        layout4.dimensions.height > layout2.dimensions.height,
        "More nodes = taller"
    );
}

// ═══════════════════════════════════════════════════════════════════
//  FALSIFICATION: KNOWN LAYOUT BUGS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_bt_does_not_reverse_y() {
    // BT direction now correctly reverses y coordinates
    let ast = parse("graph BT\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // Correct BT: A.y > B.y (A below B) — now implemented
    assert!(a.1 > b.1, "BT direction reverses y coordinates correctly");
}

#[test]
fn test_falsify_rl_does_not_reverse_x() {
    // RL direction now correctly reverses x coordinates
    let ast = parse("graph RL\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");

    // Correct RL: A.x > B.x (A right of B) — now implemented
    assert!(a.0 > b.0, "RL direction reverses x coordinates correctly");
}

#[test]
fn test_falsify_cycle_no_detection() {
    // Cycle detection now excludes back-edges from layering
    let ast = parse("graph TD\n  A-->B\n  B-->A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 2);
    // Back-edge B-->A is detected and excluded; A is at layer 0, B at layer 1
    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    assert!(a.1 < b.1, "A should be above B with cycle detection");
}

#[test]
fn test_falsify_long_cycle_no_stack_overflow() {
    // Longer cycle: A-->B-->C-->A — back-edge C-->A detected and excluded
    let ast = parse("graph TD\n  A-->B\n  B-->C\n  C-->A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 3);
    // A at layer 0, B at layer 1, C at layer 2 (C-->A back-edge excluded)
    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    assert!(a.1 < b.1, "A above B");
    assert!(b.1 < c.1, "B above C");
}

#[test]
fn test_falsify_self_loop_layout() {
    let ast = parse("graph TD\n  A-->A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 1);
}

#[test]
fn test_sequence_with_participants_has_a_layout() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec![xmermaid_parser::ast::SequenceParticipant {
            id: "A".to_string(), label: "A".to_string(), kind: xmermaid_parser::ast::SequenceParticipantKind::Participant,
        }],
        messages: vec![],
        events: vec![],
    });
    let config = config_for_ast(&ast);
    let result = compute_layout(&ast, &config);
    assert!(result.nodes.is_empty());
    assert_eq!(result.sequence.as_ref().map(|sequence| sequence.participants.len()), Some(1));
    assert_eq!(result.edges.len(), 0);
}

#[test]
fn test_falsify_no_crossing_minimization() {
    // Crossing minimization is now implemented via barycenter heuristic.
    // For A-->D, B-->C with A and B at layer 0, C and D at layer 1,
    // barycenter sorting should place A left of B and D left of C
    // (or equivalently, reduce crossings).
    let ast = parse("graph TD\n  A-->D\n  B-->C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    let d = pos(&layout, "D");

    assert_ne!(a.0, b.0, "A and B at different x positions");
    assert_ne!(c.0, d.0, "C and D at different x positions");
}

#[test]
fn test_falsify_no_rank_balancing() {
    // Rank balancing now compacts layers so there are no gaps.
    let ast = parse("graph TD\n  A-->B-->D\n  C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let a = pos(&layout, "A");
    let b = pos(&layout, "B");
    let c = pos(&layout, "C");
    let d = pos(&layout, "D");

    // A and C at layer 0, B at layer 1, D at layer 2
    assert!(a.1 < b.1, "A above B");
    assert!(b.1 < d.1, "B above D");
    assert_eq!(a.1, c.1, "A and C both at layer 0");
}

// ═══════════════════════════════════════════════════════════════════
//  EDGE CASES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_layout_empty_graph() {
    let ast = parse("graph TD").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 0);
    assert_eq!(layout.dimensions.width, 80.0);
    assert_eq!(layout.dimensions.height, 80.0);
}

#[test]
fn test_layout_single_isolated_node() {
    let ast = parse("graph TD\n  A").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 1);
    assert_eq!(pos(&layout, "A"), (100.0, 60.0));
}

#[test]
fn test_layout_many_isolated_nodes() {
    let ast = parse("graph TD\n  A B C D E").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 5);
    let y = pos(&layout, "A").1;
    for id in &["B", "C", "D", "E"] {
        assert_eq!(pos(&layout, id).1, y, "{} at same layer as A", id);
    }
}

#[test]
fn test_layout_multiple_edges_same_pair() {
    let ast = parse("graph TD\n  A-->B\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 2);
}

#[test]
fn test_layout_disconnected_subgraphs() {
    let ast = parse("graph TD\n  A-->B\n  C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 4);
    assert_eq!(pos(&layout, "A").1, pos(&layout, "C").1);
    assert_eq!(pos(&layout, "B").1, pos(&layout, "D").1);
}

// ═══════════════════════════════════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════════════════════════════════

fn pos(layout: &xmermaid_layout::LayoutResult, id: &str) -> (f64, f64) {
    let node = layout.nodes.iter().find(|n| n.id == id).unwrap();
    (node.center.x, node.center.y)
}
