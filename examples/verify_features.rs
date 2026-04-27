use xmermaid_parser::{parse, DiagramAst, NodeShape, EdgeStyle};

fn fc(input: &str) -> xmermaid_parser::FlowchartAst {
    match parse(input).unwrap() {
        DiagramAst::Flowchart(fc) => fc,
        _ => panic!("Expected Flowchart"),
    }
}

fn main() {
    println!("=== Diamond ===");
    let r = parse("graph TD\n  A{Diamond}");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  shape={:?} label={:?}", fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Hexagon ===");
    let r = parse("graph TD\n  A{{Hexagon}}");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  shape={:?} label={:?}", fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== DoubleCircle ===");
    let r = parse("graph TD\n  A(((Double Circle)))");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  shape={:?} label={:?}", fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Asymmetric >text] ===");
    let r = parse("graph TD\n  A>Asymmetric]");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} shape={:?} label={:?}", fc.nodes.len(), fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Edge label ===");
    let r = parse("graph TD\n  A-->|my label|B");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  edge label={:?}", fc.edges[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Basic subgraph ===");
    let r = parse("graph TD\n  subgraph sg\n    A-->B\n  end");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  subgraphs={} title={:?}", fc.subgraphs.len(), fc.subgraphs.get(0).map(|s| &s.title)),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Subgraph with title ===");
    let r = parse("graph TD\n  subgraph myId [My Title]\n    A-->B\n  end");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  subgraphs={} title={:?}", fc.subgraphs.len(), fc.subgraphs.get(0).map(|s| &s.title)),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Subgraph with direction ===");
    let r = parse("graph TD\n  subgraph S1\n    direction LR\n    A-->B\n  end");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  subgraphs={} title={:?}", fc.subgraphs.len(), fc.subgraphs.get(0).map(|s| &s.title)),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Nested subgraph ===");
    let r = parse("graph TD\n  subgraph outer\n    subgraph inner\n      A-->B\n    end\n  end");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  subgraphs={} nested={:?}", fc.subgraphs.len(), fc.subgraphs.get(0).map(|s| s.subgraphs.len())),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Comments ===");
    let r = parse("graph TD\n  %% This is a comment\n  A-->B");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={}", fc.nodes.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Semicolons ===");
    let r = parse("graph TD\n  A-->B; B-->C");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== & operator ===");
    let r = parse("graph TD\n  A-->B&C");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={}", fc.nodes.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== classDef ===");
    let r = parse("graph TD\n  A-->B\n  classDef myClass fill:#f9f");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== style ===");
    let r = parse("graph TD\n  A-->B\n  style A fill:#f9f,stroke:#333");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== click ===");
    let r = parse("graph TD\n  A-->B\n  click A callback");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Parallelogram ===");
    let r = parse("graph TD\n  A[/Parallelogram/]");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  shape={:?} label={:?}", fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Trapezoid ===");
    let r = parse("graph TD\n  A[\\Trapezoid\\]");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  shape={:?} label={:?}", fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Subroutine ===");
    let r = parse("graph TD\n  A[[Subroutine]]");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  shape={:?} label={:?}", fc.nodes[0].shape, fc.nodes[0].label),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Edge to subgraph ===");
    let r = parse("flowchart TD\n  A-->sub1\n  subgraph sub1\n    B-->C\n  end");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={}", fc.nodes.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Bidirectional <--> ===");
    let r = parse("graph TD\n  A<-->B");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== linkStyle ===");
    let r = parse("graph TD\n  A-->B\n  linkStyle 0 stroke:#ff3");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== click URL ===");
    let r = parse("graph TD\n  A-->B\n  click A \"https://example.com\"");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={} edges={}", fc.nodes.len(), fc.edges.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== class assignment ::: ===");
    let r = parse("graph TD\n  A:::myClass-->B");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={}", fc.nodes.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== YAML front matter ===");
    let r = parse("---\nconfig:\n  flowchart:\n    curve: stepBefore\n---\ngraph TD\n  A-->B");
    match &r {
        Ok(DiagramAst::Flowchart(fc)) => println!("  nodes={}", fc.nodes.len()),
        Err(e) => println!("  ERR: {}", e),
        _ => println!("  OTHER"),
    }

    println!("=== Edge without label ===");
    let r = parse("graph TD\n  A-->B");
    if let Ok(DiagramAst::Flowchart(fc)) = r {
        println!("  edge label={:?}", fc.edges[0].label);
    }
}
