use xmermaid_parser::{parse, DiagramAst, EdgeStyle, FlowDirection, NodeShape};

#[test]
fn test_parse_simple_flowchart() {
    let input = "graph TD\n  A-->B";
    let result = parse(input);

    assert!(result.is_ok(), "Parse failed: {:?}", result.err());
    let ast = result.unwrap();

    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.direction, FlowDirection::TD);
            assert_eq!(fc.nodes.len(), 2);
            assert_eq!(fc.edges.len(), 1);

            assert_eq!(fc.nodes[0].id, "A");
            assert_eq!(fc.nodes[1].id, "B");

            assert_eq!(fc.edges[0].from, "A");
            assert_eq!(fc.edges[0].to, "B");
            assert_eq!(fc.edges[0].style, EdgeStyle::Arrow);
        }
        _ => panic!("Expected Flowchart AST"),
    }
}

#[test]
fn test_parse_flowchart_with_labels() {
    let input = "graph LR\n  A[Start]-->B[End]";
    let result = parse(input);

    assert!(result.is_ok());
    let ast = result.unwrap();

    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.direction, FlowDirection::LR);
            assert_eq!(fc.nodes[0].label, Some("Start".to_string()));
            assert_eq!(fc.nodes[1].label, Some("End".to_string()));
        }
        _ => panic!("Expected Flowchart AST"),
    }
}

#[test]
fn test_parse_flowchart_with_shapes() {
    let input = "graph TD\n  A[rect] B(rounded)";
    let result = parse(input);

    assert!(result.is_ok());
    let ast = result.unwrap();

    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes[0].shape, NodeShape::Rect);
            assert_eq!(fc.nodes[1].shape, NodeShape::Rounded);
        }
        _ => panic!("Expected Flowchart AST"),
    }
}

#[test]
fn test_parse_sequence_participants_and_messages() {
    let ast = parse("sequenceDiagram\n  Alice->>Bob: Hello").unwrap();

    match ast {
        DiagramAst::Sequence(sequence) => {
            assert_eq!(sequence.participants, vec!["Alice", "Bob"]);
            assert_eq!(sequence.messages.len(), 1);
            assert_eq!(sequence.messages[0].from, "Alice");
            assert_eq!(sequence.messages[0].to, "Bob");
            assert_eq!(sequence.messages[0].label, "Hello");
        }
        _ => panic!("expected sequence diagram"),
    }
}

#[test]
fn test_parse_sequence_dashed_message_without_mutating_sender() {
    let ast = parse("sequenceDiagram\n  Alice-->>Bob: Async reply").unwrap();

    match ast {
        DiagramAst::Sequence(sequence) => {
            assert_eq!(sequence.participants, vec!["Alice", "Bob"]);
            assert_eq!(sequence.messages[0].from, "Alice");
            assert_eq!(sequence.messages[0].to, "Bob");
            assert_eq!(sequence.messages[0].label, "Async reply");
        }
        _ => panic!("expected sequence diagram"),
    }
}

