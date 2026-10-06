//! AI-emitted syntax tolerance at the lexer/parser layer.
//!
//! Covers two P0 gaps from docs/ai-syntax-scan.md:
//!   * `flow-edge-label-escaped-pipe` — `\|` inside a pipe edge label must not
//!     close the label (`A -->|a \| b| B`).
//!   * `class-interface-annotation` / `class-stereotype` — a stereotype on its
//!     own line before the class name (`<<interface>> A`).

use xmermaid_parser::{parse, DiagramAst};

fn flowchart_edges(source: &str) -> Vec<xmermaid_parser::Edge> {
    match parse(source).unwrap() {
        DiagramAst::Flowchart(flowchart) => flowchart.edges,
        other => panic!("expected flowchart, got {other:?}"),
    }
}

fn class_annotation(source: &str, id: &str) -> Option<String> {
    match parse(source).unwrap() {
        DiagramAst::Class(class) => class
            .classes
            .iter()
            .find(|definition| definition.id == id)
            .unwrap_or_else(|| panic!("class {id} not found"))
            .annotation
            .clone(),
        other => panic!("expected class diagram, got {other:?}"),
    }
}

#[test]
fn edge_label_backslash_escaped_pipe_does_not_terminate_the_label() {
    let edges = flowchart_edges("flowchart TD\n  A -->|a \\| b| B");
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0].label.as_deref(), Some("a | b"));
    assert_eq!(edges[0].from, "A");
    assert_eq!(edges[0].to, "B");
}

#[test]
fn edge_label_escaped_backslash_is_literal() {
    let edges = flowchart_edges("flowchart TD\n  A -->|a \\\\ b| B");
    assert_eq!(edges[0].label.as_deref(), Some("a \\ b"));
}

#[test]
fn edge_label_entity_pipe_alternative_still_parses() {
    // `#124;` is Mermaid's entity form of `|`; it must keep working.
    let edges = flowchart_edges("flowchart TD\n  A -->|a #124; b| B");
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0].from, "A");
}

#[test]
fn edge_label_without_escapes_is_unchanged() {
    let edges = flowchart_edges("flowchart TD\n  A -->|plain label| B");
    assert_eq!(edges[0].label.as_deref(), Some("plain label"));
}

#[test]
fn class_interface_annotation_prefix_sets_stereotype() {
    let annotation = class_annotation("classDiagram\n  <<interface>> A\n  A <|-- B", "A");
    assert_eq!(annotation.as_deref(), Some("<<interface>>"));
}

#[test]
fn class_stereotype_prefix_sets_stereotype() {
    let annotation = class_annotation("classDiagram\n  class A\n  <<Service>> A\n  A --> B", "A");
    assert_eq!(annotation.as_deref(), Some("<<Service>>"));
}

#[test]
fn class_annotation_prefix_is_not_regressed_by_other_forms() {
    // Postfix and in-block forms are the pre-existing supported forms.
    assert_eq!(
        class_annotation("classDiagram\n  class A\n  A <<interface>>\n  A <|-- B", "A").as_deref(),
        Some("<<interface>>"),
    );
    assert_eq!(
        class_annotation("classDiagram\n  class A {\n    <<abstract>>\n    +m()\n  }", "A").as_deref(),
        Some("<<abstract>>"),
    );
}

#[test]
fn class_annotation_prefix_with_empty_name_is_rejected() {
    assert!(parse("classDiagram\n  <<interface>>\n  A --> B").is_err());
}
