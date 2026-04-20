//! Deep syntax coverage tests for xmermaid parser
//!
//! Tests are organized by Mermaid flowchart syntax categories,
//! with each test using realistic diagram examples.
//! Falsification tests verify unsupported/known-limitation behavior.

use xmermaid_parser::{parse, DiagramAst, EdgeStyle, FlowDirection, NodeShape};

// ═══════════════════════════════════════════════════════════════════
//  1. GRAPH TYPE DECLARATION
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
//  2. DIRECTION SPECIFIERS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_direction_td() {
    let fc = get_flowchart("graph TD\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::TD);
}

#[test]
fn test_direction_tb() {
    let fc = get_flowchart("graph TB\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::TD); // TB aliases to TD
}

#[test]
fn test_direction_bt() {
    let fc = get_flowchart("graph BT\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::BT);
}

#[test]
fn test_direction_lr() {
    let fc = get_flowchart("graph LR\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::LR);
}

#[test]
fn test_direction_rl() {
    let fc = get_flowchart("graph RL\n  A-->B");
    assert_eq!(fc.direction, FlowDirection::RL);
}

// ═══════════════════════════════════════════════════════════════════
//  3. NODE SHAPES — Classic bracket syntax
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_shape_rect_bracket() {
    let fc = get_flowchart("graph TD\n  A[Rectangle]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[0].label, Some("Rectangle".to_string()));
}

#[test]
fn test_shape_rounded_paren() {
    let fc = get_flowchart("graph TD\n  A(Rounded)");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[0].label, Some("Rounded".to_string()));
}

#[test]
fn test_shape_circle_double_paren() {
    let fc = get_flowchart("graph TD\n  A((Circle))");
    assert_eq!(fc.nodes[0].shape, NodeShape::Circle);
    assert_eq!(fc.nodes[0].label, Some("Circle".to_string()));
}

#[test]
fn test_shape_implicit_rect_no_brackets() {
    let fc = get_flowchart("graph TD\n  A");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_empty_rect_label() {
    let fc = get_flowchart("graph TD\n  A[]");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_empty_rounded_label() {
    let fc = get_flowchart("graph TD\n  A()");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[0].label, None);
}

#[test]
fn test_shape_circle_with_spaces() {
    let fc = get_flowchart("graph TD\n  A((My Circle Node))");
    assert_eq!(fc.nodes[0].shape, NodeShape::Circle);
    assert_eq!(fc.nodes[0].label, Some("My Circle Node".to_string()));
}

// ─── All shapes in one diagram ───────────────────────────────────

#[test]
fn test_all_supported_shapes_in_diagram() {
    let fc = get_flowchart("graph TD\n  A[Rect]-->B(Rounded)-->C((Circle))");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[2].shape, NodeShape::Circle);
}

// ─── Falsification: unsupported shapes ───────────────────────────

#[test]
fn test_falsify_stadium_shape_unsupported() {
    // A([Stadium]) — lexer sees ( then enters InLabel, reads "[Stadium"
    let result = parse("graph TD\n  A([Stadium])");
    // The lexer's InLabel(')') reads "[Stadium" as label text
    // Parser sees BracketOpen("("), Label("[Stadium"), BracketClose(")")
    // This produces Rounded shape with label "[Stadium", not Stadium
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes[0].shape, NodeShape::Rounded, "([...]) parsed as Rounded, not Stadium");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_subroutine_shape_unsupported() {
    // A[[Subroutine]] — lexer sees [ then InLabel, reads "[Subroutine"
    let result = parse("graph TD\n  A[[Subroutine]]");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes[0].shape, NodeShape::Rect, "[[...]] parsed as Rect, not Subroutine");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_diamond_shape_unsupported() {
    // A{Diamond} — { is Unknown token
    let result = parse("graph TD\n  A{Diamond}");
    assert!(result.is_err(), "Diamond shape curly-brace not supported");
}

#[test]
fn test_falsify_hexagon_shape_unsupported() {
    // A{{Hexagon}} — { is Unknown token
    let result = parse("graph TD\n  A{{Hexagon}}");
    assert!(result.is_err(), "Hexagon shape {{text}} not supported");
}

#[test]
fn test_falsify_asymmetric_shape_unsupported() {
    // A>Asymmetric] — > is part of arrow chars, not a bracket
    let result = parse("graph TD\n  A>Asymmetric]");
    assert!(result.is_err(), "Asymmetric shape >text] not supported");
}

#[test]
fn test_falsify_cylinder_shape_unsupported() {
    // A[(Database)] — lexer sees [ then enters InLabel(']'), reads "(Database" as label
    // Parser sees BracketOpen("["), Label("(Database"), BracketClose(")"), BracketClose("]")
    // Shape is Rect because bracket is "[", label is "(Database"
    let result = parse("graph TD\n  A[(Database)]");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes[0].shape, NodeShape::Rect, "[(...)] parsed as Rect, not Cylinder");
                // Label includes the inner ( character
                assert!(fc.nodes[0].label.as_ref().unwrap().starts_with('('));
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_parallelogram_shape_unsupported() {
    // A[/Parallelogram/] — / is Unknown token, causes parse error
    // Even if it didn't, the lexer has no bracket type for /
    let result = parse("graph TD\n  A[/Parallelogram/]");
    // / inside [] is part of label text (InLabel state)
    // Actually [ enters InLabel(']'), reads "/Parallelogram/" as label
    // Then ] closes. Shape is Rect with label "/Parallelogram/"
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes[0].shape, NodeShape::Rect, "[/text/] parsed as Rect, not Parallelogram");
                assert!(fc.nodes[0].label.as_ref().unwrap().contains('/'));
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_trapezoid_shape_unsupported() {
    // A[/Trapezoid\] — \ is Unknown token
    // Inside [], the lexer's InLabel reads "/Trapezoid\\" as label text
    // Shape is Rect with label containing / and \
    let result = parse("graph TD\n  A[/Trapezoid\\]");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.nodes[0].shape, NodeShape::Rect, "[/text\\] parsed as Rect, not Trapezoid");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_double_circle_shape_unsupported() {
    // A(((Double Circle))) — triple parens not handled
    let result = parse("graph TD\n  A(((Double Circle)))");
    // Lexer sees ( -> InLabel(')'), reads "((Double Circle" as label
    // Parser detects circle from label starting with "(", but triple is not handled
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                // Will be parsed as Circle but with wrong label
                assert_ne!(fc.nodes[0].shape, NodeShape::DoubleCircle, "(((...))) not supported as DoubleCircle");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_expanded_shape_syntax_unsupported() {
    // A@{ shape: cloud } — @ is Unknown token
    let result = parse("graph TD\n  A@{ shape: cloud }");
    assert!(result.is_err(), "@{{ shape: ... }} syntax not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  4. EDGE/LINK TYPES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_edge_arrow() {
    let fc = get_flowchart("graph TD\n  A-->B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
}

#[test]
fn test_edge_line() {
    let fc = get_flowchart("graph TD\n  A---B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Line);
}

#[test]
fn test_edge_dotted() {
    let fc = get_flowchart("graph TD\n  A-.-B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Dotted);
}

#[test]
fn test_edge_dotted_with_arrow() {
    let fc = get_flowchart("graph TD\n  A-.->B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Dotted);
}

#[test]
fn test_edge_thick() {
    let fc = get_flowchart("graph TD\n  A==>B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Thick);
}

#[test]
fn test_edge_thick_line() {
    // === is lexed as Arrow("==="), parser defaults to Arrow for unknown arrow values
    // KNOWN LIMITATION: === should be Thick without arrowhead, but parser treats
    // unrecognized arrow patterns as Arrow
    let fc = get_flowchart("graph TD\n  A===B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow, "Known limitation: === parsed as Arrow, not Thick");
}

#[test]
fn test_edge_invisible() {
    let fc = get_flowchart("graph TD\n  A~~~B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Invisible);
}

// ─── Extended link length ────────────────────────────────────────

#[test]
fn test_edge_extended_arrow() {
    // ---> is 3 dashes + arrow, still an arrow
    let fc = get_flowchart("graph TD\n  A--->B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
}

#[test]
fn test_edge_extended_line() {
    // ---- is lexed as Arrow("----"), parser defaults to Arrow for unknown values
    // KNOWN LIMITATION: ---- should be Line with extended length, but parser
    // treats unrecognized arrow patterns as Arrow
    let fc = get_flowchart("graph TD\n  A----B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow, "Known limitation: ---- parsed as Arrow, not Line");
}

#[test]
fn test_edge_extended_thick() {
    // ===> is lexed as Arrow("===>"), parser defaults to Arrow for unknown values
    // KNOWN LIMITATION: ===> should be Thick with extended length
    let fc = get_flowchart("graph TD\n  A===>B");
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow, "Known limitation: ===> parsed as Arrow, not Thick");
}

// ─── Falsification: unsupported edge types ───────────────────────

#[test]
fn test_falsify_bidirectional_arrow_unsupported() {
    // <--> — lexer reads <-- as arrow (includes <), then > as part of next
    // Actually lexer reads < as Unknown, then -- as arrow, then > as part of arrow
    let result = parse("graph TD\n  A<-->B");
    // < is Unknown, --> is Arrow, B is NodeId
    // Parser fails because it expects NodeId after direction, not Unknown
    assert!(result.is_err(), "Bidirectional <--> not supported");
}

#[test]
fn test_falsify_circle_edge_unsupported() {
    // --o — o is not an arrow character, so -- is Unknown (length < 2? no, -- is length 2)
    // Actually lexer reads -- as arrow, then o as NodeId
    let result = parse("graph TD\n  A--oB");
    // -- is Arrow, oB is NodeId — but "oB" starts with lowercase o
    // This will parse as A --[Arrow]--> oB, which is wrong
    // The edge style for "--" defaults to Arrow
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.edges.len(), 1);
                assert_eq!(fc.edges[0].to, "oB", "Circle edge --o parsed incorrectly");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_cross_edge_unsupported() {
    // --x — similar to circle edge
    let result = parse("graph TD\n  A--xB");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                assert_eq!(fc.edges[0].to, "xB", "Cross edge --x parsed incorrectly");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_edge_label_pipe_unsupported() {
    // -->|label| — pipe | is Unknown token
    let result = parse("graph TD\n  A-->|label|B");
    assert!(result.is_err(), "Edge label with |text| not supported");
}

#[test]
fn test_falsify_edge_label_inline_unsupported() {
    // -- text --> — space after -- makes "text" a NodeId, not a label
    let result = parse("graph TD\n  A-- text -->B");
    // -- is Arrow, text is NodeId, --> is Arrow, B is NodeId
    // This creates edge A->text with style Arrow, then text->B
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                // Creates 2 edges instead of 1 labeled edge
                assert_eq!(fc.edges.len(), 2, "Inline label creates extra edges");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_edge_id_syntax_unsupported() {
    // e1@--> — @ is Unknown token
    let result = parse("graph TD\n  A e1@-->B");
    assert!(result.is_err(), "Edge ID e1@--> not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  5. EDGE CHAINING
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_chain_two_edges() {
    let fc = get_flowchart("graph TD\n  A-->B-->C");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.edges.len(), 2);
    assert_eq!(fc.edges[0].from, "A");
    assert_eq!(fc.edges[0].to, "B");
    assert_eq!(fc.edges[1].from, "B");
    assert_eq!(fc.edges[1].to, "C");
}

#[test]
fn test_chain_four_edges() {
    let fc = get_flowchart("graph TD\n  A-->B-->C-->D-->E");
    assert_eq!(fc.nodes.len(), 5);
    assert_eq!(fc.edges.len(), 4);
}

#[test]
fn test_chain_mixed_styles() {
    let fc = get_flowchart("graph TD\n  A-->B---C-.->D==>E");
    assert_eq!(fc.edges.len(), 4);
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
    assert_eq!(fc.edges[1].style, EdgeStyle::Line);
    assert_eq!(fc.edges[2].style, EdgeStyle::Dotted);
    assert_eq!(fc.edges[3].style, EdgeStyle::Thick);
}

#[test]
fn test_chain_with_labels() {
    let fc = get_flowchart("graph TD\n  A[Start]-->B[Mid]-->C[End]");
    assert_eq!(fc.nodes[0].label, Some("Start".to_string()));
    assert_eq!(fc.nodes[1].label, Some("Mid".to_string()));
    assert_eq!(fc.nodes[2].label, Some("End".to_string()));
}

#[test]
fn test_chain_with_shapes() {
    let fc = get_flowchart("graph TD\n  A[Rect]-->B(Rounded)-->C((Circle))");
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[2].shape, NodeShape::Circle);
}

// ─── Falsification: & operator ───────────────────────────────────

#[test]
fn test_falsify_ampersand_operator_unsupported() {
    // A --> B & C — & is Unknown token
    let result = parse("graph TD\n  A-->B&C");
    assert!(result.is_err(), "& operator not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  6. NODE ID RULES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_node_id_single_char() {
    let fc = get_flowchart("graph TD\n  A-->B");
    assert_eq!(fc.nodes[0].id, "A");
    assert_eq!(fc.nodes[1].id, "B");
}

#[test]
fn test_node_id_alphanumeric() {
    let fc = get_flowchart("graph TD\n  Node1-->Node2");
    assert_eq!(fc.nodes[0].id, "Node1");
    assert_eq!(fc.nodes[1].id, "Node2");
}

#[test]
fn test_node_id_with_underscore() {
    let fc = get_flowchart("graph TD\n  my_node-->your_node");
    assert_eq!(fc.nodes[0].id, "my_node");
}

#[test]
fn test_node_id_camelcase() {
    let fc = get_flowchart("graph TD\n  startNode-->endNode");
    assert_eq!(fc.nodes[0].id, "startNode");
}

#[test]
fn test_node_id_numeric() {
    let fc = get_flowchart("graph TD\n  n1-->n2-->n3");
    assert_eq!(fc.nodes.len(), 3);
}

#[test]
fn test_node_display_id_as_label() {
    // No explicit label — id is used as display text
    let fc = get_flowchart("graph TD\n  ProcessA-->ProcessB");
    assert_eq!(fc.nodes[0].label, None);
    // Renderer should use id as fallback
    assert_eq!(fc.nodes[0].id, "ProcessA");
}

// ─── Falsification: reserved words ───────────────────────────────

#[test]
fn test_falsify_end_as_node_id() {
    // "end" is a reserved word in Mermaid for subgraph termination
    // In our lexer, "end" is a NodeId (not a keyword)
    // This means it can be used as a node ID, which is incorrect
    let result = parse("graph TD\n  end-->B");
    // Currently parses successfully — this is a known limitation
    assert!(result.is_ok(), "Known limitation: 'end' not treated as reserved word");
}

#[test]
fn test_falsify_hyphen_in_node_id() {
    // Hyphens are arrow characters, not part of node IDs
    // "my-node" would be tokenized as "my" then arrow chars
    let result = parse("graph TD\n  my-node-->B");
    // "my" is NodeId, "-" is Unknown (single char), "node" is NodeId
    assert!(result.is_err(), "Hyphens in node IDs not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  7. LABEL TEXT RULES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_label_with_spaces() {
    let fc = get_flowchart("graph TD\n  A[Hello World]");
    assert_eq!(fc.nodes[0].label, Some("Hello World".to_string()));
}

#[test]
fn test_label_with_colon() {
    let fc = get_flowchart("graph TD\n  A[Status: Active]");
    assert_eq!(fc.nodes[0].label, Some("Status: Active".to_string()));
}

#[test]
fn test_label_with_equals() {
    let fc = get_flowchart("graph TD\n  A[x=1]");
    assert_eq!(fc.nodes[0].label, Some("x=1".to_string()));
}

#[test]
fn test_label_with_numbers() {
    let fc = get_flowchart("graph TD\n  A[Step 123]");
    assert_eq!(fc.nodes[0].label, Some("Step 123".to_string()));
}

#[test]
fn test_label_trimmed() {
    // Label content should be trimmed
    let fc = get_flowchart("graph TD\n  A[  padded  ]");
    assert_eq!(fc.nodes[0].label, Some("padded".to_string()));
}

// ─── Falsification: special label syntax ─────────────────────────

#[test]
fn test_falsify_unicode_quotes_unsupported() {
    // A["Unicode: 你好"] — " is Unknown token inside label
    // Actually, " is inside InLabel state, so it's part of the label text
    let result = parse("graph TD\n  A[\"Unicode\"]");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                // The " characters are part of the label
                assert!(fc.nodes[0].label.as_ref().unwrap().contains('"'));
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_markdown_labels_unsupported() {
    // A["`**Bold**`"] — backtick is part of label text, not markdown
    let result = parse("graph TD\n  A[\"`**Bold**`\"]");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                // Markdown syntax is preserved as-is, not rendered
                let label = fc.nodes[0].label.as_ref().unwrap();
                assert!(label.contains("**"), "Markdown not rendered, preserved as text");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_entity_codes_unsupported() {
    // A["#35;"] — entity codes not processed
    let result = parse("graph TD\n  A[#35;]");
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                let label = fc.nodes[0].label.as_ref().unwrap();
                assert!(label.contains("#35;"), "Entity codes not processed");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_fontawesome_in_label_unsupported() {
    // A[fa:fa-car Text] — fa: parsed as regular label text
    let fc = get_flowchart("graph TD\n  A[fa:fa-car Text]");
    assert_eq!(fc.nodes[0].label, Some("fa:fa-car Text".to_string()));
}

// ═══════════════════════════════════════════════════════════════════
//  8. SUBGRAPH SYNTAX
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_basic_subgraph_unsupported() {
    let result = parse("graph TD\n  subgraph sg\n    A-->B\n  end");
    assert!(result.is_err(), "Subgraph not supported in MVP");
}

#[test]
fn test_falsify_subgraph_with_title_unsupported() {
    let result = parse("graph TD\n  subgraph myId [My Title]\n    A-->B\n  end");
    assert!(result.is_err(), "Subgraph with title not supported");
}

#[test]
fn test_falsify_subgraph_with_direction_unsupported() {
    let result = parse("graph TD\n  subgraph S1\n    direction LR\n    A-->B\n  end");
    assert!(result.is_err(), "Subgraph with direction not supported");
}

#[test]
fn test_falsify_nested_subgraph_unsupported() {
    let result = parse("graph TD\n  subgraph outer\n    subgraph inner\n      A-->B\n    end\n  end");
    assert!(result.is_err(), "Nested subgraphs not supported");
}

#[test]
fn test_falsify_edge_to_subgraph_unsupported() {
    let result = parse("flowchart TD\n  A-->sub1\n  subgraph sub1\n    B-->C\n  end");
    assert!(result.is_err(), "Edges to subgraphs not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  9. STYLE AND CLASSDEF SYNTAX
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_style_statement_unsupported() {
    let result = parse("graph TD\n  A-->B\n  style A fill:#f9f,stroke:#333");
    // "style" is a NodeId, "A" is NodeId, etc. — will cause parse errors
    assert!(result.is_err(), "style statement not supported");
}

#[test]
fn test_falsify_classdef_unsupported() {
    let result = parse("graph TD\n  A-->B\n  classDef myClass fill:#f9f");
    assert!(result.is_err(), "classDef not supported");
}

#[test]
fn test_falsify_class_assignment_unsupported() {
    let result = parse("graph TD\n  A:::myClass-->B");
    // ::: — : is Unknown token
    assert!(result.is_err(), "::: class assignment not supported");
}

#[test]
fn test_falsify_link_style_unsupported() {
    let result = parse("graph TD\n  A-->B\n  linkStyle 0 stroke:#ff3");
    assert!(result.is_err(), "linkStyle not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  10. CLICK SYNTAX
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_click_callback_unsupported() {
    let result = parse("graph TD\n  A-->B\n  click A callback");
    // "click" is NodeId, "A" is NodeId, "callback" is NodeId
    // Will create standalone nodes, not a click binding
    if let Ok(ast) = result {
        match ast {
            DiagramAst::Flowchart(fc) => {
                // Creates extra nodes "click", "A", "callback"
                assert!(fc.nodes.len() > 2, "click creates spurious nodes");
            }
            _ => panic!("Expected Flowchart"),
        }
    }
}

#[test]
fn test_falsify_click_url_unsupported() {
    let result = parse("graph TD\n  A-->B\n  click A \"https://example.com\"");
    assert!(result.is_err(), "click URL not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  11. COMMENTS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_comments_unsupported() {
    // %% is not recognized as comment syntax
    // % is Unknown token, second % is also Unknown
    let result = parse("graph TD\n  %% This is a comment\n  A-->B");
    // %% produces Unknown tokens which cause parse failure
    assert!(result.is_err(), "%% comments not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  12. MULTI-LINE / SEMICOLONS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_multiline_statements() {
    let fc = get_flowchart("graph TD\n  A-->B\n  B-->C\n  C-->D");
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
}

#[test]
fn test_falsify_semicolon_separator_unsupported() {
    // A --> B; B --> C; — semicolon is Unknown token
    let result = parse("graph TD\n  A-->B; B-->C");
    assert!(result.is_err(), "Semicolons not supported as statement separators");
}

#[test]
fn test_extra_blank_lines() {
    let fc = get_flowchart("graph TD\n\n  A-->B\n\n\n  B-->C\n");
    assert_eq!(fc.nodes.len(), 3);
    assert_eq!(fc.edges.len(), 2);
}

#[test]
fn test_leading_whitespace() {
    let fc = get_flowchart("graph TD\n    A-->B");
    assert_eq!(fc.nodes.len(), 2);
}

// ═══════════════════════════════════════════════════════════════════
//  13. COMPLEX REAL-WORLD DIAGRAMS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_ci_cd_pipeline() {
    let fc = get_flowchart(
        "graph LR\n  A[Code Commit]-->B[Build]-->C[Test]-->D[Deploy]"
    );
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
    assert_eq!(fc.direction, FlowDirection::LR);
    assert_eq!(fc.nodes[0].label, Some("Code Commit".to_string()));
    assert_eq!(fc.nodes[3].label, Some("Deploy".to_string()));
}

#[test]
fn test_decision_tree() {
    // Diamond {Decision} is unsupported, so use rect version
    let fc = get_flowchart(
        "graph TD\n  A[Start]-->B[Decision]\n  B-->C[Yes Path]\n  B-->D[No Path]"
    );
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 3);
}

#[test]
fn test_state_machine_like() {
    let fc = get_flowchart(
        "graph TD\n  Idle-->Running\n  Running-->Paused\n  Paused-->Running\n  Running-->Stopped\n  Idle-->Stopped"
    );
    assert_eq!(fc.nodes.len(), 4);
    assert_eq!(fc.edges.len(), 5);
    // Verify all edges
    let edges: Vec<_> = fc.edges.iter().map(|e| (e.from.as_str(), e.to.as_str())).collect();
    assert!(edges.contains(&("Idle", "Running")));
    assert!(edges.contains(&("Running", "Paused")));
    assert!(edges.contains(&("Paused", "Running")));
    assert!(edges.contains(&("Running", "Stopped")));
    assert!(edges.contains(&("Idle", "Stopped")));
}

#[test]
fn test_microservice_architecture() {
    let fc = get_flowchart(
        "graph LR\n  Gateway-->AuthService\n  Gateway-->OrderService\n  Gateway-->UserService\n  OrderService-->Database\n  UserService-->Database\n  AuthService-->Cache"
    );
    assert_eq!(fc.nodes.len(), 6);
    assert_eq!(fc.edges.len(), 6);
}

#[test]
fn test_multi_branch_with_merge() {
    let fc = get_flowchart(
        "graph TD\n  A-->B\n  A-->C\n  A-->D\n  B-->E\n  C-->E\n  D-->E"
    );
    assert_eq!(fc.nodes.len(), 5);
    assert_eq!(fc.edges.len(), 6);
    // E should have 3 incoming edges
    let e_incoming = fc.edges.iter().filter(|e| e.to == "E").count();
    assert_eq!(e_incoming, 3);
}

#[test]
fn test_wide_graph_10_nodes() {
    let fc = get_flowchart(
        "graph LR\n  N1-->N2-->N3-->N4-->N5-->N6-->N7-->N8-->N9-->N10"
    );
    assert_eq!(fc.nodes.len(), 10);
    assert_eq!(fc.edges.len(), 9);
}

#[test]
fn test_star_topology() {
    // Hub and spoke
    let fc = get_flowchart(
        "graph TD\n  Hub-->S1\n  Hub-->S2\n  Hub-->S3\n  Hub-->S4\n  Hub-->S5"
    );
    assert_eq!(fc.nodes.len(), 6);
    assert_eq!(fc.edges.len(), 5);
    let hub_outgoing = fc.edges.iter().filter(|e| e.from == "Hub").count();
    assert_eq!(hub_outgoing, 5);
}

#[test]
fn test_mixed_shapes_and_styles() {
    let fc = get_flowchart(
        "graph TD\n  A[Start]-->B(Process)\n  B-.->C((Check))\n  C==>D[End]"
    );
    assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
    assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
    assert_eq!(fc.nodes[2].shape, NodeShape::Circle);
    assert_eq!(fc.nodes[3].shape, NodeShape::Rect);
    assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
    assert_eq!(fc.edges[1].style, EdgeStyle::Dotted);
    assert_eq!(fc.edges[2].style, EdgeStyle::Thick);
}

// ═══════════════════════════════════════════════════════════════════
//  14. EDGE PROPERTIES (MVP limitations)
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_edge_label_always_none() {
    let fc = get_flowchart("graph TD\n  A-->B");
    for edge in &fc.edges {
        assert_eq!(edge.label, None, "Edge labels not supported in MVP");
    }
}

#[test]
fn test_edge_min_length_always_one() {
    let fc = get_flowchart("graph TD\n  A-->B");
    for edge in &fc.edges {
        assert_eq!(edge.min_length, 1, "min_length always 1 in MVP");
    }
}

#[test]
fn test_node_classes_always_empty() {
    let fc = get_flowchart("graph TD\n  A-->B");
    for node in &fc.nodes {
        assert!(node.classes.is_empty(), "Node classes not supported in MVP");
    }
}

#[test]
fn test_node_styles_always_empty() {
    let fc = get_flowchart("graph TD\n  A-->B");
    for node in &fc.nodes {
        assert!(node.styles.is_empty(), "Node styles not supported in MVP");
    }
}

#[test]
fn test_subgraphs_always_empty() {
    let fc = get_flowchart("graph TD\n  A-->B");
    assert!(fc.subgraphs.is_empty(), "Subgraphs not supported in MVP");
}

// ═══════════════════════════════════════════════════════════════════
//  15. YAML FRONT MATTER / CONFIG
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_yaml_front_matter_unsupported() {
    let result = parse("---\nconfig:\n  flowchart:\n    curve: stepBefore\n---\ngraph TD\n  A-->B");
    assert!(result.is_err(), "YAML front matter not supported");
}

// ═══════════════════════════════════════════════════════════════════
//  16. OTHER DIAGRAM TYPES
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_sequence_diagram() {
    assert!(parse("sequenceDiagram\n  A->>B: Hello").is_err());
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

// ═══════════════════════════════════════════════════════════════════
//  17. NODE DEDUPLICATION SEMANTICS
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_dedup_first_definition_wins() {
    let fc = get_flowchart("graph TD\n  A[First]-->B\n  A-->C");
    let a = fc.nodes.iter().find(|n| n.id == "A").unwrap();
    assert_eq!(a.label, Some("First".to_string()));
}

#[test]
fn test_dedup_target_appears_later_with_label() {
    let fc = get_flowchart("graph TD\n  A-->B\n  C-->B[Labeled]");
    // B first appears without label (from A-->B), then with label
    // First definition wins: B has no label
    let b = fc.nodes.iter().find(|n| n.id == "B").unwrap();
    assert_eq!(b.label, None, "First definition wins for dedup");
}

#[test]
fn test_dedup_same_node_different_edges() {
    let fc = get_flowchart("graph TD\n  A-->B\n  C-->B\n  D-->B");
    let b_count = fc.nodes.iter().filter(|n| n.id == "B").count();
    assert_eq!(b_count, 1);
}

#[test]
fn test_dedup_self_loop() {
    let fc = get_flowchart("graph TD\n  A-->A");
    assert_eq!(fc.nodes.len(), 1);
    assert_eq!(fc.edges[0].from, "A");
    assert_eq!(fc.edges[0].to, "A");
}

// ═══════════════════════════════════════════════════════════════════
//  18. AST SERIALIZATION COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_json_contains_type_tag() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    assert!(json.contains("\"type\""), "JSON must contain type discriminator");
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

// ═══════════════════════════════════════════════════════════════════
//  19. ERROR MESSAGES
// ═══════════════════════════════════════════════════════════════════

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
    assert!(msg.contains("Keyword") || msg.contains("Expected"), "Error should describe what was expected");
}

// ═══════════════════════════════════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════════════════════════════════

fn get_flowchart(input: &str) -> xmermaid_parser::FlowchartAst {
    match parse(input).unwrap() {
        DiagramAst::Flowchart(fc) => fc,
        _ => panic!("Expected Flowchart AST"),
    }
}