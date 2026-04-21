//! WASM binding tests — test the Rust logic without a browser

use xmermaid_wasm::*;
use xmermaid_parser::DiagramAst;

#[test]
fn test_parse_dsl_flowchart() {
    let json = parse_dsl("graph TD\n  A-->B").unwrap();
    let ast: DiagramAst = serde_json::from_str(&json).unwrap();
    assert!(matches!(ast, DiagramAst::Flowchart(_)));
}

#[test]
fn test_parse_dsl_invalid() {
    let result = parse_dsl("not a diagram");
    assert!(result.is_err());
}

#[test]
fn test_get_diagram_type_flowchart() {
    let json = parse_dsl("graph TD\n  A-->B").unwrap();
    let dtype = get_diagram_type(&json).unwrap();
    assert_eq!(dtype, "flowchart");
}

#[test]
fn test_compute_layout() {
    let json = parse_dsl("graph TD\n  A-->B-->C").unwrap();
    let layout_json = compute_layout(&json).unwrap();
    let layout: serde_json::Value = serde_json::from_str(&layout_json).unwrap();
    assert!(layout["positions"].is_array());
    assert!(layout["dimensions"]["width"].is_number());
    assert!(layout["dimensions"]["height"].is_number());
}

#[test]
fn test_compute_layout_non_flowchart() {
    let ast = DiagramAst::Sequence(xmermaid_parser::ast::SequenceAst {
        participants: vec!["A".to_string()],
    });
    let ast_json = serde_json::to_string(&ast).unwrap();
    let result = compute_layout(&ast_json);
    assert!(result.is_err());
}

#[test]
fn test_render_pipeline() {
    let json = render_pipeline("graph TD\n  A[Start]-->B[End]").unwrap();
    let result: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert!(result["ast"].is_object());
    assert!(result["layout"].is_object());
    assert!(result["ast"]["type"].as_str() == Some("flowchart"));
}

#[test]
fn test_render_pipeline_invalid() {
    let result = render_pipeline("not valid");
    assert!(result.is_err());
}

#[test]
fn test_render_pipeline_complex() {
    let json = render_pipeline("graph LR\n  A-->B\n  B-->C\n  A-->C").unwrap();
    let result: serde_json::Value = serde_json::from_str(&json).unwrap();
    let ast = &result["ast"];
    assert_eq!(ast["nodes"].as_array().unwrap().len(), 3);
    assert_eq!(ast["edges"].as_array().unwrap().len(), 3);
}
