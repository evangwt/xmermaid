//! WASM binding tests — test the underlying logic without wasm_bindgen
//! (wasm_bindgen functions cannot be called on non-wasm32 targets)

use xmermaid_layout::LayoutConfig;
use xmermaid_parser::DiagramAst;

#[test]
fn test_parse_dsl_flowchart() {
    let ast = xmermaid_parser::parse("graph TD\n  A-->B").unwrap();
    assert!(matches!(ast, DiagramAst::Flowchart(_)));
}

#[test]
fn test_parse_dsl_invalid() {
    let result = xmermaid_parser::parse("not a diagram");
    assert!(result.is_err());
}

#[test]
fn test_get_diagram_type_flowchart() {
    let ast = xmermaid_parser::parse("graph TD\n  A-->B").unwrap();
    let type_str = match &ast {
        DiagramAst::Flowchart(_) => "flowchart",
        DiagramAst::Sequence(_) => "sequence",
        DiagramAst::Class(_) => "class",
        DiagramAst::State(_) => "state",
        DiagramAst::Er(_) => "er",
        DiagramAst::Gantt(_) => "gantt",
        DiagramAst::Pie(_) => "pie",
        DiagramAst::UserJourney(_) => "user-journey",
        DiagramAst::Timeline(_) => "timeline",
        DiagramAst::Mindmap(_) => "mindmap",
        DiagramAst::Requirement(_) => "requirement",
        DiagramAst::GitGraph(_) => "gitgraph",
        DiagramAst::C4(_) => "c4",
        DiagramAst::ZenUml(_) => "zenuml",
        DiagramAst::XyChart(_) => "xychart",
        DiagramAst::Sankey(_) => "sankey",
        DiagramAst::Quadrant(_) => "quadrant",
        DiagramAst::Architecture(_) => "architecture",
        DiagramAst::Block(_) => "block",
    };
    assert_eq!(type_str, "flowchart");
}

#[test]
fn test_parse_dsl_zenuml() {
    let ast = xmermaid_parser::parse("zenuml\n  Alice->Bob: Authenticate\n  Bob-->Alice: Token")
        .unwrap();

    assert!(matches!(ast, DiagramAst::ZenUml(_)));
}

#[test]
fn test_parse_dsl_xychart() {
    let ast = xmermaid_parser::parse("xychart-beta\n  x-axis [Q1, Q2]\n  y-axis 0 --> 100\n  bar [20, 40]\n  line [30, 50]").unwrap();
    assert!(matches!(ast, DiagramAst::XyChart(_)));
}

#[test]
fn test_parse_dsl_sankey() {
    let ast = xmermaid_parser::parse("sankey\n  A,B,8\n  B,C,8").unwrap();
    assert!(matches!(ast, DiagramAst::Sankey(_)));
}

#[test]
fn test_parse_dsl_quadrant() {
    let ast = xmermaid_parser::parse("quadrantChart\n  A: [0.25, 0.75]").unwrap();
    assert!(matches!(ast, DiagramAst::Quadrant(_)));
}

#[test]
fn test_compute_layout_user_journey_tasks() {
    let ast = xmermaid_parser::parse("journey\n  section Explore\n    Find product: 5: Buyer\n  section Buy\n    Checkout: 4: Buyer").unwrap();
    let result = xmermaid_layout::compute_layout(&ast, &LayoutConfig::default());

    assert_eq!(result.nodes.len(), 2);
    assert_eq!(result.edges.len(), 1);
    assert!(result.nodes[0].label.contains("Explore · Find product"));
}

#[test]
fn test_compute_layout() {
    let ast = xmermaid_parser::parse("graph TD\n  A-->B-->C").unwrap();
    let config = LayoutConfig::default();
    let layout = xmermaid_layout::compute_layout(&ast, &config);
    assert_eq!(layout.nodes.len(), 3);
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_compute_layout_sequence_participants() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
        messages: vec![],
    });
    let config = LayoutConfig::default();
    let result = xmermaid_layout::compute_layout(&ast, &config);
    assert_eq!(result.nodes.len(), 1);
    assert_eq!(result.edges.len(), 0);
}

#[test]
fn test_render_pipeline() {
    let ast = xmermaid_parser::parse("graph TD\n  A[Start]-->B[End]").unwrap();
    let config = LayoutConfig::default();
    let layout = xmermaid_layout::compute_layout(&ast, &config);

    let result = serde_json::json!({
        "ast": ast,
        "layout": layout,
    });
    let json = serde_json::to_string(&result).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert!(parsed["ast"].is_object());
    assert!(parsed["layout"].is_object());
    assert_eq!(parsed["ast"]["type"].as_str(), Some("flowchart"));
}

#[test]
fn test_render_pipeline_invalid() {
    let result = xmermaid_parser::parse("not valid");
    assert!(result.is_err());
}

#[test]
fn test_render_pipeline_complex() {
    let ast = xmermaid_parser::parse("graph LR\n  A-->B\n  B-->C\n  A-->C").unwrap();
    let config = LayoutConfig::default();
    let layout = xmermaid_layout::compute_layout(&ast, &config);

    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            assert_eq!(fc.edges.len(), 3);
        }
        _ => panic!("Expected Flowchart"),
    }
    assert_eq!(layout.nodes.len(), 3);
}

#[test]
fn test_full_pipeline_with_shapes() {
    let ast = xmermaid_parser::parse(
        "graph TD\n  A[Start]-->B{Decision}\n  B-->|Yes|C[Process]\n  B-->|No|D[End]",
    )
    .unwrap();
    let config = LayoutConfig::default();
    let layout = xmermaid_layout::compute_layout(&ast, &config);

    assert_eq!(layout.nodes.len(), 4);
    // Verify JSON serialization works for the full pipeline
    let json = serde_json::to_string(&serde_json::json!({ "ast": ast, "layout": layout })).unwrap();
    assert!(json.contains("\"type\""));
    assert!(json.contains("\"nodes\""));
}
