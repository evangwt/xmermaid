use xmermaid_parser::{parse, DiagramAst, EdgeStyle, FlowDirection, NodeShape};

#[test]
fn parses_safe_flowchart_class_styles_and_rejects_unsafe_references() {
    let ast = parse("graph TD\n  A[Start] --> B[Finish]\n  classDef hot fill:#ff0000,stroke:#990000,color:#ffffff\n  class A,B hot").unwrap();
    match ast {
        DiagramAst::Flowchart(flowchart) => {
            assert_eq!(flowchart.nodes[0].style.as_ref().unwrap().fill.as_deref(), Some("#ff0000"));
            assert_eq!(flowchart.nodes[1].style.as_ref().unwrap().stroke.as_deref(), Some("#990000"));
            assert_eq!(flowchart.nodes[1].style.as_ref().unwrap().color.as_deref(), Some("#ffffff"));
        }
        _ => panic!("expected flowchart"),
    }

    assert!(parse("graph TD\n  A[Start]\n  classDef hot fill:url(javascript:alert(1))\n  class A hot").is_err());
    assert!(parse("graph TD\n  A[Start]\n  classDef hot fill:#ff0000\n  class Missing hot").is_err());
    assert!(parse("graph TD\n  A[Start]\n  class A missing").is_err());
}

#[test]
fn parses_semicolon_and_tab_separated_class_styles_with_field_cascade() {
    let ast = parse("graph TD; A-->B; classDef\thot\tfill:#ff0000; classDef border stroke:#990000,color:#ffffff; class\tA\thot; class A border").unwrap();
    let DiagramAst::Flowchart(flowchart) = ast else { panic!("expected flowchart") };
    let style = flowchart.nodes.iter().find(|node| node.id == "A").unwrap().style.as_ref().unwrap();
    assert_eq!(style.fill.as_deref(), Some("#ff0000"));
    assert_eq!(style.stroke.as_deref(), Some("#990000"));
    assert_eq!(style.color.as_deref(), Some("#ffffff"));
}

#[test]
fn parses_class_styles_with_spaced_node_lists_and_direction_named_classes() {
    let ast = parse("graph TD\n  A --> B\n  classDef TD fill:#ff0000\n  class A , B TD").unwrap();
    let DiagramAst::Flowchart(flowchart) = ast else { panic!("expected flowchart") };
    assert_eq!(flowchart.nodes.iter().find(|node| node.id == "A").unwrap().style.as_ref().unwrap().fill.as_deref(), Some("#ff0000"));
    assert_eq!(flowchart.nodes.iter().find(|node| node.id == "B").unwrap().style.as_ref().unwrap().fill.as_deref(), Some("#ff0000"));
}

#[test]
fn accepts_ascii_whitespace_between_hash_and_class_color() {
    let ast = parse("graph TD\n  A\n  classDef hot fill:# fff\n  class A hot").unwrap();
    let DiagramAst::Flowchart(flowchart) = ast else { panic!("expected flowchart") };

    assert_eq!(flowchart.nodes[0].style.as_ref().unwrap().fill.as_deref(), Some("#fff"));
}

#[test]
fn parses_numeric_class_names_and_rejects_reserved_class_keywords() {
    assert!(parse("graph TD\n  A\n  classDef 1hot fill:#ff0000\n  class A 1hot").is_ok());
    assert!(parse("graph TD\n  A\n  classDef class fill:#ff0000\n  class A class").is_err());
}

#[test]
fn keeps_class_keywords_inside_labels_and_comments_out_of_class_style_parsing() {
    let ast = parse("graph TD\n  A[hello; classDef hot fill:#f00]\n  B[world; class A hot]\n  %% classDef ignored fill:#f00; class A ignored\n  A --> B").unwrap();
    let DiagramAst::Flowchart(flowchart) = ast else { panic!("expected flowchart") };

    assert_eq!(flowchart.nodes.iter().find(|node| node.id == "A").unwrap().label.as_deref(), Some("hello; classDef hot fill:#f00"));
    assert!(flowchart.nodes.iter().all(|node| node.style.is_none()));
}

