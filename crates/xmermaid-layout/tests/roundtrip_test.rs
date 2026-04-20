use xmermaid_layout::compute_flowchart_layout;
use xmermaid_parser::{parse, DiagramAst};

// ─── Parse → Layout round-trips ──────────────────────────────────

#[test]
fn test_roundtrip_simple_flowchart() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // Every node in AST should have a position in layout
    match &ast {
        DiagramAst::Flowchart(fc) => {
            for node in &fc.nodes {
                let found = layout.positions.iter().any(|(id, _)| id == &node.id);
                assert!(found, "Node {} should have a layout position", node.id);
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_roundtrip_complex_graph() {
    let ast = parse("graph TD\n  A[Start]-->B[Process]-->C[End]\n  A-->C").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), layout.positions.len());

            // Verify all nodes have positions
            for node in &fc.nodes {
                let pos = layout.positions.iter().find(|(id, _)| id == &node.id);
                assert!(pos.is_some(), "Node {} missing from layout", node.id);
            }

            // Verify layout dimensions encompass all positions
            for (_, point) in &layout.positions {
                assert!(point.x + 60.0 <= layout.dimensions.width);
                assert!(point.y + 20.0 <= layout.dimensions.height);
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_roundtrip_diamond_topology() {
    let ast = parse("graph LR\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // 4 nodes, 4 edges
    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 4);
            assert_eq!(fc.edges.len(), 4);
            assert_eq!(layout.positions.len(), 4);
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

// ─── Layout JSON serialization round-trips ───────────────────────

#[test]
fn test_layout_json_roundtrip() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();
    let json = serde_json::to_string(&layout).unwrap();
    let back: xmermaid_layout::LayoutResult = serde_json::from_str(&json).unwrap();

    assert_eq!(layout.positions.len(), back.positions.len());
    assert_eq!(layout.dimensions.width, back.dimensions.width);
    assert_eq!(layout.dimensions.height, back.dimensions.height);

    for i in 0..layout.positions.len() {
        assert_eq!(layout.positions[i].0, back.positions[i].0);
        assert_eq!(layout.positions[i].1.x, back.positions[i].1.x);
        assert_eq!(layout.positions[i].1.y, back.positions[i].1.y);
    }
}

// ─── Full pipeline: DSL → AST → Layout → verify ─────────────────

#[test]
fn test_pipeline_simple() {
    let dsl = "graph TD\n  A[Start]-->B[End]";
    let ast = parse(dsl).unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    // Verify: 2 nodes, 1 edge, positions exist, dimensions positive
    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 2);
            assert_eq!(fc.edges.len(), 1);
        }
        _ => panic!(),
    }
    assert_eq!(layout.positions.len(), 2);
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_pipeline_complex() {
    let dsl = "graph LR\n  A[Input]-->B[Process]-->C[Output]\n  A-->C";
    let ast = parse(dsl).unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

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
    let a = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let c = layout.positions.iter().find(|(id, _)| id == "C").unwrap().1;
    assert!(a.x < c.x, "In LR, A should be left of C");
}

#[test]
fn test_pipeline_preserves_node_identity() {
    // Same node referenced by multiple edges should have one position
    let dsl = "graph TD\n  A-->B\n  C-->B\n  D-->B";
    let ast = parse(dsl).unwrap();
    let layout = compute_flowchart_layout(&ast).unwrap();

    let b_positions: Vec<_> = layout.positions.iter().filter(|(id, _)| id == "B").collect();
    assert_eq!(b_positions.len(), 1, "B should have exactly one position");
}

// ─── Error propagation ───────────────────────────────────────────

#[test]
fn test_error_propagation_invalid_dsl() {
    let result = parse("not a diagram");
    assert!(result.is_err());
}

#[test]
fn test_error_propagation_sequence_to_layout() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
    });
    let result = compute_flowchart_layout(&ast);
    assert!(result.is_err());
}
