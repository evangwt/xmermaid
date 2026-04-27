use xmermaid_layout::{compute_layout, LayoutConfig};
use xmermaid_parser::parse;

#[test]
fn test_layout_two_nodes() {
    let input = "graph TD\n  A-->B";
    let ast = parse(input).unwrap();

    let config = LayoutConfig::default();
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

    let config = LayoutConfig::default();
    let result = compute_layout(&ast, &config);
    assert!(result.dimensions.width > 0.0);
    assert!(result.dimensions.height > 0.0);
}

#[test]
fn test_layout_lr_direction() {
    let input = "graph LR\n  A-->B";
    let ast = parse(input).unwrap();

    let config = LayoutConfig::default();
    let result = compute_layout(&ast, &config);

    let a_node = result.nodes.iter().find(|n| n.id == "A").unwrap();
    let b_node = result.nodes.iter().find(|n| n.id == "B").unwrap();

    assert!(a_node.center.x < b_node.center.x); // A is left of B in LR direction
}