#[test]
fn applies_class_styles_after_labels_with_unmatched_literal_openers() {
    let ast = parse("graph TD\n  A[Review (draft] --> B\n  classDef hot fill:#f00\n  class A hot").unwrap();
    let DiagramAst::Flowchart(flowchart) = ast else { panic!("expected flowchart") };

    assert_eq!(flowchart.nodes.iter().find(|node| node.id == "A").unwrap().style.as_ref().unwrap().fill.as_deref(), Some("#f00"));
}

#[test]
fn applies_class_styles_when_flowchart_statements_use_carriage_returns() {
    let ast = parse("graph TD\rA[Start]\rclassDef hot fill:#f00\rclass A hot").unwrap();
    let DiagramAst::Flowchart(flowchart) = ast else { panic!("expected flowchart") };

    assert_eq!(flowchart.nodes.iter().find(|node| node.id == "A").unwrap().style.as_ref().unwrap().fill.as_deref(), Some("#f00"));
}

#[test]
fn rejects_malformed_reserved_class_statement_prefixes() {
    assert!(parse("graph TD\n  A[Start]\n  classDef: hot fill:#f00\n  class A hot").is_err());
    assert!(parse("graph TD\n  A[Start]\n  class: A hot").is_err());
}

#[test]
fn rejects_css_properties_after_a_class_definition_separator() {
    assert!(parse("graph TD; A[Start]; classDef hot fill:#fff; stroke:#000; class A hot").is_err());
    assert!(parse("graph TD\n  subgraph Group\n    A[Start]\n    classDef hot fill:#fff\n    stroke:#000\n    class A hot\n  end").is_err());
}

#[test]
fn rejects_class_styles_without_a_statement_boundary() {
    assert!(parse("graph TD\n  A[Styled] classDef hot fill:#f00\n  B\n  class A hot").is_err());
    assert!(parse("graph TD\n  A\n  classDef hot fill:#f00\n  B class A hot").is_err());
    assert!(parse("graph TD\n  subgraph Group\n    A classDef hot fill:#f00\n  end").is_err());
}

#[test]
fn parses_block_grid_spans_spaces_labels_and_relationships() {
    let ast = parse("block-beta\n  columns 3\n  A[\"Alpha lane\"] space C\n  Wide:2 D\n  A --> D\n  C -- D").unwrap();

    match ast {
        DiagramAst::Block(diagram) => {
            assert_eq!(diagram.columns, 3);
            assert_eq!(diagram.blocks.len(), 4);
            assert_eq!(diagram.blocks[0].label, "Alpha lane");
            assert_eq!(diagram.blocks[1].id, "C");
            assert_eq!(diagram.blocks[1].column, 2);
            assert_eq!(diagram.blocks[2].span, 2);
            assert!(diagram.relationships[0].arrow_at_target);
            assert!(!diagram.relationships[1].arrow_at_target);
        }
        _ => panic!("expected block diagram"),
    }
}

#[test]
fn rejects_nested_or_overflowing_block_rows() {
    assert!(parse("block-beta\n  columns 2\n  A B C").is_err());
    assert!(parse("block-beta\n  columns 2\n  block:group").is_err());
}

#[test]
fn parses_kanban_columns_and_unique_bare_tasks() {
    let ast = parse("kanban\n  Todo\n    [Write documentation]\n  Done\n    [Ship release]").unwrap();

    match ast {
        DiagramAst::Kanban(board) => {
            assert_eq!(board.columns.len(), 2);
            assert_eq!(board.columns[0].label, "Todo");
            assert_eq!(board.columns[0].tasks[0].id, "task-2");
            assert_eq!(board.columns[1].tasks[0].id, "task-4");
        }
        _ => panic!("expected Kanban diagram"),
    }
}

#[test]
fn rejects_nested_kanban_task_indentation() {
    assert!(parse("kanban\n  Todo\n    task[Top-level]\n      child[Not supported]").is_err());
}