#[test]
fn test_parse_class_definitions_and_inheritance_relation() {
    let ast = parse("classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "class");
    assert_eq!(json["classes"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["relations"][0]["from"], "Duck");
    assert_eq!(json["relations"][0]["to"], "Animal");
}

#[test]
fn test_parse_state_transitions_with_event_labels() {
    let ast = parse("stateDiagram-v2\n  Idle --> Running : start\n  Running --> Idle : stop").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "state");
    assert_eq!(json["states"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["transitions"][0]["from"], "Idle");
    assert_eq!(json["transitions"][0]["to"], "Running");
    assert_eq!(json["transitions"][0]["label"], "start");
}

#[test]
fn test_parse_er_relationship_with_cardinality_and_label() {
    let ast = parse("erDiagram\n  CUSTOMER ||--o{ ORDER : places").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "er");
    assert_eq!(json["entities"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["relationships"][0]["from"], "CUSTOMER");
    assert_eq!(json["relationships"][0]["to"], "ORDER");
    assert_eq!(json["relationships"][0]["label"], "places");
}

#[test]
fn test_parse_gantt_tasks_with_sections_and_durations() {
    let ast = parse("gantt\n  title Release\n  section Build\n  Compile : 2026-07-28, 2d\n  Test : 2026-07-30, 1d").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "gantt");
    assert_eq!(json["tasks"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["tasks"][0]["section"], "Build");
    assert_eq!(json["tasks"][0]["label"], "Compile");
    assert_eq!(json["tasks"][0]["start"], "2026-07-28");
    assert_eq!(json["tasks"][0]["duration_days"], 2);
}

#[test]
fn test_parse_pie_values_with_title() {
    let ast = parse("pie title Deployment\n  \"Passed\" : 80\n  \"Failed\" : 20").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "pie");
    assert_eq!(json["title"], "Deployment");
    assert_eq!(json["slices"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["slices"][0]["label"], "Passed");
    assert_eq!(json["slices"][0]["value"], 80.0);
}

#[test]
fn test_parse_user_journey_sections_scores_and_actors() {
    let ast = parse("journey\n  title Checkout\n  section Discovery\n    Find product: 5: Buyer\n  section Purchase\n    Pay securely: 4: Buyer, Store").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "userjourney");
    assert_eq!(json["title"], "Checkout");
    assert_eq!(json["tasks"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["tasks"][0]["section"], "Discovery");
    assert_eq!(json["tasks"][0]["score"], 5);
    assert_eq!(json["tasks"][1]["actors"][1], "Store");
}

#[test]
fn test_parse_timeline_periods_and_multiple_events() {
    let ast = parse("timeline\n  title Product history\n  2024 : First release\n       : Team grows\n  2025 : Global launch").unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "timeline");
    assert_eq!(json["title"], "Product history");
    assert_eq!(json["entries"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["entries"][0]["period"], "2024");
    assert_eq!(json["entries"][0]["events"][1], "Team grows");
}

#[test]
fn test_parse_requirement_blocks_with_properties_and_relationships() {
    let ast = parse(
        "requirementDiagram\n\
  requirement Login {\n\
    id: 1\n\
    text: User must log in\n\
    risk: high\n\
    verifymethod: test\n\
  }\n\
  functionalRequirement Authenticate {\n\
    text: Validate credentials\n\
  }\n\
  Login - satisfies -> Authenticate",
    )
    .unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "requirement");
    assert_eq!(json["requirements"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["requirements"][0]["kind"], "requirement");
    assert_eq!(json["requirements"][0]["name"], "Login");
    assert_eq!(json["requirements"][0]["id"], "1");
    assert_eq!(json["requirements"][0]["text"], "User must log in");
    assert_eq!(json["requirements"][0]["risk"], "high");
    assert_eq!(json["requirements"][0]["verify_method"], "test");
    assert_eq!(json["requirements"][1]["kind"], "functionalRequirement");
    assert_eq!(json["relationships"][0]["from"], "Login");
    assert_eq!(json["relationships"][0]["to"], "Authenticate");
    assert_eq!(json["relationships"][0]["label"], "satisfies");
}

#[test]
fn test_parse_gitgraph_branches_commits_and_merges() {
    let ast = parse(
        "gitGraph\n\
  commit id: \"ZERO\" tag: \"v0.1.0\"\n\
  branch develop\n\
  checkout develop\n\
  commit id: \"FEATURE\"\n\
  checkout main\n\
  merge develop id: \"RELEASE\" tag: \"v1.0.0\"",
    )
    .unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "gitgraph");
    assert_eq!(json["commits"].as_array().map(Vec::len), Some(3));
    assert_eq!(json["commits"][0]["branch"], "main");
    assert_eq!(json["commits"][0]["id"], "ZERO");
    assert_eq!(json["commits"][0]["tag"], "v0.1.0");
    assert_eq!(json["commits"][1]["branch"], "develop");
    assert_eq!(json["commits"][1]["parents"], serde_json::json!(["ZERO"]));
    assert_eq!(json["commits"][2]["id"], "RELEASE");
    assert_eq!(json["commits"][2]["parents"], serde_json::json!(["ZERO", "FEATURE"]));
}

#[test]
fn test_parse_c4_context_elements_and_relationships() {
    let ast = parse(
        "C4Context\n\
  title Internet Banking\n\
  Person(customer, \"Personal Banking Customer\", \"A customer of the bank\")\n\
  System(banking, \"Internet Banking System\", \"Allows customers to view accounts\")\n\
  System_Ext(email, \"E-mail system\", \"Sends e-mail\")\n\
  Rel(customer, banking, \"Uses\")\n\
  Rel(banking, email, \"Sends e-mail using\")",
    )
    .unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "c4");
    assert_eq!(json["diagram_kind"], "Context");
    assert_eq!(json["title"], "Internet Banking");
    assert_eq!(json["elements"].as_array().map(Vec::len), Some(3));
    assert_eq!(json["elements"][0]["kind"], "Person");
    assert_eq!(json["elements"][2]["kind"], "System_Ext");
    assert_eq!(json["relationships"][0]["from"], "customer");
    assert_eq!(json["relationships"][1]["label"], "Sends e-mail using");
}

