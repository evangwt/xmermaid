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
    /// Fork/join synchronization bar (state diagrams).
    Bar,
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeStyle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stroke_dasharray: Option<String>,
}

impl NodeStyle {
    pub fn is_empty(&self) -> bool {
        self.fill.is_none()
            && self.stroke.is_none()
            && self.color.is_none()
            && self.stroke_width.is_none()
            && self.stroke_dasharray.is_none()
    }
}

/// A `linkStyle` statement: safe visual overrides applied to edges by their
/// zero-based declaration index. An empty index list (`linkStyle default`)
/// applies to every edge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkStyle {
    pub indices: Vec<usize>,
    pub targets_default: bool,
    pub style: NodeStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub label: Option<String>,
    pub shape: NodeShape,
    pub classes: Vec<String>,
    pub styles: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<NodeStyle>,
}

/// Endpoint decoration drawn on one side of an edge.
///
/// `style` still encodes the line pattern plus the implicit default arrowhead;
/// markers override or add decorations such as circles (`o`), crosses (`x`),
/// diamonds (class composition), and hollow triangles (class inheritance).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeMarker {
    /// Filled arrowhead — used explicitly for bidirectional edges and dotted arrows.
    Arrow,
    /// Hollow (open) triangle — class inheritance and realization heads.
    Triangle,
    /// Hollow circle — `o` flowchart endings and class aggregation.
    Circle,
    /// Cross — `x` flowchart endings.
    Cross,
    /// Hollow diamond — class composition owners.
    Diamond,
    /// ER zero-or-one: prong plus circle.
    CrowZeroOne,
    /// ER exactly-one: single prong.
    CrowOne,
    /// ER zero-or-more: three-prong fork.
    CrowMany,
    /// ER one-or-more: prong plus fork.
    CrowOneOrMore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub from: String,
    pub to: String,
    pub style: EdgeStyle,
    pub label: Option<String>,
    pub min_length: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_marker: Option<EdgeMarker>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_marker: Option<EdgeMarker>,
}

impl Edge {
    pub fn new(from: String, to: String, style: EdgeStyle) -> Self {
        Self {
            from,
            to,
            style,
            label: None,
            min_length: 1,
            start_marker: None,
            end_marker: None,
        }
    }

    pub fn with_label(mut self, label: Option<String>) -> Self {
        self.label = label;
        self
    }

    pub fn with_min_length(mut self, min_length: usize) -> Self {
        self.min_length = min_length.max(1);
        self
    }

