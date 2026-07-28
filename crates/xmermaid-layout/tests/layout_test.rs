mod common;

use common::config_for_ast;
use xmermaid_layout::compute_layout;
use xmermaid_parser::parse;

#[test]
fn test_layout_two_nodes() {
    let input = "graph TD\n  A-->B";
    let ast = parse(input).unwrap();

    let config = config_for_ast(&ast);
    let result = compute_layout(&ast, &config);
    assert_eq!(result.nodes.len(), 2);

    let a_node = result.nodes.iter().find(|n| n.id == "A").unwrap();
    let b_node = result.nodes.iter().find(|n| n.id == "B").unwrap();

    assert!(a_node.center.y < b_node.center.y); // A is above B in TD direction
}

#[test]
fn test_layout_dimensions() {
    let input = "graph LR\n  A-->B";
    let ast = parse(input).unwrap();

    let config = config_for_ast(&ast);
    let result = compute_layout(&ast, &config);
    assert!(result.dimensions.width > 0.0);
    assert!(result.dimensions.height > 0.0);
}

#[test]
fn test_layout_lr_direction() {
    let input = "graph LR\n  A-->B";
    let ast = parse(input).unwrap();

    let config = config_for_ast(&ast);
    let result = compute_layout(&ast, &config);

    let a_node = result.nodes.iter().find(|n| n.id == "A").unwrap();
    let b_node = result.nodes.iter().find(|n| n.id == "B").unwrap();

    assert!(a_node.center.x < b_node.center.x); // A is left of B in LR direction
}

#[test]
fn test_layout_requirement_relationships_from_left_to_right() {
    let ast = parse(
        "requirementDiagram\n\
  requirement Login {\n\
    id: 1\n\
    text: User must log in\n\
  }\n\
  functionalRequirement Authenticate {\n\
    text: Validate credentials\n\
  }\n\
  Login - satisfies -> Authenticate",
    )
    .unwrap();

    let result = compute_layout(&ast, &config_for_ast(&ast));
    let login = result.nodes.iter().find(|node| node.id == "Login").unwrap();
    let authenticate = result.nodes.iter().find(|node| node.id == "Authenticate").unwrap();

    assert_eq!(result.nodes.len(), 2);
    assert_eq!(result.edges.len(), 1);
    assert!(login.center.x < authenticate.center.x);
    assert_eq!(result.edges[0].label.as_deref(), Some("satisfies"));
}

#[test]
fn test_layout_gitgraph_commits_in_history_order() {
    let ast = parse(
        "gitGraph\n\
  commit id: \"ZERO\"\n\
  branch develop\n\
  checkout develop\n\
  commit id: \"FEATURE\"\n\
  checkout main\n\
  merge develop id: \"RELEASE\"",
    )
    .unwrap();

    let result = compute_layout(&ast, &config_for_ast(&ast));
    let zero = result.nodes.iter().find(|node| node.id == "ZERO").unwrap();
    let release = result.nodes.iter().find(|node| node.id == "RELEASE").unwrap();

    assert_eq!(result.nodes.len(), 3);
    assert_eq!(result.edges.len(), 3);
    assert!(zero.center.x < release.center.x);
}