#[test]
fn test_parse_zenuml_messages_and_return_values() {
    let ast = parse(
        "zenuml\n\
  Alice->Bob: Authenticate\n\
  Bob-->Alice: Token",
    )
    .unwrap();
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["type"], "zenuml");
    assert_eq!(json["participants"], serde_json::json!(["Alice", "Bob"]));
    assert_eq!(json["messages"].as_array().map(Vec::len), Some(2));
    assert_eq!(json["messages"][0]["label"], "Authenticate");
    assert_eq!(json["messages"][1]["kind"], "return");
}

#[test]
fn test_parse_xychart_bar_and_line_series() {
    let ast = parse("xychart-beta\n  title \"Quarterly revenue\"\n  x-axis [Q1, Q2]\n  y-axis \"Revenue\" 0 --> 100\n  bar [20, 40]\n  line [30, 50]").unwrap();
    let json = serde_json::to_value(ast).unwrap();
    assert_eq!(json["type"], "xychart"); assert_eq!(json["title"], "Quarterly revenue"); assert_eq!(json["x_labels"], serde_json::json!(["Q1", "Q2"])); assert_eq!(json["y_min"], 0.0); assert_eq!(json["y_max"], 100.0); assert_eq!(json["series"].as_array().map(Vec::len), Some(2)); assert_eq!(json["series"][0]["kind"], "bar"); assert_eq!(json["series"][1]["kind"], "line");
}

#[test]
fn test_parse_indented_mindmap_hierarchy() {
    let ast = parse("mindmap\n  Root\n    Product\n      Editor\n    Renderer").unwrap();
    let json = serde_json::to_value(ast).unwrap();
    assert_eq!(json["type"], "mindmap");
    assert_eq!(json["nodes"].as_array().map(Vec::len), Some(4));
    assert_eq!(json["nodes"][2]["parent"], "mindmap-1");
}

#[test]
fn test_rejects_mindmap_shape_syntax_until_shapes_are_supported() {
    let error = parse("mindmap\n  root(A)").unwrap_err();

    assert!(format!("{error:?}").contains("Mindmap node shapes are not supported"));
}

#[test]
fn test_parse_flowchart_multiple_edges() {
    let input = "graph TD\n  A-->B\n  B-->C";
    let result = parse(input);

    assert!(result.is_ok());
    let ast = result.unwrap();

    match ast {
        DiagramAst::Flowchart(fc) => {
            assert_eq!(fc.nodes.len(), 3);
            assert_eq!(fc.edges.len(), 2);
            assert_eq!(fc.edges[0].from, "A");
            assert_eq!(fc.edges[0].to, "B");
            assert_eq!(fc.edges[1].from, "B");
            assert_eq!(fc.edges[1].to, "C");
        }
        _ => panic!("Expected Flowchart AST"),
    }
}
