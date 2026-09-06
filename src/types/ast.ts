export type FlowDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export type NodeShape =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'double_circle'
  | 'diamond'
  | 'hexagon'
  | 'stadium'
  | 'subroutine'
  | 'parallelogram'
  | 'trapezoid'
  | 'asymmetric'
  | 'cylinder';

export type EdgeStyle = 'arrow' | 'line' | 'dotted' | 'thick' | 'invisible';

export type EdgeMarker = 'arrow' | 'triangle' | 'circle' | 'cross' | 'diamond';

export interface FlowchartNode {
  id: string;
  label: string | null;
  shape: NodeShape;
  classes: string[];
  styles: string[];
  style?: NodeStyle;
}

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  color?: string;
  stroke_width?: string;
  stroke_dasharray?: string;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  style: EdgeStyle;
  label: string | null;
  min_length: number;
  start_marker?: EdgeMarker;
  end_marker?: EdgeMarker;
}

export interface Subgraph {
  title: string;
  id?: string;
  nodes: string[];
  subgraphs: Subgraph[];
}

export interface FlowchartAst {
  type: 'flowchart';
  direction: FlowDirection;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs: Subgraph[];
}

export interface SequenceAst {
  type: 'sequence';
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  events: SequenceEvent[];
  boxes?: SequenceBox[];
}

export type SequenceParticipantKind = 'participant' | 'actor';

export interface SequenceParticipant {
  id: string;
  label: string;
  kind: SequenceParticipantKind;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  line_style?: SequenceMessageLineStyle;
  end_marker?: SequenceMessageEnd;
  activate_target?: boolean;
  deactivate_source?: boolean;
  bidirectional?: boolean;
}

export interface SequenceBox {
  label?: string;
  color?: string;
  participants: string[];
}

export type SequenceMessageLineStyle = 'solid' | 'dashed';
export type SequenceMessageEnd = 'arrow' | 'cross' | 'open';
export type SequenceNotePlacement = 'left_of' | 'right_of' | 'over';
export type SequenceBlockKind = 'rect' | 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break';
export type SequenceBlockDividerKind = 'else' | 'and' | 'option';
export type SequenceEvent =
  | { kind: 'autonumber'; start?: number; increment?: number }
  | { kind: 'create'; participant: string }
  | { kind: 'destroy'; participant: string }
  | { kind: 'message'; message_index: number }
  | { kind: 'activation'; participant: string; active: boolean }
  | { kind: 'note'; placement: SequenceNotePlacement; participants: string[]; text: string }
  | { kind: 'block_start'; block: SequenceBlockKind; label: string; color?: string }
  | { kind: 'block_divider'; divider: SequenceBlockDividerKind; label: string }
  | { kind: 'block_end' };

export interface ClassAst {
  type: 'class';
  classes: ClassDefinition[];
  relations: ClassRelation[];
  namespaces?: ClassNamespace[];
  styles?: ClassStyleAssignment[];
}

export interface ClassNamespace {
  id: string;
  classes: string[];
}

export interface ClassStyleAssignment {
  class: string;
  style: NodeStyle;
}

export interface ClassDefinition {
  id: string;
  label: string;
  members?: string[];
  annotation?: string;
  namespace?: string;
}

export type ClassRelationKind =
  | 'inheritance'
  | 'composition'
  | 'aggregation'
  | 'association'
  | 'link'
  | 'dependency'
  | 'realization';

export interface ClassRelation {
  from: string;
  to: string;
  kind: ClassRelationKind;
  label?: string;
  from_cardinality?: string;
  to_cardinality?: string;
}

export type StatePseudostate = 'start' | 'end' | 'choice' | 'fork' | 'join';

export interface StateNode {
  id: string;
  label?: string;
  pseudostate?: StatePseudostate;
  composite?: boolean;
  parent?: string;
}

export type StateNotePlacement = 'left' | 'right';

export interface StateNote {
  target: string;
  placement: StateNotePlacement;
  text: string;
}

export interface StateAst {
  type: 'state';
  states: StateNode[];
  transitions: StateTransition[];
  notes?: StateNote[];
}

export interface StateTransition {
  from: string;
  to: string;
  label: string;
}

export type ErCardinality = 'zero_or_one' | 'exactly_one' | 'zero_or_more' | 'one_or_more';

export interface ErAttribute {
  kind: string;
  name: string;
  keys: string[];
  comment?: string;
}

export interface ErEntity {
  name: string;
  attributes?: ErAttribute[];
}

export interface ErAst {
  type: 'er';
  entities: ErEntity[];
  relationships: ErRelationship[];
}

export interface ErRelationship {
  from: string;
  to: string;
  label: string;
  from_cardinality: ErCardinality;
  to_cardinality: ErCardinality;
  non_identifying: boolean;
}

export type GanttTaskState = 'todo' | 'done' | 'active' | 'crit';

