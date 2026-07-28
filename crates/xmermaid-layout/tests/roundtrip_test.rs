mod common;

use common::config_for_ast;
use xmermaid_layout::compute_layout;
use xmermaid_parser::{parse, DiagramAst};

// ─── Parse → Layout round-trips ──────────────────────────────────

#[test]
fn test_roundtrip_simple_flowchart() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // Every node in AST should have a position in layout
    match &ast {
        DiagramAst::Flowchart(fc) => {
            for node in &fc.nodes {
                let found = layout.nodes.iter().any(|n| n.id == node.id);
                assert!(found, "Node {} should have a layout position", node.id);
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_roundtrip_complex_graph() {
    let ast = parse("graph TD\n  A[Start]-->B[Process]-->C[End]\n  A-->C").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), layout.nodes.len());

            // Verify all nodes have positions
            for node in &fc.nodes {
                let found = layout.nodes.iter().find(|n| n.id == node.id);
                assert!(found.is_some(), "Node {} missing from layout", node.id);
            }

            // Verify layout dimensions encompass all positions
            for n in &layout.nodes {
                assert!(n.center.x + 60.0 <= layout.dimensions.width);
                assert!(n.center.y + 20.0 <= layout.dimensions.height);
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_roundtrip_diamond_topology() {
    let ast = parse("graph LR\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // 4 nodes, 4 edges
    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 4);
            assert_eq!(fc.edges.len(), 4);
            assert_eq!(layout.nodes.len(), 4);
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ─── AST JSON serialization round-trips ──────────────────────────

#[test]
fn test_json_roundtrip_simple() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    let back: DiagramAst = serde_json::from_str(&json).unwrap();

    match (&ast, &back) {
        (DiagramAst::Flowchart(a), DiagramAst::Flowchart(b)) => {
            assert_eq!(a.direction, b.direction);
            assert_eq!(a.nodes.len(), b.nodes.len());
            assert_eq!(a.edges.len(), b.edges.len());
        }
        _ => panic!("Type mismatch after round-trip"),
    }
}

#[test]
fn test_json_roundtrip_with_labels() {
    let ast = parse("graph LR\n  A[Start]-->B[End]").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    let back: DiagramAst = serde_json::from_str(&json).unwrap();

    match back {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].label, Some("Start".to_string()));
            assert_eq!(fc.nodes[1].label, Some("End".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_json_roundtrip_all_shapes() {
    let ast = parse("graph TD\n  A[rect] B(rounded) C((circle))").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    let back: DiagramAst = serde_json::from_str(&json).unwrap();

    match back {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].shape, xmermaid_parser::NodeShape::Rect);
            assert_eq!(fc.nodes[1].shape, xmermaid_parser::NodeShape::Rounded);
            assert_eq!(fc.nodes[2].shape, xmermaid_parser::NodeShape::Circle);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_json_roundtrip_all_edge_styles() {
    let ast = parse("graph TD\n  A-->B\n  A---C\n  A-.->D\n  A==>E\n  A~~~F").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    let back: DiagramAst = serde_json::from_str(&json).unwrap();

    match back {
        DiagramAst::Flowchart(fc) => {
            use xmermaid_parser::EdgeStyle;
            assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
            assert_eq!(fc.edges[1].style, EdgeStyle::Line);
            assert_eq!(fc.edges[2].style, EdgeStyle::Dotted);
            assert_eq!(fc.edges[3].style, EdgeStyle::Thick);
            assert_eq!(fc.edges[4].style, EdgeStyle::Invisible);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_layout_preserves_edge_styles() {
    let ast = parse("graph TD\n  A-->B\n  A---C\n  A-.->D\n  A==>E").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    use xmermaid_layout::types::EdgeStyle;
    let styles: Vec<_> = layout.edges.iter().map(|e| e.style).collect();
    assert!(
        styles.contains(&EdgeStyle::Arrow),
        "Should have Arrow style"
    );
    assert!(styles.contains(&EdgeStyle::Line), "Should have Line style");
    assert!(
        styles.contains(&EdgeStyle::Dotted),
        "Should have Dotted style"
    );
    assert!(
        styles.contains(&EdgeStyle::Thick),
        "Should have Thick style"
    );
}

// ─── Layout JSON serialization round-trips ───────────────────────

#[test]
fn test_layout_json_roundtrip() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    let json = serde_json::to_string(&layout).unwrap();
    let back: xmermaid_layout::LayoutResult = serde_json::from_str(&json).unwrap();

    assert_eq!(layout.nodes.len(), back.nodes.len());
    assert_eq!(layout.dimensions.width, back.dimensions.width);
    assert_eq!(layout.dimensions.height, back.dimensions.height);

    for i in 0..layout.nodes.len() {
        assert_eq!(layout.nodes[i].id, back.nodes[i].id);
        assert_eq!(layout.nodes[i].center.x, back.nodes[i].center.x);
        assert_eq!(layout.nodes[i].center.y, back.nodes[i].center.y);
    }
}

#[test]
fn test_layout_edge_geometry_contract_roundtrip() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);
    let edge = layout.edges.first().expect("expected one edge");

    assert_eq!(edge.geometry_version, 2);
    assert!(
        edge.source_boundary.is_some(),
        "source boundary should be explicit"
    );
    assert!(
        edge.target_boundary.is_some(),
        "target boundary should be explicit"
    );
    assert!(edge.path_end.is_some(), "path end should be explicit");
    assert!(
        edge.final_tangent_angle.is_some(),
        "final tangent angle should be explicit"
    );
    assert_eq!(
        edge.path_end, edge.target_boundary,
        "geometry v2 must not bake marker size into layout"
    );
    assert_eq!(edge.label_anchor, edge.label_position);

    let json = serde_json::to_value(&layout).unwrap();
    let json_edge = &json["edges"][0];
    assert_eq!(json_edge["geometry_version"], 2);
    assert!(json_edge["source_boundary"].is_object());
    assert!(json_edge["target_boundary"].is_object());
    assert!(json_edge["path_end"].is_object());
    assert!(json_edge["final_tangent_angle"].is_number());
    assert!(json_edge["label_anchor"].is_object());

    let back: xmermaid_layout::LayoutResult = serde_json::from_value(json).unwrap();
    let back_edge = back.edges.first().expect("expected one round-tripped edge");
    assert_eq!(back_edge.geometry_version, 2);
    assert_eq!(back_edge.source_boundary, edge.source_boundary);
    assert_eq!(back_edge.target_boundary, edge.target_boundary);
    assert_eq!(back_edge.path_end, edge.path_end);
    assert_eq!(back_edge.final_tangent_angle, edge.final_tangent_angle);
    assert_eq!(back_edge.label_anchor, edge.label_anchor);
}

// ─── Full pipeline: DSL → AST → Layout → verify ─────────────────

#[test]
fn test_pipeline_simple() {
    let dsl = "graph TD\n  A[Start]-->B[End]";
    let ast = parse(dsl).unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    // Verify: 2 nodes, 1 edge, positions exist, dimensions positive
    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 2);
            assert_eq!(fc.edges.len(), 1);
        }
        _ => panic!(),
    }
    assert_eq!(layout.nodes.len(), 2);
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_pipeline_complex() {
    let dsl = "graph LR\n  A[Input]-->B[Process]-->C[Output]\n  A-->C";
    let ast = parse(dsl).unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            assert_eq!(fc.edges.len(), 3);

            // Verify edge connectivity
            let ab = fc.edges.iter().any(|e| e.from == "A" && e.to == "B");
            let bc = fc.edges.iter().any(|e| e.from == "B" && e.to == "C");
            let ac = fc.edges.iter().any(|e| e.from == "A" && e.to == "C");
            assert!(ab && bc && ac, "Expected edges A->B, B->C, A->C");
        }
        _ => panic!(),
    }

    // Layout: A and B at different x (LR direction), C furthest right
    let a = layout.nodes.iter().find(|n| n.id == "A").unwrap();
    let c = layout.nodes.iter().find(|n| n.id == "C").unwrap();
    assert!(a.center.x < c.center.x, "In LR, A should be left of C");
}

#[test]
fn test_pipeline_preserves_node_identity() {
    // Same node referenced by multiple edges should have one position
    let dsl = "graph TD\n  A-->B\n  C-->B\n  D-->B";
    let ast = parse(dsl).unwrap();
    let config = config_for_ast(&ast);
    let layout = compute_layout(&ast, &config);

    let b_nodes: Vec<_> = layout.nodes.iter().filter(|n| n.id == "B").collect();
    assert_eq!(b_nodes.len(), 1, "B should have exactly one position");
}

// ─── Error propagation ───────────────────────────────────────────

#[test]
fn test_error_propagation_invalid_dsl() {
    let result = parse("not a diagram");
    assert!(result.is_err());
}

#[test]
fn test_sequence_without_messages_positions_participants() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
        messages: vec![],
    });
    let config = config_for_ast(&ast);
    let result = compute_layout(&ast, &config);
    assert_eq!(result.nodes.len(), 1);
    assert_eq!(result.edges.len(), 0);
}
