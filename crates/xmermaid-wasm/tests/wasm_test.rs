//! WASM binding tests — test the underlying logic without wasm_bindgen
//! (wasm_bindgen functions cannot be called on non-wasm32 targets)

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
    };
    assert_eq!(type_str, "flowchart");
}

#[test]
fn test_compute_layout() {
    let ast = xmermaid_parser::parse("graph TD\n  A-->B-->C").unwrap();
    let layout = xmermaid_layout::compute_flowchart_layout(&ast).unwrap();
    assert_eq!(layout.positions.len(), 3);
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_compute_layout_non_flowchart() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
    });
    let result = xmermaid_layout::compute_flowchart_layout(&ast);
    assert!(result.is_err());
}

#[test]
fn test_render_pipeline() {
    let ast = xmermaid_parser::parse("graph TD\n  A[Start]-->B[End]").unwrap();
    let layout = xmermaid_layout::compute_flowchart_layout(&ast).unwrap();

    let result = serde_json::json!({
        "ast": ast,
        "layout": layout,
    });
    let json = serde_json::to_string(&result).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert!(parsed["ast"].is_object());
    assert!(parsed["layout"].is_object());
    assert_eq!(parsed["ast"]["type"].as_str(), Some("Flowchart"));
}

#[test]
fn test_render_pipeline_invalid() {
    let result = xmermaid_parser::parse("not valid");
    assert!(result.is_err());
}

#[test]
fn test_render_pipeline_complex() {
    let ast = xmermaid_parser::parse("graph LR\n  A-->B\n  B-->C\n  A-->C").unwrap();
    let layout = xmermaid_layout::compute_flowchart_layout(&ast).unwrap();

    match &ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            assert_eq!(fc.edges.len(), 3);
        }
        _ => panic!("Expected Flowchart"),
    }
    assert_eq!(layout.positions.len(), 3);
}

#[test]
fn test_full_pipeline_with_shapes() {
    let ast = xmermaid_parser::parse("graph TD\n  A[Start]-->B{Decision}\n  B-->|Yes|C[Process]\n  B-->|No|D[End]").unwrap();
    let layout = xmermaid_layout::compute_flowchart_layout(&ast).unwrap();

    assert_eq!(layout.positions.len(), 4);
    // Verify JSON serialization works for the full pipeline
    let json = serde_json::to_string(&serde_json::json!({ "ast": ast, "layout": layout })).unwrap();
    assert!(json.contains("\"type\""));
    assert!(json.contains("\"positions\""));
}
