use xmermaid_parser::{parse, DiagramAst, EdgeStyle, FlowDirection, NodeShape};

/// Helper: parse input and return the FlowchartAst (panics on error or non-flowchart).
fn fc(input: &str) -> xmermaid_parser::FlowchartAst {
    match parse(input).unwrap() {
        DiagramAst::Flowchart(fc) => fc,
        other => panic!("expected Flowchart, got {:?}", other),
    }
}

/// Helper: find a node by ID in the flowchart.
fn find_node<'a>(
    fc: &'a xmermaid_parser::FlowchartAst,
    id: &str,
) -> Option<&'a xmermaid_parser::Node> {
    fc.nodes.iter().find(|n| n.id == id)
}

// ============================================================
//  1. GRAPH TYPE DECLARATION
// ============================================================

#[test]
fn test_graph_keyword() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    assert!(matches!(ast, DiagramAst::Flowchart(_)));
}

#[test]
fn test_flowchart_keyword() {
    let ast = parse("flowchart TD\n  A-->B").unwrap();
    assert!(matches!(ast, DiagramAst::Flowchart(_)));
}

#[test]
fn test_graph_and_flowchart_produce_same_ast() {
    let g1 = parse("graph TD\n  A-->B").unwrap();
    let g2 = parse("flowchart TD\n  A-->B").unwrap();
    let json1 = serde_json::to_string(&g1).unwrap();
    let json2 = serde_json::to_string(&g2).unwrap();
    assert_eq!(json1, json2);
}

// ============================================================
//  2. DIRECTION SPECIFIERS
// ============================================================

