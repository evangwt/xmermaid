use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DiagramAst {
    Flowchart(FlowchartAst),
    Sequence(SequenceAst),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowchartAst {
    pub direction: FlowDirection,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub subgraphs: Vec<Subgraph>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowDirection {
    TB,
    TD,
    BT,
    LR,
    RL,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub label: Option<String>,
    pub shape: NodeShape,
    pub classes: Vec<String>,
    pub styles: Vec<StyleDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeShape {
    Rect,
    Rounded,
    Circle,
    Diamond,
    Stadium,
    Subroutine,
    Hexagon,
    Parallelogram,
    Trapezoid,
    DoubleCircle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub from: String,
    pub to: String,
    pub style: EdgeStyle,
    pub label: Option<String>,
    pub min_length: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeStyle {
    Arrow,
    Line,
    Dotted,
    Thick,
    Invisible,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleDef {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subgraph {
    pub title: String,
    pub nodes: Vec<String>,
    pub subgraphs: Vec<Subgraph>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceAst {
    pub participants: Vec<String>,
}