    pub fn with_markers(
        mut self,
        start_marker: Option<EdgeMarker>,
        end_marker: Option<EdgeMarker>,
    ) -> Self {
        self.start_marker = start_marker;
        self.end_marker = end_marker;
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subgraph {
    pub title: String,
    /// Declared container id (`subgraph one [One]` → `one`), when present.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub nodes: Vec<String>,
    pub subgraphs: Vec<Subgraph>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowchartAst {
    pub direction: FlowDirection,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub subgraphs: Vec<Subgraph>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub link_styles: Vec<LinkStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceAst {
    pub participants: Vec<SequenceParticipant>,
    pub messages: Vec<SequenceMessage>,
    #[serde(default)]
    pub events: Vec<SequenceEvent>,
    /// `box` groups declared in source order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub boxes: Vec<SequenceBox>,
}

/// A `box ... end` group framing participants.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceBox {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    pub participants: Vec<String>,
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
    /// `<->` / `<-->` links draw arrowheads on both lifelines.
    #[serde(default)]
    pub bidirectional: bool,
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
    /// Open arrowhead used by async `-)` / `--)` messages.
    Open,
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
    Autonumber {
        #[serde(default = "default_sequence_autonumber_start")]
        start: u32,
        #[serde(default = "default_sequence_autonumber_increment")]
        increment: u32,
    },
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
    /// `create participant X` — registers the participant column.
    Create { participant: String },
    /// `destroy X` — terminates the participant lifeline.
    Destroy { participant: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassAst {
    pub classes: Vec<ClassDefinition>,
    pub relations: Vec<ClassRelation>,
    /// `namespace Foo { ... }` containers in declaration order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub namespaces: Vec<ClassNamespace>,
    /// Safe per-class style overrides from `style` directives.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub styles: Vec<ClassStyleAssignment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassNamespace {
    pub id: String,
    pub classes: Vec<String>,
}

/// A `style <Class> <props>` directive scoped to one class.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassStyleAssignment {
    pub class: String,
    pub style: NodeStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassDefinition {
    pub id: String,
    pub label: String,
    /// Member strings (attributes and methods) rendered inside the class box.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub members: Vec<String>,
    /// Classifier annotation such as `<<interface>>` or `<<abstract>>`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub annotation: Option<String>,
    /// Enclosing namespace id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
}

/// Relationship kinds from the Mermaid class diagram grammar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassRelationKind {
    /// `<|--` / `--|>` generalization (solid triangle at the parent).
    Inheritance,
    /// `*--` composition (filled diamond at the owner).
    Composition,
    /// `o--` aggregation (hollow diamond at the owner).
    Aggregation,
    /// `-->` directed association.
    Association,
    /// `--` undirected link.
    Link,
    /// `..>` dependency (dotted arrow).
    Dependency,
    /// `..|>` / `<|..` realization (dotted triangle at the interface).
    Realization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassRelation {
    /// Tail of the drawn edge (where the line starts).
    pub from: String,
    /// Head of the drawn edge (where the arrow or triangle marker points).
    pub to: String,
    pub kind: ClassRelationKind,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_cardinality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_cardinality: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StatePseudostate {
    Start,
    End,
    /// `<<choice>>` diamond branch point.
    Choice,
    /// `<<fork>>` split bar.
    Fork,
    /// `<<join>>` merge bar.
    Join,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateNode {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pseudostate: Option<StatePseudostate>,
    /// True when this node is a composite state container.
    #[serde(default)]
    pub composite: bool,
    /// Enclosing composite state id for nested declarations.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
}

/// A `note left/right of STATE` annotation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateNote {
    pub target: String,
    pub placement: StateNotePlacement,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StateNotePlacement {
    Left,
    Right,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateAst {
    pub states: Vec<StateNode>,
    pub transitions: Vec<StateTransition>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<StateNote>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTransition { pub from: String, pub to: String, pub label: String }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErCardinality {
    ZeroOrOne,
    ExactlyOne,
    ZeroOrMore,
    OneOrMore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErEntity {
    pub name: String,
    /// Attribute rows rendered inside the entity box.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attributes: Vec<ErAttribute>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErAttribute {
    pub kind: String,
    pub name: String,
    /// Key markers such as PK, FK, UK in declaration order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keys: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErAst {
    pub entities: Vec<ErEntity>,
    pub relationships: Vec<ErRelationship>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErRelationship {
    pub from: String,
    pub to: String,
    pub label: String,
    pub from_cardinality: ErCardinality,
    pub to_cardinality: ErCardinality,
    /// True for `..` non-identifying relationships.
    pub non_identifying: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GanttTaskState {
    Todo,
    Done,
    Active,
    Crit,
}

impl Default for GanttTaskState {
    fn default() -> Self {
        Self::Todo
    }
}

/// Start anchor of a Gantt task: an explicit date or the end of one or more
/// other tasks (`after t1 t2` starts after all listed tasks finish).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GanttStart {
    Date { date: String },
    After { task_ids: Vec<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GanttAst {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub title: String,
    pub tasks: Vec<GanttTask>,
    /// Days excluded from working-time calculations (`excludes weekends, ...`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub excludes: Vec<GanttExclusion>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GanttExclusion {
    /// Both weekend days.
    Weekend,
    /// A single weekday: 0 = Monday … 6 = Sunday.
    Weekday { index: u32 },
    /// An explicit excluded date in ISO form.
    Date { date: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GanttTask {
    pub section: String,
    pub label: String,
    /// Identifier referenced by `after` dependencies; synthesized when absent.
    pub id: String,
    #[serde(default)]
    pub state: GanttTaskState,
    #[serde(default)]
    pub milestone: bool,
    pub start: GanttStart,
    /// Task length in calendar days; zero for milestones and date-end tasks.
    pub duration_days: f64,
    /// Explicit end date for tasks declared with `start, end` instead of a duration.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PieAst {
    pub title: String,
    pub slices: Vec<PieSlice>,
    /// `showData` directive: render the slice table alongside the chart.
    #[serde(default)]
    pub show_data: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PieSlice { pub label: String, pub value: f64 }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserJourneyAst { pub title: String, pub tasks: Vec<UserJourneyTask> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserJourneyTask { pub section: String, pub label: String, pub score: u8, pub actors: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineAst { pub title: String, pub entries: Vec<TimelineEntry> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEntry { pub period: String, pub events: Vec<String>, #[serde(default, skip_serializing_if = "String::is_empty")] pub section: String }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct MindmapAst { pub nodes: Vec<MindmapNode> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindmapNode {
    pub id: String,
    pub label: String,
    pub parent: Option<String>,
    #[serde(default)]
    pub shape: NodeShape,
    /// FontAwesome icon name from `::icon(fa fa-book)`, normalized to `fa-book`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

impl Default for NodeShape {
    fn default() -> Self {
        Self::Rounded
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct RequirementAst { pub requirements: Vec<Requirement>, pub relationships: Vec<RequirementRelationship> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct Requirement { pub kind: String, pub name: String, pub id: Option<String>, pub text: Option<String>, pub risk: Option<String>, pub verify_method: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct RequirementRelationship { pub from: String, pub to: String, pub label: String }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct GitGraphAst { pub commits: Vec<GitCommit> }
#[derive(Debug, Clone, Serialize, Deserialize)] pub struct GitCommit { pub id: String, pub branch: String, pub tag: Option<String>, pub commit_type: Option<String>, pub parents: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct C4Ast {
    pub diagram_kind: String,
    pub title: String,
    pub elements: Vec<C4Element>,
    pub relationships: Vec<C4Relationship>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub boundaries: Vec<C4Boundary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct C4Element {
    pub kind: String,
    pub id: String,
    pub label: String,
    pub description: Option<String>,
    /// Enclosing boundary or deployment node id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub container: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct C4Relationship {
    pub from: String,
    pub to: String,
    pub label: String,
    /// `BiRel` draws arrowheads on both ends.
    #[serde(default)]
    pub bidirectional: bool,
}

/// A `System_Boundary` / `Container_Boundary` / `Enterprise_Boundary` /
/// `Deployment_Node` container.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct C4Boundary {
    pub kind: String,
    pub id: String,
    pub label: String,
    /// Ids of elements declared directly inside.
    #[serde(default)]
    pub elements: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub boundaries: Vec<C4Boundary>,
}
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
pub struct XyChartAst {
    pub title: String,
    /// Categorical labels; empty when the x-axis is numeric.
    pub x_labels: Vec<String>,
    /// Numeric x-axis: `(min, max)` with an optional axis title.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x_range: Option<(f64, f64)>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub x_title: String,
    pub y_min: f64,
    pub y_max: f64,
    pub series: Vec<XySeries>,
}
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub groups: Vec<ArchitectureGroup>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub junctions: Vec<ArchitectureJunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureService {
    pub id: String,
    pub icon: String,
    pub label: String,
    /// Enclosing group id when declared with `in <group>`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

/// A `group <id>(<icon>)[<label>]` container.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureGroup {
    pub id: String,
    pub icon: String,
    pub label: String,
}

/// A `junction <id>` node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureJunction {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureRelationship {
    pub from: String,
    pub to: String,
    pub arrow_at_target: bool,
    /// `<-->` draws arrowheads on both ends.
    #[serde(default)]
    pub arrow_at_source: bool,
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
    /// Ticket id from `@{ ticket: ... }` metadata, rendered on the card.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ticket: Option<String>,
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

fn default_sequence_autonumber_start() -> u32 {
    1
}

fn default_sequence_autonumber_increment() -> u32 {
    1
}
