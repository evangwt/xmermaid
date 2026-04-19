use xmermaid_layout::compute_flowchart_layout;
use xmermaid_parser::{parse, DiagramAst};

#[test]
fn test_layout_two_nodes() {
    let input = "graph TD\n  A-->B";
    let ast = parse(input).unwrap();

    let result = compute_flowchart_layout(&ast);
    assert!(result.is_ok());

    let layout = result.unwrap();
    assert_eq!(layout.positions.len(), 2);

    let a_pos = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b_pos = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;

    assert!(a_pos.y < b_pos.y); // A is above B in TD direction
}

#[test]
fn test_layout_dimensions() {
    let input = "graph LR\n  A-->B";
    let ast = parse(input).unwrap();

    let result = compute_flowchart_layout(&ast);
    assert!(result.is_ok());

    let layout = result.unwrap();
    assert!(layout.dimensions.width > 0.0);
    assert!(layout.dimensions.height > 0.0);
}

#[test]
fn test_layout_lr_direction() {
    let input = "graph LR\n  A-->B";
    let ast = parse(input).unwrap();

    let result = compute_flowchart_layout(&ast);
    let layout = result.unwrap();

    let a_pos = layout.positions.iter().find(|(id, _)| id == "A").unwrap().1;
    let b_pos = layout.positions.iter().find(|(id, _)| id == "B").unwrap().1;

    assert!(a_pos.x < b_pos.x); // A is left of B in LR direction
}