#[test]
fn parses_quadrant_chart_labels_and_normalized_points() {
    let ast = parse("quadrantChart\n title Reach and engagement\n x-axis Low --> High\n y-axis Low --> High\n quadrant-1 Expand\n quadrant-2 Promote\n Campaign A: [0.3, 0.6]").unwrap();

    match ast {
        DiagramAst::Quadrant(chart) => {
            assert_eq!(chart.title, "Reach and engagement");
            assert_eq!(chart.x_axis, Some(("Low".into(), "High".into())));
            assert_eq!(chart.quadrants[0], "Expand");
            assert_eq!(chart.points[0].label, "Campaign A");
            assert_eq!((chart.points[0].x, chart.points[0].y), (0.3, 0.6));
        }
        _ => panic!("expected quadrant chart"),
    }
}

#[test]
fn rejects_quadrant_points_outside_the_normalized_range() {
    assert!(parse("quadrantChart\n Point: [1.1, 0.5]").is_err());
}

#[test]
fn parses_architecture_services_and_directed_relationships() {
    let ast = parse("architecture-beta\n  service db(database)[Database]\n  service api(server)[API]\n  db:R --> L:api").unwrap();

    match ast {
        DiagramAst::Architecture(diagram) => {
            assert_eq!(diagram.services.len(), 2);
            assert_eq!(diagram.services[0].id, "db");
            assert_eq!(diagram.services[0].icon, "database");
            assert_eq!(diagram.services[0].label, "Database");
            assert_eq!(diagram.relationships.len(), 1);
            assert_eq!(diagram.relationships[0].from, "db");
            assert_eq!(diagram.relationships[0].to, "api");
            assert!(diagram.relationships[0].arrow_at_target);
        }
        _ => panic!("expected architecture diagram"),
    }
}

#[test]
fn parses_sankey_csv_with_quoted_labels_and_blank_rows() {
    let ast = parse("sankey\n\nSource,\"Target, with comma\",12.5\nSource,Other,3\n").unwrap();

    match ast {
        DiagramAst::Sankey(chart) => {
            assert_eq!(chart.nodes, vec!["Source", "Target, with comma", "Other"]);
            assert_eq!(chart.links.len(), 2);
            assert_eq!(chart.links[0].value, 12.5);
        }
        _ => panic!("expected sankey diagram"),
    }
}

#[test]
fn rejects_malformed_or_non_positive_sankey_rows() {
    for source in ["sankey\nA,B", "sankey\nA,B,0", "sankey\nA,B,-1", "sankey\nA,B,nope"] {
        assert!(parse(source).is_err(), "{source}");
    }
}

#[test]
fn rejects_cyclic_sankey_rows_before_layout() {
    let error = parse("sankey\nA,B,1\nB,A,1").unwrap_err();
    assert!(error.to_string().contains("cycle"));
}

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
            assert_eq!(
                sequence.participants.iter().map(|participant| participant.id.as_str()).collect::<Vec<_>>(),
                vec!["Alice", "Bob"]
            );
            assert_eq!(sequence.messages.len(), 1);
            assert_eq!(sequence.messages[0].from, "Alice");
            assert_eq!(sequence.messages[0].to, "Bob");
            assert_eq!(sequence.messages[0].label, "Hello");
        }
        _ => panic!("expected sequence diagram"),
    }
}

#[test]
fn test_parse_sequence_explicit_participant_and_actor_declarations() {
    let ast = parse(
        "sequenceDiagram\n  participant Alice\n  participant Payments as Payment service\n  actor User\n  User->>Payments: Sign in\n  Payments-->>User: Signed in",
    )
    .expect("standard sequence participant declarations should parse");

    match ast {
        DiagramAst::Sequence(sequence) => {
            assert_eq!(sequence.participants.len(), 3);
            assert_eq!(sequence.participants[0].label, "Alice");
            assert_eq!(sequence.participants[1].id, "Payments");
            assert_eq!(sequence.participants[1].label, "Payment service");
            assert_eq!(sequence.participants[2].kind, xmermaid_parser::ast::SequenceParticipantKind::Actor);
            assert_eq!(sequence.messages.len(), 2);
            assert_eq!(sequence.messages[0].from, "User");
            assert_eq!(sequence.messages[0].to, "Payments");
            assert_eq!(sequence.messages[1].label, "Signed in");
        }
        _ => panic!("expected sequence diagram"),
    }
}

