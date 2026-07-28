use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FlowDirection {
    TD,
    BT,
    LR,
    RL,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeShape {
    Rect,
    Rounded,
    Circle,
    DoubleCircle,
    Diamond,
    Hexagon,
    Stadium,
    Subroutine,
    Parallelogram,
    Trapezoid,
    Asymmetric,
    Cylinder,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeStyle {
    Arrow,
    Line,
    Dotted,
    Thick,
    Invisible,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub label: Option<String>,
    pub shape: NodeShape,
    pub classes: Vec<String>,
    pub styles: Vec<String>,
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
pub struct Subgraph {
    pub title: String,
    pub nodes: Vec<String>,
    pub subgraphs: Vec<Subgraph>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowchartAst {
    pub direction: FlowDirection,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub subgraphs: Vec<Subgraph>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceAst {
    pub participants: Vec<String>,
    pub messages: Vec<SequenceMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceMessage {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassAst {
    pub classes: Vec<ClassDefinition>,
    pub relations: Vec<ClassRelation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassDefinition {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassRelation {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateAst { pub states: Vec<String>, pub transitions: Vec<StateTransition> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTransition { pub from: String, pub to: String, pub label: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErAst {
    pub entities: Vec<String>,
    pub relationships: Vec<ErRelationship>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErRelationship {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GanttAst {
    pub tasks: Vec<GanttTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GanttTask {
    pub section: String,
    pub label: String,
    pub start: String,
    pub duration_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PieAst { pub title: String, pub slices: Vec<PieSlice> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PieSlice { pub label: String, pub value: f64 }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct MindmapAst { pub nodes: Vec<MindmapNode> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct MindmapNode { pub id: String, pub label: String, pub parent: Option<String> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum DiagramAst {
    Flowchart(FlowchartAst),
    Sequence(SequenceAst),
    Class(ClassAst),
    State(StateAst),
    Er(ErAst),
    Gantt(GanttAst),
    Pie(PieAst),
    Mindmap(MindmapAst),
}
