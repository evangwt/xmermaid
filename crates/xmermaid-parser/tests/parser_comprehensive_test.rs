use xmermaid_parser::{parse, DiagramAst, EdgeStyle, FlowDirection, NodeShape};

const FLOWCHART_CLASS_CONTRACT: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../tests/fixtures/flowchart-class-contract.json"
));

#[test]
fn test_shared_flowchart_class_contract() {
    let cases: serde_json::Value = serde_json::from_str(FLOWCHART_CLASS_CONTRACT).unwrap();

    for case in cases.as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let source = case["lines"]
            .as_array()
            .unwrap()
            .iter()
            .map(|line| line.as_str().unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        let valid = case["valid"].as_bool().unwrap();

        assert_eq!(parse(&source).is_ok(), valid, "contract case: {name}");
    }
}

// ─── Direction variants ──────────────────────────────────────────

#[test]
fn test_parse_direction_tb() {
    let ast = parse("graph TB\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.direction, FlowDirection::TD),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_direction_bt() {
    let ast = parse("graph BT\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.direction, FlowDirection::BT),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_direction_rl() {
    let ast = parse("graph RL\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.direction, FlowDirection::RL),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_flowchart_keyword() {
    let ast = parse("flowchart TD\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.direction, FlowDirection::TD);
            assert_eq!(fc.nodes.len(), 2);
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ─── Edge style variants ─────────────────────────────────────────

#[test]
fn test_parse_edge_line() {
    let ast = parse("graph TD\n  A---B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.edges[0].style, EdgeStyle::Line),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_edge_dotted() {
    let ast = parse("graph TD\n  A-.->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.edges[0].style, EdgeStyle::Dotted),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_edge_thick() {
    let ast = parse("graph TD\n  A==>B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.edges[0].style, EdgeStyle::Thick),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_edge_invisible() {
    let ast = parse("graph TD\n  A~~~B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => assert_eq!(fc.edges[0].style, EdgeStyle::Invisible),
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_mixed_edge_styles() {
    let ast = parse("graph TD\n  A-->B\n  B---C\n  C-.->D\n  D==>E").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.edges.len(), 4);
            assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
            assert_eq!(fc.edges[1].style, EdgeStyle::Line);
            assert_eq!(fc.edges[2].style, EdgeStyle::Dotted);
            assert_eq!(fc.edges[3].style, EdgeStyle::Thick);
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ─── Node shapes ─────────────────────────────────────────────────

#[test]
fn test_parse_circle_shape() {
    let ast = parse("graph TD\n  A((circle))").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].shape, NodeShape::Circle);
            assert_eq!(fc.nodes[0].label, Some("circle".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_rounded_shape_with_label() {
    let ast = parse("graph TD\n  A(rounded label)").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].shape, NodeShape::Rounded);
            assert_eq!(fc.nodes[0].label, Some("rounded label".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ─── Complex graph topologies ────────────────────────────────────

#[test]
fn test_parse_diamond_topology() {
    let ast = parse("graph TD\n  A-->B\n  A-->C\n  B-->D\n  C-->D").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 4);
            assert_eq!(fc.edges.len(), 4);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_chain_five_nodes() {
    let ast = parse("graph LR\n  A-->B-->C-->D-->E").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 5);
            assert_eq!(fc.edges.len(), 4);
            assert_eq!(fc.edges[0].from, "A");
            assert_eq!(fc.edges[0].to, "B");
            assert_eq!(fc.edges[3].from, "D");
            assert_eq!(fc.edges[3].to, "E");
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_chain_on_separate_lines() {
    let ast = parse("graph TD\n  A-->B\n  B-->C\n  C-->D").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 4);
            assert_eq!(fc.edges.len(), 3);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_self_loop() {
    let ast = parse("graph TD\n  A-->A").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 1);
            assert_eq!(fc.edges.len(), 1);
            assert_eq!(fc.edges[0].from, "A");
            assert_eq!(fc.edges[0].to, "A");
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_node_deduplication() {
    let ast = parse("graph TD\n  A-->B\n  A-->C").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            let a_count = fc.nodes.iter().filter(|n| n.id == "A").count();
            assert_eq!(a_count, 1);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_target_node_deduplication() {
    let ast = parse("graph TD\n  A-->B\n  C-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            let b_count = fc.nodes.iter().filter(|n| n.id == "B").count();
            assert_eq!(b_count, 1);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_standalone_nodes() {
    let ast = parse("graph TD\n  A[First] B[Second] C[Third]").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            assert_eq!(fc.edges.len(), 0);
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_node_with_label_and_edge() {
    let ast = parse("graph TD\n  A[Start]-->B[End]").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].label, Some("Start".to_string()));
            assert_eq!(fc.nodes[1].label, Some("End".to_string()));
            assert_eq!(fc.edges[0].from, "A");
            assert_eq!(fc.edges[0].to, "B");
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_first_label_wins_for_dedup() {
    let ast = parse("graph TD\n  A[Labeled]-->B\n  A-->C").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            let a = fc.nodes.iter().find(|n| n.id == "A").unwrap();
            assert_eq!(a.label, Some("Labeled".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_target_with_label_on_edge() {
    let ast = parse("graph TD\n  A-->B[Target Label]").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            let b = fc.nodes.iter().find(|n| n.id == "B").unwrap();
            assert_eq!(b.label, Some("Target Label".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_mixed_chain_and_separate() {
    // Mix of chained and separate edges
    let ast = parse("graph TD\n  A-->B-->C\n  A-->C").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            assert_eq!(fc.edges.len(), 3);
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ─── AST serialization ───────────────────────────────────────────

#[test]
fn test_parse_ast_serializes_to_valid_json() {
    let ast = parse("graph TD\n  A[Start]-->B[End]").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    // serde tag = "type" produces {"type":"Flowchart",...} by default
    // with rename_all = "lowercase" on the enum, it becomes "flowchart"
    assert!(json.contains("\"type\""), "JSON should contain type tag");
    assert!(json.contains("\"nodes\""));
    assert!(json.contains("\"edges\""));
}

#[test]
fn test_parse_ast_roundtrip_json() {
    let ast = parse("graph LR\n  A-->B\n  B-->C").unwrap();
    let json = serde_json::to_string(&ast).unwrap();
    let deserialized: DiagramAst = serde_json::from_str(&json).unwrap();
    assert!(matches!(deserialized, DiagramAst::Flowchart(_)));
}

// ─── Edge label is always None in MVP ────────────────────────────

#[test]
fn test_parse_edge_label_none_by_default() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.edges[0].label, None);
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ─── Subgraphs always empty in MVP ───────────────────────────────

#[test]
fn test_parse_subgraphs_always_empty() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert!(fc.subgraphs.is_empty());
        }
        _ => panic!("Expected Flowchart"),
    }
}

// ═══════════════════════════════════════════════════════════════════
//  FALSIFICATION TESTS — verify what should NOT work
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_falsify_empty_input() {
    let result = parse("");
    assert!(result.is_err());
}

#[test]
fn test_falsify_missing_direction() {
    let result = parse("graph\n  A-->B");
    assert!(result.is_err());
}

#[test]
fn test_falsify_non_keyword_as_diagram_type() {
    // "pie" is lexed as NodeId, not Keyword, so expect fails
    let result = parse("pie\n  A");
    assert!(result.is_err());
}

#[test]
fn test_falsify_direction_only_no_keyword() {
    let result = parse("TD\n  A-->B");
    assert!(result.is_err());
}

#[test]
fn test_falsify_random_garbage() {
    let result = parse("@#$%^&*");
    assert!(result.is_err());
}

#[test]
fn test_falsify_keyword_then_invalid_direction() {
    let result = parse("graph XXX\n  A-->B");
    // XXX is lexed as NodeId, not Direction
    assert!(result.is_err());
}

#[test]
fn test_parse_diamond_shape() {
    let ast = parse("graph TD\n  A{Decision}").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].shape, NodeShape::Diamond);
            assert_eq!(fc.nodes[0].label, Some("Decision".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_edge_label_pipe() {
    let ast = parse("graph TD\n  A-->|my label|B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.edges[0].label, Some("my label".to_string()));
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_edge_label_pipe_preserves_punctuation() {
    let ast = parse("graph TD\n  A-->|Issue #123: high,urgent; classDef hot fill:#f00|B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(
                fc.edges[0].label,
                Some("Issue #123: high,urgent; classDef hot fill:#f00".to_string())
            );
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_parse_subgraph() {
    let ast = parse("graph TD\n  subgraph sg\n  A-->B\n  end").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.subgraphs.len(), 1);
            assert_eq!(fc.subgraphs[0].title, "sg");
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_falsify_arrow_without_target() {
    let result = parse("graph TD\n  A-->");
    assert!(result.is_err());
}

#[test]
fn test_falsify_double_arrow_greedy_lexer() {
    // KNOWN LIMITATION: lexer greedily reads -->--> as one arrow token
    // A-->-->B is parsed as A --[arrow: "-->-->)--> B
    // This is a lexer bug: arrows should not greedily consume other arrows
    let result = parse("graph TD\n  A-->-->B");
    // The parse succeeds but produces a single edge with a malformed arrow value
    // This is incorrect behavior but currently accepted
    assert!(result.is_ok(), "Known limitation: greedy arrow lexer");
    let ast = result.unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            // It produces 1 edge from A to B (wrong, should be error or 2 edges)
            assert_eq!(fc.edges.len(), 1);
            assert_eq!(fc.edges[0].from, "A");
            assert_eq!(fc.edges[0].to, "B");
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_falsify_node_classes_always_empty() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            for node in &fc.nodes {
                assert!(
                    node.classes.is_empty(),
                    "Node classes should be empty in MVP"
                );
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_falsify_node_styles_always_empty() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            for node in &fc.nodes {
                assert!(node.styles.is_empty(), "Node styles should be empty in MVP");
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}

#[test]
fn test_falsify_sequence_diagram_not_supported() {
    let result = parse("sequenceDiagram\n  A->>B");
    assert!(result.is_err());
}

#[test]
fn test_falsify_unclosed_flowchart_labels_are_rejected() {
    for statement in [
        "A[unterminated",
        "A(unterminated",
        "A{unterminated",
        "A>unterminated",
        ">unterminated",
        "A-->|unterminated",
    ] {
        let source = format!("graph TD\n  {}", statement);
        assert!(
            parse(&source).is_err(),
            "expected rejection for {statement}"
        );
    }
}

#[test]
fn test_closed_multiline_flowchart_labels_remain_valid() {
    assert!(parse("graph TD\n  A[First line\n  second line]\n  A-->B").is_ok());
}

#[test]
fn test_falsify_min_length_always_one() {
    let ast = parse("graph TD\n  A-->B").unwrap();
    match ast {
        DiagramAst::Flowchart(fc) => {
            for edge in &fc.edges {
                assert_eq!(edge.min_length, 1, "min_length should always be 1 in MVP");
            }
        }
        _ => panic!("Expected Flowchart"),
    }
}
