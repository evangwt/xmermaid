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
    pub participants: Vec<SequenceParticipant>,
    pub messages: Vec<SequenceMessage>,
    #[serde(default)]
    pub events: Vec<SequenceEvent>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SequenceParticipantKind {
    Participant,
    Actor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceParticipant {
    pub id: String,
    pub label: String,
    pub kind: SequenceParticipantKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceMessage {
    pub from: String,
    pub to: String,
    pub label: String,
    #[serde(default)]
    pub line_style: SequenceMessageLineStyle,
    #[serde(default)]
    pub end_marker: SequenceMessageEnd,
    #[serde(default)]
    pub activate_target: bool,
    #[serde(default)]
    pub deactivate_source: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SequenceMessageLineStyle {
    Solid,
    Dashed,
}

impl Default for SequenceMessageLineStyle {
    fn default() -> Self {
        Self::Solid
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SequenceMessageEnd {
    Arrow,
    Cross,
}

impl Default for SequenceMessageEnd {
    fn default() -> Self {
        Self::Arrow
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SequenceNotePlacement {
    LeftOf,
    RightOf,
    Over,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SequenceBlockKind {
    Rect,
    Loop,
    Alt,
    Opt,
    Par,
    Critical,
    Break,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SequenceBlockDividerKind {
    Else,
    And,
    Option,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SequenceEvent {
    Autonumber,
    Message { message_index: usize },
    Activation { participant: String, active: bool },
    Note {
        placement: SequenceNotePlacement,
        participants: Vec<String>,
        text: String,
    },
    BlockStart {
        block: SequenceBlockKind,
        label: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        color: Option<String>,
    },
    BlockDivider { divider: SequenceBlockDividerKind, label: String },
    BlockEnd,
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserJourneyAst { pub title: String, pub tasks: Vec<UserJourneyTask> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserJourneyTask { pub section: String, pub label: String, pub score: u8, pub actors: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineAst { pub title: String, pub entries: Vec<TimelineEntry> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEntry { pub period: String, pub events: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct MindmapAst { pub nodes: Vec<MindmapNode> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct MindmapNode { pub id: String, pub label: String, pub parent: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct RequirementAst { pub requirements: Vec<Requirement>, pub relationships: Vec<RequirementRelationship> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct Requirement { pub kind: String, pub name: String, pub id: Option<String>, pub text: Option<String>, pub risk: Option<String>, pub verify_method: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct RequirementRelationship { pub from: String, pub to: String, pub label: String }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct GitGraphAst { pub commits: Vec<GitCommit> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct GitCommit { pub id: String, pub branch: String, pub tag: Option<String>, pub commit_type: Option<String>, pub parents: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct C4Ast { pub diagram_kind: String, pub title: String, pub elements: Vec<C4Element>, pub relationships: Vec<C4Relationship> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct C4Element { pub kind: String, pub id: String, pub label: String, pub description: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct C4Relationship { pub from: String, pub to: String, pub label: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenUmlAst {
    pub participants: Vec<String>,
    pub messages: Vec<ZenUmlMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenUmlMessage {
    pub from: String,
    pub to: String,
    pub label: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XyChartAst { pub title: String, pub x_labels: Vec<String>, pub y_min: f64, pub y_max: f64, pub series: Vec<XySeries> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XySeries { pub kind: XySeriesKind, pub values: Vec<f64> }
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum XySeriesKind { Bar, Line }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyAst {
    pub nodes: Vec<String>,
    pub links: Vec<SankeyLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SankeyLink {
    pub source: String,
    pub target: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadrantAst {
    pub title: String,
    pub x_axis: Option<(String, String)>,
    pub y_axis: Option<(String, String)>,
    pub quadrants: [String; 4],
    pub points: Vec<QuadrantPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadrantPoint {
    pub label: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureAst {
    pub services: Vec<ArchitectureService>,
    pub relationships: Vec<ArchitectureRelationship>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureService {
    pub id: String,
    pub icon: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureRelationship {
    pub from: String,
    pub to: String,
    pub arrow_at_target: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockAst {
    pub columns: usize,
    pub blocks: Vec<Block>,
    pub relationships: Vec<BlockRelationship>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub id: String,
    pub label: String,
    pub span: usize,
    pub row: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockRelationship {
    pub from: String,
    pub to: String,
    pub arrow_at_target: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanAst {
    pub columns: Vec<KanbanColumn>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanColumn {
    pub id: String,
    pub label: String,
    pub tasks: Vec<KanbanTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTask {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreemapAst {
    pub nodes: Vec<TreemapNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreemapNode {
  pub label: String,
  pub value: Option<f64>,
  pub parent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadarAst {
    pub title: String,
    pub axes: Vec<RadarAxis>,
    pub curves: Vec<RadarCurve>,
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadarAxis {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadarCurve {
    pub id: String,
    pub label: String,
    pub values: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketAst {
    pub title: String,
    pub fields: Vec<PacketField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketField {
    pub start: u32,
    pub end: u32,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VennAst { pub title: String, pub sets: Vec<VennSet>, pub unions: Vec<VennUnion> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VennSet { pub id: String, pub label: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VennUnion { pub sets: Vec<String>, pub label: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwimlaneAst { pub direction: FlowDirection, pub lanes: Vec<Swimlane>, pub nodes: Vec<Node>, pub edges: Vec<Edge> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Swimlane { pub id: String, pub label: String, pub nodes: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IshikawaAst { pub effect: String, pub causes: Vec<IshikawaCause> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IshikawaCause { pub label: String, pub parent: Option<String>, pub depth: usize }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventModelingAst { pub frames: Vec<EventFrame> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventFrame { pub id: String, pub entity_type: String, pub entity: String, pub reset: bool }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WardleyAst { pub title: String, pub components: Vec<WardleyComponent>, pub dependencies: Vec<WardleyDependency> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WardleyComponent { pub id: String, pub label: String, pub x: f64, pub y: f64, pub anchor: bool }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WardleyDependency { pub from: String, pub to: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CynefinAst { pub title: String, pub domains: Vec<CynefinDomain>, pub transitions: Vec<CynefinTransition> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CynefinDomain { pub id: String, pub items: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CynefinTransition { pub from: String, pub to: String, pub label: String }

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
    UserJourney(UserJourneyAst),
    Timeline(TimelineAst),
    Mindmap(MindmapAst),
    Treeview(MindmapAst),
    Requirement(RequirementAst),
    GitGraph(GitGraphAst),
    C4(C4Ast),
    ZenUml(ZenUmlAst),
    XyChart(XyChartAst),
    Sankey(SankeyAst),
    Quadrant(QuadrantAst),
    Architecture(ArchitectureAst),
    Block(BlockAst),
    Kanban(KanbanAst),
    Treemap(TreemapAst),
    Radar(RadarAst),
    Packet(PacketAst),
    Venn(VennAst),
    Swimlanes(SwimlaneAst),
    Ishikawa(IshikawaAst),
    EventModeling(EventModelingAst),
    Wardley(WardleyAst),
    Cynefin(CynefinAst),
}