#[test]
fn test_parse_sequence_dashed_message_without_mutating_sender() {
    let ast = parse("sequenceDiagram\n  Alice-->>Bob: Async reply").unwrap();

    match ast {
        DiagramAst::Sequence(sequence) => {
            assert_eq!(
                sequence.participants.iter().map(|participant| participant.id.as_str()).collect::<Vec<_>>(),
                vec!["Alice", "Bob"]
            );
            assert_eq!(sequence.messages[0].from, "Alice");
            assert_eq!(sequence.messages[0].to, "Bob");
            assert_eq!(sequence.messages[0].label, "Async reply");
        }
        _ => panic!("expected sequence diagram"),
    }
}

#[test]
fn test_parse_sequence_activations_notes_and_nested_control_blocks() {
    let ast = parse(
        "sequenceDiagram\n  participant Client\n  participant API\n  Client->>+API: Request\n  Note right of API: Validate request\n  alt Authorized\n    loop Retry\n      API-->>-Client: Response\n    end\n  else Rejected\n    API-->>Client: Denied\n  end",
    )
    .expect("standard advanced sequence statements should parse");

    let json = serde_json::to_value(ast).unwrap();
    assert_eq!(json["type"], "sequence");
    assert_eq!(json["messages"].as_array().map(Vec::len), Some(3));
    assert_eq!(json["messages"][0]["line_style"], "solid");
    assert_eq!(json["messages"][0]["activate_target"], true);
    assert_eq!(json["messages"][1]["line_style"], "dashed");
    assert_eq!(json["messages"][1]["deactivate_source"], true);
    assert_eq!(json["events"][0]["kind"], "message");
    assert_eq!(json["events"][1]["kind"], "note");
    assert_eq!(json["events"][2]["kind"], "block_start");
    assert_eq!(json["events"][3]["kind"], "block_start");
    assert_eq!(json["events"][5]["kind"], "block_end");
    assert_eq!(json["events"][6]["kind"], "block_divider");
    assert_eq!(json["events"][8]["kind"], "block_end");
}

#[test]
fn test_parse_sequence_message_suffix_deactivates_its_sender() {
    let ast = parse("sequenceDiagram\n  Alice->>+Bob: Request\n  Bob-->>-Alice: Response")
        .expect("the - suffix should close the active message sender");
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["messages"][1]["deactivate_source"], true);
}

#[test]
fn test_parse_sequence_autonumber_rect_and_cross_termination() {
    let ast = parse(
        "sequenceDiagram\n  autonumber\n  participant EventBus\n  participant CraneJob\n  rect rgb(255, 235, 235)\n    EventBus--xCraneJob: Drop Stop\n  end",
    )
    .expect("document sequence framing, numbering, and cross termination should parse");
    let json = serde_json::to_value(ast).unwrap();

    assert_eq!(json["events"][0]["kind"], "autonumber");
    assert_eq!(json["events"][1]["kind"], "block_start");
    assert_eq!(json["events"][1]["block"], "rect");
    assert_eq!(json["events"][1]["color"], "rgb(255, 235, 235)");
    assert_eq!(json["messages"][0]["end_marker"], "cross");
    assert_eq!(json["messages"][0]["line_style"], "dashed");
}

#[test]
fn test_parse_sequence_rejects_deactivation_without_an_open_activation() {
    assert!(parse("sequenceDiagram\n  Alice->>Bob: Hello\n  deactivate Bob").is_err());
    assert!(parse("sequenceDiagram\n  Alice-->>-Bob: Goodbye").is_err());
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