#[test]
fn test_direction_td() {
    let fc = fc("graph TD\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::TD);
}

#[test]
fn test_direction_tb() {
    let fc = fc("graph TB\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::TD); // TB aliases to TD
}

#[test]
fn test_direction_bt() {
    let fc = fc("graph BT\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::BT);
}

#[test]
fn test_direction_lr() {
    let fc = fc("graph LR\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::LR);
}

#[test]
fn test_direction_rl() {
    let fc = fc("graph RL\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::RL);
}

// ============================================================
//  3. NODE SHAPES — Classic bracket syntax
// ============================================================

#[test]
fn test_shape_rect_bracket() {
    let fc = fc("graph TD\n  A[Rectangle]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[0].label, Some("Rectangle".to_string()));
}

#[test]
fn test_shape_rounded_paren() {
    let fc = fc("graph TD\n  A(Rounded)");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[0].label, Some("Rounded".to_string()));
}

#[test]
fn test_shape_circle_double_paren() {
    let fc = fc("graph TD\n  A((Circle))");
    assert_eq!(fc.nodes[0].shape, NodeShape::Circle);
    assert_eq!(fc.nodes[0].label, Some("Circle".to_string()));
}

#[test]
fn test_shape_implicit_rect_no_brackets() {
    let fc = fc("graph TD\n  A");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_empty_rect_label() {
    let fc = fc("graph TD\n  A[]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_empty_rounded_label() {
    let fc = fc("graph TD\n  A()");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_circle_with_spaces() {
    let fc = fc("graph TD\n  A((My Circle Node))");
    assert_eq!(fc.nodes[0].shape, NodeShape::Circle);
    assert_eq!(fc.nodes[0].label, Some("My Circle Node".to_string()));
}

// ─── Newly supported shapes ────────────────────────────────────

#[test]
fn test_shape_diamond() {
    let fc = fc("graph TD\n  A{Diamond}");
    assert_eq!(fc.nodes[0].shape, NodeShape::Diamond);
    assert_eq!(fc.nodes[0].label, Some("Diamond".to_string()));
}

#[test]
fn test_shape_diamond_empty_label() {
    let fc = fc("graph TD\n  A{}");
    assert_eq!(fc.nodes[0].shape, NodeShape::Diamond);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_hexagon() {
    let fc = fc("graph TD\n  A{{Hexagon}}");
    assert_eq!(fc.nodes[0].shape, NodeShape::Hexagon);
    assert_eq!(fc.nodes[0].label, Some("Hexagon".to_string()));
}

#[test]
fn test_shape_hexagon_empty_label() {
    let fc = fc("graph TD\n  A{{}}");
    assert_eq!(fc.nodes[0].shape, NodeShape::Hexagon);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_double_circle() {
    let fc = fc("graph TD\n  A(((Double Circle)))");
    assert_eq!(fc.nodes[0].shape, NodeShape::DoubleCircle);
    assert_eq!(fc.nodes[0].label, Some("Double Circle".to_string()));
}

#[test]
fn test_shape_double_circle_empty_label() {
    let fc = fc("graph TD\n  A((()))");
    assert_eq!(fc.nodes[0].shape, NodeShape::DoubleCircle);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_asymmetric() {
    let fc = fc("graph TD\n  A>Asymmetric]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Asymmetric);
    assert_eq!(fc.nodes[0].label, Some("Asymmetric".to_string()));
}

#[test]
fn test_shape_parallelogram() {
    let fc = fc("graph TD\n  A[/Parallelogram/]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Parallelogram);
    assert_eq!(fc.nodes[0].label, Some("Parallelogram".to_string()));
}

#[test]
fn test_shape_trapezoid() {
    let fc = fc("graph TD\n  A[\\Trapezoid\\]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Trapezoid);
    assert_eq!(fc.nodes[0].label, Some("Trapezoid".to_string()));
}

#[test]
fn test_shape_subroutine() {
    let fc = fc("graph TD\n  A[[Subroutine]]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Subroutine);
    assert_eq!(fc.nodes[0].label, Some("Subroutine".to_string()));
}

#[test]
fn test_diamond_in_decision_tree() {
    let fc = fc("graph TD\n  A[Start]-->B{Decision}\n  B-->C[Yes]\n  B-->D[No]");
    let b = find_node(&fc, "B").unwrap();
    assert_eq!(b.shape, NodeShape::Diamond);
    assert_eq!(b.label.as_deref(), Some("Decision"));
    let a = find_node(&fc, "A").unwrap();
    assert_eq!(a.shape, NodeShape::Rect);
}

// ─── All shapes in one diagram ─────────────────────────────────

#[test]
fn test_all_supported_shapes_in_diagram() {
    let fc = fc("graph TD\n  A[Rect]-->B(Rounded)-->C((Circle))-->D{Diamond}-->E{{Hexagon}}-->F(((DoubleCircle)))-->G>Asymmetric]-->H[/Parallelogram/]-->I[\\Trapezoid\\]-->J[[Subroutine]]");
    assert_eq!(fc.nodes.len(), 10);
    assert_eq!(find_node(&fc, "A").unwrap().shape, NodeShape::Rect);
    assert_eq!(find_node(&fc, "B").unwrap().shape, NodeShape::Rounded);
    assert_eq!(find_node(&fc, "C").unwrap().shape, NodeShape::Circle);
    assert_eq!(find_node(&fc, "D").unwrap().shape, NodeShape::Diamond);
    assert_eq!(find_node(&fc, "E").unwrap().shape, NodeShape::Hexagon);
    assert_eq!(find_node(&fc, "F").unwrap().shape, NodeShape::DoubleCircle);
    assert_eq!(find_node(&fc, "G").unwrap().shape, NodeShape::Asymmetric);
    assert_eq!(find_node(&fc, "H").unwrap().shape, NodeShape::Parallelogram);
    assert_eq!(find_node(&fc, "I").unwrap().shape, NodeShape::Trapezoid);
    assert_eq!(find_node(&fc, "J").unwrap().shape, NodeShape::Subroutine);
}

// ─── Falsification: unsupported shapes ─────────────────────────

#[test]
fn test_falsify_stadium_shape_unsupported() {
    // Stadium shape ([text]) is not yet supported.
    // The lexer enters InLabel(')') for (, reads "[Stadium" as label text,
    // then ) closes. Result: Rounded shape with label containing brackets.
    let fc = fc("graph TD\n  A([Stadium])");
    let node = find_node(&fc, "A").unwrap();
    assert_eq!(
        node.shape,
        NodeShape::Rounded,
        "([text]) parsed as Rounded, not Stadium"
    );
    assert!(node.label.as_ref().unwrap().contains('['));
}

#[test]
fn test_falsify_cylinder_shape_unsupported() {
    // Cylinder shape [(text)] is not yet supported.
    // The lexer enters InLabel(']') for [, reads "(Database" as label text,
    // then ] closes. Result: Rect shape with label containing parentheses.
    let fc = fc("graph TD\n  A[(Database)]");
    let node = find_node(&fc, "A").unwrap();
    assert_eq!(
        node.shape,
        NodeShape::Rect,
        "[(text)] parsed as Rect, not Cylinder"
    );
    assert!(node.label.as_ref().unwrap().starts_with('('));
}

#[test]
fn test_falsify_expanded_shape_syntax_unsupported() {
    // Expanded shape syntax (@{ shape: ... }) is not yet supported.
    // The @ token is Unknown and is skipped; the node gets default Rect shape.
    let result = parse("graph TD\n  A@{ shape: cloud }");
    if let Ok(DiagramAst::Flowchart(fc)) = result {
        let node = find_node(&fc, "A");
        if let Some(n) = node {
            assert_eq!(
                n.shape,
                NodeShape::Rect,
                "expanded shape syntax should not change the node shape"
            );
        }
    }
    // If it errors, that's also acceptable
}

// ============================================================
//  4. EDGE/LINK TYPES
// ============================================================

#[test]
fn test_edge_arrow() {
    let fc = fc("graph TD\n  A-->B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
}

#[test]
fn test_edge_line() {
    let fc = fc("graph TD\n  A---B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Line);
}

#[test]
fn test_edge_dotted() {
    let fc = fc("graph TD\n  A-.-B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Dotted);
}

#[test]
fn test_edge_dotted_with_arrow() {
    let fc = fc("graph TD\n  A-.->B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Dotted);
}

#[test]
fn test_edge_thick() {
    let fc = fc("graph TD\n  A==>B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Thick);
}

#[test]
fn test_edge_thick_line() {
    // KNOWN LIMITATION: === should be Thick without arrowhead, but parser treats
    // unrecognized arrow patterns as Arrow
    let fc = fc("graph TD\n  A===B");
    assert_eq!(
        fc.edges[0].style,
        EdgeStyle::Arrow,
        "Known limitation: === parsed as Arrow, not Thick"
    );
}

#[test]
fn test_edge_invisible() {
    let fc = fc("graph TD\n  A~~~B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Invisible);
}

// ─── Extended link length ────────────────────────────────────────

#[test]
fn test_edge_extended_arrow() {
    let fc = fc("graph TD\n  A--->B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
}

#[test]
fn test_edge_extended_line() {
    // KNOWN LIMITATION: ---- should be Line with extended length
    let fc = fc("graph TD\n  A----B");
    assert_eq!(
        fc.edges[0].style,
        EdgeStyle::Arrow,
        "Known limitation: ---- parsed as Arrow, not Line"
    );
}

#[test]
fn test_edge_extended_thick() {
    // KNOWN LIMITATION: ===> should be Thick with extended length
    let fc = fc("graph TD\n  A===>B");
    assert_eq!(
        fc.edges[0].style,
        EdgeStyle::Arrow,
        "Known limitation: ===> parsed as Arrow, not Thick"
    );
}

// ─── Edge labels (now supported) ───────────────────────────────

#[test]
fn test_edge_label_with_pipe() {
    let fc = fc("graph TD\n  A-->|my label|B");
    assert_eq!(fc.edges.len(), 1);
    assert_eq!(fc.edges[0].label.as_deref(), Some("my label"));
}

#[test]
fn test_multiple_edge_labels() {
    let fc = fc("graph TD\n  A-->|first|B-->|second|C");
    assert_eq!(fc.edges.len(), 2);
    assert_eq!(fc.edges[0].label.as_deref(), Some("first"));
    assert_eq!(fc.edges[1].label.as_deref(), Some("second"));
}

#[test]
fn test_edge_without_label_is_none() {
    // Edges without explicit pipe-delimited labels have label: None.
    let fc = fc("graph TD\n  A-->B");
    assert_eq!(fc.edges.len(), 1);
    assert_eq!(fc.edges[0].label, None);
}

#[test]
fn test_mixed_labeled_and_unlabeled_edges() {
    let fc = fc("graph TD\n  A-->|labeled|B-->C");
    assert_eq!(fc.edges.len(), 2);
    assert_eq!(fc.edges[0].label.as_deref(), Some("labeled"));
    assert_eq!(fc.edges[1].label, None);
}

// ─── Falsification: unsupported edge types ───────────────────────

#[test]
fn test_falsify_bidirectional_arrow_unsupported() {
    // Bidirectional arrow (<-->) is not yet supported.
    // The lexer tokenizes < as Unknown, then --> as Arrow, then B as NodeId.
    // Result: no clean A-->B edge.
    let fc = fc("graph TD\n  A<-->B");
    // A true bidirectional edge would need a distinct style.
    // Verify the edge is not a clean A-->B Arrow.
    let clean_edge = fc.edges.len() == 1
        && fc.edges[0].from == "A"
        && fc.edges[0].to == "B"
        && fc.edges[0].style == EdgeStyle::Arrow;
    assert!(
        !clean_edge,
        "bidirectional arrows should not produce a clean Arrow edge"
    );
}

#[test]
fn test_falsify_circle_edge_unsupported() {
    // Circle edge --o is not supported.
    // The lexer reads -- as Arrow, then oB as a single NodeId.
    let fc = fc("graph TD\n  A--oB");
    assert_eq!(
        fc.edges[0].to, "oB",
        "Circle edge --o parsed incorrectly (o absorbed into node ID)"
    );
}

#[test]
fn test_falsify_cross_edge_unsupported() {
    // Cross edge --x is not supported.
    // Similar to circle edge: xB becomes a single NodeId.
    let fc = fc("graph TD\n  A--xB");
    assert_eq!(
        fc.edges[0].to, "xB",
        "Cross edge --x parsed incorrectly (x absorbed into node ID)"
    );
}

#[test]
fn test_falsify_inline_edge_label_unsupported() {
    // Inline edge label (-- text -->) is not yet supported.
    // The parser treats "text" as a NodeId, creating extra nodes/edges.
    let fc = fc("graph TD\n  A-- text -->B");
    // Creates 2 edges (A->text, text->B) instead of 1 labeled edge
    assert_eq!(
        fc.edges.len(),
        2,
        "Inline label creates extra edges instead of a labeled edge"
    );
}

#[test]
fn test_falsify_edge_id_syntax_unsupported() {
    // Edge ID syntax (e1@-->) is not yet supported.
    // The @ token is Unknown and causes "e1" to be parsed as a NodeId,
    // leading to spurious nodes or an error.
    let result = parse("graph TD\n  A e1@-->B");
    if let Ok(DiagramAst::Flowchart(fc)) = result {
        // Not a clean A-->B single-edge parse
        let clean_parse = fc.edges.len() == 1
            && fc.edges[0].from == "A"
            && fc.edges[0].to == "B"
            && fc.nodes.len() == 2;
        assert!(
            !clean_parse,
            "edge ID syntax should not produce a clean parse"
        );
    }
}

// ============================================================
//  5. EDGE CHAINING
// ============================================================

#[test]
fn test_chain_two_edges() {
    let fc = fc("graph TD\n  A-->B-->C");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.edges.len(), 2);
    assert_eq!(fc.edges[0].from, "A");
    assert_eq!(fc.edges[0].to, "B");
    assert_eq!(fc.edges[1].from, "B");
    assert_eq!(fc.edges[1].to, "C");
}

#[test]
fn test_chain_four_edges() {
    let fc = fc("graph TD\n  A-->B-->C-->D-->E");
    assert_eq!(fc.nodes.len(), 5);
    assert_eq!(fc.edges.len(), 4);
}

#[test]
fn test_chain_mixed_styles() {
    let fc = fc("graph TD\n  A-->B---C-.->D==>E");
    assert_eq!(fc.edges.len(), 4);
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
    assert_eq!(fc.edges[1].style, EdgeStyle::Line);
    assert_eq!(fc.edges[2].style, EdgeStyle::Dotted);
    assert_eq!(fc.edges[3].style, EdgeStyle::Thick);
}

#[test]
fn test_chain_with_labels() {
    let fc = fc("graph TD\n  A[Start]-->B[Mid]-->C[End]");
    assert_eq!(fc.nodes[0].label, Some("Start".to_string()));
    assert_eq!(fc.nodes[1].label, Some("Mid".to_string()));
    assert_eq!(fc.nodes[2].label, Some("End".to_string()));
}

#[test]
fn test_chain_with_shapes() {
    let fc = fc("graph TD\n  A[Rect]-->B(Rounded)-->C((Circle))");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[2].shape, NodeShape::Circle);
}

// ─── & operator (now supported) ────────────────────────────────

#[test]
fn test_ampersand_operator() {
    let fc = fc("graph TD\n  A-->B&C");
    // & creates additional nodes on the same line
    assert!(fc.nodes.iter().any(|n| n.id == "A"));
    assert!(fc.nodes.iter().any(|n| n.id == "B"));
    assert!(fc.nodes.iter().any(|n| n.id == "C"));
}

#[test]
fn test_ampersand_chain() {
    let fc = fc("graph TD\n  A-->B&C&D");
    assert!(fc.nodes.iter().any(|n| n.id == "A"));
    assert!(fc.nodes.iter().any(|n| n.id == "B"));
    assert!(fc.nodes.iter().any(|n| n.id == "C"));
    assert!(fc.nodes.iter().any(|n| n.id == "D"));
}

// ============================================================
//  6. NODE ID RULES
// ============================================================

#[test]
fn test_node_id_single_char() {
    let fc = fc("graph TD\n  A-->B");
    assert_eq!(fc.nodes[0].id, "A");
    assert_eq!(fc.nodes[1].id, "B");
}

#[test]
fn test_node_id_alphanumeric() {
    let fc = fc("graph TD\n  Node1-->Node2");
    assert_eq!(fc.nodes[0].id, "Node1");
    assert_eq!(fc.nodes[1].id, "Node2");
}

#[test]
fn test_node_id_with_underscore() {
    let fc = fc("graph TD\n  my_node-->your_node");
    assert_eq!(fc.nodes[0].id, "my_node");
}

#[test]
fn test_node_id_camelcase() {
    let fc = fc("graph TD\n  startNode-->endNode");
    assert_eq!(fc.nodes[0].id, "startNode");
}

#[test]
fn test_node_id_numeric() {
    let fc = fc("graph TD\n  n1-->n2-->n3");
    assert_eq!(fc.nodes.len(), 3);
}

#[test]
fn test_node_display_id_as_label() {
    // No explicit label — id is used as display text
    let fc = fc("graph TD\n  ProcessA-->ProcessB");
    assert_eq!(fc.nodes[0].label, None);
    // Renderer should use id as fallback
    assert_eq!(fc.nodes[0].id, "ProcessA");
}

// ─── Falsification: reserved words and unsupported IDs ─────────

#[test]
fn test_falsify_end_as_node_id() {
    // "end" is a reserved word in Mermaid for subgraph termination.
    // In the current lexer, "end" is a Keyword, not a NodeId.
    // This means it cannot be used as a node ID, which is correct behavior.
    let result = parse("graph TD\n  end-->B");
    // The parser sees Keyword("end") in the flowchart body and skips it.
    // This is the correct behavior for a reserved word.
    assert!(
        result.is_ok(),
        "'end' is correctly treated as a keyword, not a node ID"
    );
}

#[test]
fn test_falsify_hyphen_in_node_id() {
    // Hyphens are arrow characters, not part of node IDs.
    // "my-node" is tokenized as "my" then arrow chars, splitting the ID.
    let result = parse("graph TD\n  my-node-->B");
    if let Ok(DiagramAst::Flowchart(fc)) = result {
        // "my-node" should NOT appear as a single node ID
        let has_my_node = fc.nodes.iter().any(|n| n.id == "my-node");
        assert!(!has_my_node, "hyphenated node IDs should not be supported");
    }
}

// ============================================================
//  7. LABEL TEXT RULES
// ============================================================

#[test]
fn test_label_with_spaces() {
    let fc = fc("graph TD\n  A[Hello World]");
    assert_eq!(fc.nodes[0].label, Some("Hello World".to_string()));
}

#[test]
fn test_label_with_colon() {
    let fc = fc("graph TD\n  A[Status: Active]");
    assert_eq!(fc.nodes[0].label, Some("Status: Active".to_string()));
}

#[test]
fn test_label_with_equals() {
    let fc = fc("graph TD\n  A[x=1]");
    assert_eq!(fc.nodes[0].label, Some("x=1".to_string()));
}

#[test]
fn test_label_with_numbers() {
    let fc = fc("graph TD\n  A[Step 123]");
    assert_eq!(fc.nodes[0].label, Some("Step 123".to_string()));
}

#[test]
fn test_label_trimmed() {
    let fc = fc("graph TD\n  A[  padded  ]");
    assert_eq!(fc.nodes[0].label, Some("padded".to_string()));
}

// ─── Falsification: special label syntax ─────────────────────────

#[test]
fn test_falsify_unicode_quotes_in_label() {
    // A["Unicode"] — " characters are part of the label text in InLabel state
    let fc = fc("graph TD\n  A[\"Unicode\"]");
    // The " characters are part of the label
    assert!(fc.nodes[0].label.as_ref().unwrap().contains('"'));
}

#[test]
fn test_falsify_markdown_labels_unsupported() {
    // A["`**Bold**`"] — backtick is part of label text, not markdown
    let fc = fc("graph TD\n  A[\"`**Bold**`\"]");
    // Markdown syntax is preserved as-is, not rendered
    let label = fc.nodes[0].label.as_ref().unwrap();
    assert!(
        label.contains("**"),
        "Markdown not rendered, preserved as text"
    );
}

#[test]
fn test_falsify_entity_codes_unsupported() {
    // A["#35;"] — entity codes not processed
    let fc = fc("graph TD\n  A[#35;]");
    let label = fc.nodes[0].label.as_ref().unwrap();
    assert!(label.contains("#35;"), "Entity codes not processed");
}

#[test]
fn test_falsify_fontawesome_in_label_unsupported() {
    // A[fa:fa-car Text] — fa: parsed as regular label text
    let fc = fc("graph TD\n  A[fa:fa-car Text]");
    assert_eq!(fc.nodes[0].label, Some("fa:fa-car Text".to_string()));
}

// ============================================================
//  8. SUBGRAPH SYNTAX (now supported)
// ============================================================

#[test]
fn test_basic_subgraph() {
    let fc = fc("graph TD\n  subgraph sg\n    A-->B\n  end");
    assert_eq!(fc.subgraphs.len(), 1);
    assert_eq!(fc.subgraphs[0].title, "sg");
    // Nodes defined inside the subgraph exist in the top-level node list
    assert!(fc.nodes.iter().any(|n| n.id == "A"));
    assert!(fc.nodes.iter().any(|n| n.id == "B"));
}

#[test]
fn test_subgraph_with_title() {
    let fc = fc("graph TD\n  subgraph myId [My Title]\n    A-->B\n  end");
    assert_eq!(fc.subgraphs.len(), 1);
    // When bracketed title is provided, it should be used as the title
    assert_eq!(fc.subgraphs[0].title, "My Title");
}

#[test]
fn test_subgraph_with_direction() {
    let fc = fc("graph TD\n  subgraph S1\n    direction LR\n    A-->B\n  end");
    assert_eq!(fc.subgraphs.len(), 1);
    assert_eq!(fc.subgraphs[0].title, "S1");
    // "direction" keyword should be consumed, not create a spurious node
    assert!(
        !fc.nodes.iter().any(|n| n.id == "direction"),
        "direction keyword inside subgraph should not create a node"
    );
}

#[test]
fn test_nested_subgraph() {
    let fc = fc("graph TD\n  subgraph outer\n    subgraph inner\n      A-->B\n    end\n  end");
    assert_eq!(fc.subgraphs.len(), 1);
    assert_eq!(fc.subgraphs[0].title, "outer");
    assert_eq!(fc.subgraphs[0].subgraphs.len(), 1);
    assert_eq!(fc.subgraphs[0].subgraphs[0].title, "inner");
}

#[test]
fn test_falsify_edge_to_subgraph_unsupported() {
    // Edges pointing to a subgraph ID are not properly supported — the
    // subgraph is not recognized as a compound edge target.
    let fc = fc("flowchart TD\n  A-->sub1\n  subgraph sub1\n    B-->C\n  end");
    // The subgraph exists
    assert_eq!(fc.subgraphs.len(), 1);
    assert_eq!(fc.subgraphs[0].title, "sub1");
    // An edge to "sub1" may exist as a regular node reference,
    // but there is no semantic edge-to-subgraph support.
    let _ = fc; // acknowledge the parse succeeds without special semantics
}

// ============================================================
//  9. STYLE AND CLASSDEF SYNTAX (parsed but skipped)
// ============================================================

#[test]
fn test_classdef_is_parsed_but_skipped() {
    // classDef should not cause an error, but the diagram should
    // still have correct nodes and edges.
    let fc = fc("graph TD\n  A-->B\n  classDef myClass fill:#f9f");
    assert_eq!(fc.nodes.len(), 2);
    assert_eq!(fc.edges.len(), 1);
}

#[test]
fn test_style_statement_is_parsed_but_skipped() {
    let fc = fc("graph TD\n  A-->B\n  style A fill:#f9f,stroke:#333");
    assert_eq!(fc.nodes.len(), 2);
    assert_eq!(fc.edges.len(), 1);
    // Style info is not applied to nodes
    let a = find_node(&fc, "A").unwrap();
    assert!(a.styles.is_empty());
}

#[test]
fn test_class_assignment_is_parsed_but_skipped() {
    // A:::myClass creates a spurious "myClass" node due to ::: tokenization,
    // but the diagram should still parse without error.
    let result = parse("graph TD\n  A:::myClass-->B");
    assert!(
        result.is_ok(),
        "::: class assignment should not cause a parse error"
    );
    if let Ok(DiagramAst::Flowchart(fc)) = result {
        // The edge should exist
        assert!(!fc.edges.is_empty());
    }
}

#[test]
fn test_falsify_link_style_unsupported() {
    // linkStyle statement is not yet supported — it creates spurious nodes.
    let result = parse("graph TD\n  A-->B\n  linkStyle 0 stroke:#ff3");
    if let Ok(DiagramAst::Flowchart(fc)) = result {
        // "linkStyle" or "0" may appear as spurious nodes
        let has_spurious = fc.nodes.iter().any(|n| n.id == "linkStyle" || n.id == "0");
        assert!(
            has_spurious || fc.nodes.len() > 2,
            "linkStyle should not be properly handled yet"
        );
    }
}

// ============================================================
//  10. CLICK SYNTAX (parsed but skipped)
// ============================================================

#[test]
fn test_click_callback_is_parsed_but_skipped() {
    let fc = fc("graph TD\n  A-->B\n  click A callback");
    assert_eq!(fc.nodes.len(), 2);
    assert_eq!(fc.edges.len(), 1);
}

#[test]
fn test_click_url_is_parsed_but_skipped() {
    let fc = fc("graph TD\n  A-->B\n  click A \"https://example.com\"");
    assert_eq!(fc.nodes.len(), 2);
    assert_eq!(fc.edges.len(), 1);
}

// ============================================================
//  11. COMMENTS (now supported)
// ============================================================

#[test]
fn test_comments_are_ignored() {
    let fc = fc("graph TD\n  %% This is a comment\n  A-->B");
    assert_eq!(fc.nodes.len(), 2);
    assert_eq!(fc.edges.len(), 1);
}

#[test]
fn test_multiple_comments() {
    let fc = fc("graph TD\n  %% Comment 1\n  A-->B\n  %% Comment 2\n  B-->C");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.edges.len(), 2);
}

// ============================================================
//  12. SEMICOLONS AS STATEMENT SEPARATORS (now supported)
// ============================================================

#[test]
fn test_semicolon_separator() {
    let fc = fc("graph TD\n  A-->B; B-->C");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.edges.len(), 2);
}

#[test]
fn test_multiple_semicolons() {
    let fc = fc("graph TD\n  A-->B; B-->C; C-->D");
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
}

// ============================================================
//  13. MULTI-LINE / BLANK LINES
// ============================================================

#[test]
fn test_multiline_statements() {
    let fc = fc("graph TD\n  A-->B\n  B-->C\n  C-->D");
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
}

#[test]
fn test_extra_blank_lines() {
    let fc = fc("graph TD\n\n  A-->B\n\n\n  B-->C\n");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.edges.len(), 2);
}

#[test]
fn test_leading_whitespace() {
    let fc = fc("graph TD\n    A-->B");
    assert_eq!(fc.nodes.len(), 2);
}

// ============================================================
//  14. COMPLEX REAL-WORLD DIAGRAMS
// ============================================================

#[test]
fn test_ci_cd_pipeline() {
    let fc = fc("graph LR\n  A[Code Commit]-->B[Build]-->C[Test]-->D[Deploy]");
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
    assert_eq!(fc.direction, FlowDirection::LR);
    assert_eq!(fc.nodes[0].label, Some("Code Commit".to_string()));
    assert_eq!(fc.nodes[3].label, Some("Deploy".to_string()));
}

#[test]
fn test_decision_tree() {
    // Use diamond shape for decision node
    let fc = fc("graph TD\n  A[Start]-->B{Decision}\n  B-->C[Yes Path]\n  B-->D[No Path]");
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
    let b = find_node(&fc, "B").unwrap();
    assert_eq!(b.shape, NodeShape::Diamond);
}

#[test]
fn test_state_machine_like() {
    let fc = fc("graph TD\n  Idle-->Running\n  Running-->Paused\n  Paused-->Running\n  Running-->Stopped\n  Idle-->Stopped");
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 5);
    let edges: Vec<_> = fc
        .edges
        .iter()
        .map(|e| (e.from.as_str(), e.to.as_str()))
        .collect();
    assert!(edges.contains(&("Idle", "Running")));
    assert!(edges.contains(&("Running", "Paused")));
    assert!(edges.contains(&("Paused", "Running")));
    assert!(edges.contains(&("Running", "Stopped")));
    assert!(edges.contains(&("Idle", "Stopped")));
}

#[test]
fn test_microservice_architecture() {
    let fc = fc("graph LR\n  Gateway-->AuthService\n  Gateway-->OrderService\n  Gateway-->UserService\n  OrderService-->Database\n  UserService-->Database\n  AuthService-->Cache");
    assert_eq!(fc.nodes.len(), 6);
    assert_eq!(fc.edges.len(), 6);
}

#[test]
fn test_multi_branch_with_merge() {
    let fc = fc("graph TD\n  A-->B\n  A-->C\n  A-->D\n  B-->E\n  C-->E\n  D-->E");
    assert_eq!(fc.nodes.len(), 5);
    assert_eq!(fc.edges.len(), 6);
    let e_incoming = fc.edges.iter().filter(|e| e.to == "E").count();
    assert_eq!(e_incoming, 3);
}

#[test]
fn test_wide_graph_10_nodes() {
    let fc = fc("graph LR\n  N1-->N2-->N3-->N4-->N5-->N6-->N7-->N8-->N9-->N10");
    assert_eq!(fc.nodes.len(), 10);
    assert_eq!(fc.edges.len(), 9);
}

#[test]
fn test_star_topology() {
    let fc = fc("graph TD\n  Hub-->S1\n  Hub-->S2\n  Hub-->S3\n  Hub-->S4\n  Hub-->S5");
    assert_eq!(fc.nodes.len(), 6);
    assert_eq!(fc.edges.len(), 5);
    let hub_outgoing = fc.edges.iter().filter(|e| e.from == "Hub").count();
    assert_eq!(hub_outgoing, 5);
}

#[test]
fn test_mixed_shapes_and_styles() {
    let fc = fc("graph TD\n  A[Start]-->B(Process)\n  B-.->C((Check))\n  C==>D[End]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[2].shape, NodeShape::Circle);
    assert_eq!(fc.nodes[3].shape, NodeShape::Rect);
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
    assert_eq!(fc.edges[1].style, EdgeStyle::Dotted);
    assert_eq!(fc.edges[2].style, EdgeStyle::Thick);
}

// ============================================================
//  15. EDGE PROPERTIES
// ============================================================

#[test]
fn test_edge_min_length_always_one() {
    let fc = fc("graph TD\n  A-->B");
    for edge in &fc.edges {
        assert_eq!(edge.min_length, 1, "min_length always 1");
    }
}

#[test]
fn test_node_classes_always_empty() {
    let fc = fc("graph TD\n  A-->B");
    for node in &fc.nodes {
        assert!(node.classes.is_empty(), "Node classes not supported in MVP");
    }
}

#[test]
fn test_node_styles_always_empty() {
    // The `styles` field on Node is Vec<String> but style info
    // from classDef/style/class statements is not applied to nodes.
    let fc = fc("graph TD\n  A[Hello]-->B[World]");
    for node in &fc.nodes {
        assert!(
            node.styles.is_empty(),
            "node {} has styles: {:?}",
            node.id,
            node.styles
        );
    }
}

#[test]
fn test_subgraphs_not_empty_when_present() {
    // Subgraphs are now supported; a diagram with subgraphs should
    // have a non-empty subgraphs vec.
    let fc = fc("graph TD\n  subgraph sg\n    A-->B\n  end");
    assert!(
        !fc.subgraphs.is_empty(),
        "Subgraphs should be populated when defined"
    );
}

#[test]
fn test_subgraphs_empty_when_absent() {
    let fc = fc("graph TD\n  A-->B");
    assert!(
        fc.subgraphs.is_empty(),
        "Subgraphs should be empty when not defined"
    );
}

// ============================================================
//  16. YAML FRONT MATTER / CONFIG (not supported)
// ============================================================

#[test]
fn test_falsify_yaml_front_matter_unsupported() {
    let result = parse("---\nconfig:\n  flowchart:\n    curve: stepBefore\n---\ngraph TD\n  A-->B");
    assert!(result.is_err(), "YAML front matter not supported");
}

// ============================================================
//  17. OTHER DIAGRAM TYPES (not supported)
// ============================================================

#[test]
fn test_sequence_diagram_is_parsed() {
    assert!(matches!(
        parse("sequenceDiagram\n  A->>B: Hello"),
        Ok(DiagramAst::Sequence(_))
    ));
}

#[test]
fn test_falsify_class_diagram() {
    assert!(parse("classDiagram\n  class A").is_err());
}

#[test]
fn test_falsify_state_diagram() {
    assert!(parse("stateDiagram-v2\n  [*]-->A").is_err());
}

#[test]
fn test_falsify_er_diagram() {
    assert!(parse("erDiagram\n  A||--o{B:contains").is_err());
}

#[test]
fn test_falsify_gantt_diagram() {
    assert!(parse("gantt\n  title A").is_err());
}

#[test]
fn test_falsify_pie_diagram() {
    assert!(parse("pie title A\n  \"B\": 1").is_err());
}

#[test]
fn test_falsify_mindmap() {
    assert!(parse("mindmap\n  root(A)").is_err());
}

// ============================================================
//  18. NODE DEDUPLICATION SEMANTICS
// ============================================================

#[test]
fn test_dedup_first_definition_wins() {
    let fc = fc("graph TD\n  A[First]-->B\n  A-->C");
    let a = fc.nodes.iter().find(|n| n.id == "A").unwrap();
    assert_eq!(a.label, Some("First".to_string()));
}

#[test]
fn test_dedup_target_appears_later_with_label() {
    let fc = fc("graph TD\n  A-->B\n  C-->B[Labeled]");
    // B first appears without label (from A-->B), then with label
    // First definition wins: B has no label
    let b = fc.nodes.iter().find(|n| n.id == "B").unwrap();
    assert_eq!(b.label, None, "First definition wins for dedup");
}

#[test]
fn test_dedup_same_node_different_edges() {
    let fc = fc("graph TD\n  A-->B\n  C-->B\n  D-->B");
    let b_count = fc.nodes.iter().filter(|n| n.id == "B").count();
    assert_eq!(b_count, 1);
}

#[test]
fn test_dedup_self_loop() {
    let fc = fc("graph TD\n  A-->A");
    assert_eq!(fc.nodes.len(), 1);
    assert_eq!(fc.edges[0].from, "A");
    assert_eq!(fc.edges[0].to, "A");
}

// ============================================================
//  19. AST SERIALIZATION COMPATIBILITY
// ============================================================

#[test]
fn test_json_contains_type_tag() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    assert!(
        json.contains("\"type\""),
        "JSON must contain type discriminator"
    );
}

#[test]
fn test_json_roundtrip_preserves_all_fields() {
    let ast = parse("graph LR\n  A[Start]-->B(End)").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    let back: DiagramAst = serde_json::from_str(&json).unwrap();

    match (ast, back) {
        (DiagramAst::Flowchart(a), DiagramAst::Flowchart(b)) => {
            assert_eq!(a.direction, b.direction);
            assert_eq!(a.nodes.len(), b.nodes.len());
            assert_eq!(a.edges.len(), b.edges.len());
            for i in 0..a.nodes.len() {
                assert_eq!(a.nodes[i].id, b.nodes[i].id);
                assert_eq!(a.nodes[i].label, b.nodes[i].label);
                assert_eq!(a.nodes[i].shape, b.nodes[i].shape);
            }
        }
        _ => panic!("Type mismatch"),
    }
}

// ============================================================
//  20. ERROR MESSAGES
// ============================================================

#[test]
fn test_error_missing_direction_contains_line_info() {
    let result = parse("graph\n  A-->B");
    let err = result.unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("line"), "Error should mention line number");
}

#[test]
fn test_error_unexpected_token_describes_expected() {
    let result = parse("TD\n  A-->B");
    let err = result.unwrap_err();
    let msg = err.to_string();
    assert!(
        msg.contains("Keyword") || msg.contains("Expected"),
        "Error should describe what was expected"
    );
}