export type GanttStart =
  | { kind: 'date'; date: string }
  | { kind: 'after'; task_id: string };

export interface GanttAst {
  type: 'gantt';
  title?: string;
  tasks: GanttTask[];
}

export interface GanttTask {
  section: string;
  label: string;
  id: string;
  state?: GanttTaskState;
  milestone?: boolean;
  start: GanttStart;
  duration_days: number;
  end_date?: string;
}

export interface UserJourneyAst {
  type: 'userjourney';
  title: string;
  tasks: UserJourneyTask[];
}

export interface UserJourneyTask {
  section: string;
  label: string;
  score: number;
  actors: string[];
}

export interface TimelineAst {
  type: 'timeline';
  title: string;
  entries: TimelineEntry[];
}

export interface TimelineEntry {
  period: string;
  events: string[];
  section?: string;
}

export interface RequirementAst {
  type: 'requirement';
  requirements: Requirement[];
  relationships: RequirementRelationship[];
}

export interface Requirement {
  kind: string;
  name: string;
  id: string | null;
  text: string | null;
  risk: string | null;
  verify_method: string | null;
}

export interface RequirementRelationship {
  from: string;
  to: string;
  label: string;
}

export interface GitGraphAst {
  type: 'gitgraph';
  commits: GitCommit[];
}

export interface GitCommit {
  id: string;
  branch: string;
  tag: string | null;
  commit_type: string | null;
  parents: string[];
}

export interface C4Ast {
  type: 'c4';
  diagram_kind: string;
  title: string;
  elements: C4Element[];
  relationships: C4Relationship[];
  boundaries?: C4Boundary[];
}

export interface C4Element {
  kind: string;
  id: string;
  label: string;
  description: string | null;
  container?: string;
}

export interface C4Relationship {
  from: string;
  to: string;
  label: string;
  bidirectional?: boolean;
}

export interface C4Boundary {
  kind: string;
  id: string;
  label: string;
  elements: string[];
  boundaries?: C4Boundary[];
}

export interface ZenUmlAst {
  type: 'zenuml';
  participants: string[];
  messages: ZenUmlMessage[];
}

export interface ZenUmlMessage {
  from: string;
  to: string;
  label: string;
  kind: 'call' | 'return';
}

export type XySeriesKind = 'bar' | 'line';

export interface XySeries {
  kind: XySeriesKind;
  values: number[];
}

export interface XyChartAst {
  type: 'xychart';
  title: string;
  x_labels: string[];
  /** Numeric x-axis range; present when x_labels is empty. */
  x_range?: [number, number];
  x_title?: string;
  y_min: number;
  y_max: number;
  series: XySeries[];
}

export interface SankeyAstLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyAst {
  type: 'sankey';
  nodes: string[];
  links: SankeyAstLink[];
}

export interface QuadrantPoint {
  label: string;
  x: number;
  y: number;
}

export interface QuadrantAst {
  type: 'quadrant';
  title: string;
  x_axis: [string, string] | null;
  y_axis: [string, string] | null;
  quadrants: [string, string, string, string];
  points: QuadrantPoint[];
}

export interface ArchitectureService {
  id: string;
  icon: string;
  label: string;
  group?: string;
}

export interface ArchitectureGroup {
  id: string;
  icon: string;
  label: string;
}

export interface ArchitectureJunction {
  id: string;
}

export interface ArchitectureRelationship {
  from: string;
  to: string;
  arrow_at_target: boolean;
  arrow_at_source?: boolean;
}

export interface ArchitectureAst {
  type: 'architecture';
  services: ArchitectureService[];
  relationships: ArchitectureRelationship[];
  groups?: ArchitectureGroup[];
  junctions?: ArchitectureJunction[];
}

export interface BlockAstBlock {
  id: string;
  label: string;
  span: number;
  row: number;
  column: number;
}

export interface BlockAstRelationship {
  from: string;
  to: string;
  arrow_at_target: boolean;
}

export interface BlockAst {
  type: 'block';
  columns: number;
  blocks: BlockAstBlock[];
  relationships: BlockAstRelationship[];
}

export interface KanbanTask {
  id: string;
  label: string;
  ticket?: string;
}

export interface KanbanColumn {
  id: string;
  label: string;
  tasks: KanbanTask[];
}

export interface KanbanAst {
  type: 'kanban';
  columns: KanbanColumn[];
}

export interface PacketField {
  start: number;
  end: number;
  label: string;
}

export interface PacketAst {
  type: 'packet';
  title: string;
  fields: PacketField[];
}

export type DiagramAst = FlowchartAst | SequenceAst | ClassAst | StateAst | ErAst | GanttAst | UserJourneyAst | TimelineAst | RequirementAst | GitGraphAst | C4Ast | ZenUmlAst | SankeyAst | QuadrantAst | ArchitectureAst | BlockAst | KanbanAst | PacketAst | XyChartAst;
