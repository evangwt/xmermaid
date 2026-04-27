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
