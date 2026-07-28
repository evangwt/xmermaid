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

export interface FlowchartNode {
  id: string;
  label: string | null;
  shape: NodeShape;
  classes: string[];
  styles: string[];
}

export interface FlowchartEdge {
  from: string;
  to: string;
  style: EdgeStyle;
  label: string | null;
  min_length: number;
}

export interface Subgraph {
  title: string;
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
  participants: string[];
  messages: SequenceMessage[];
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
}

export interface ClassAst {
  type: 'class';
  classes: ClassDefinition[];
  relations: ClassRelation[];
}

export interface ClassDefinition {
  id: string;
  label: string;
}

export interface ClassRelation {
  from: string;
  to: string;
}

export interface StateAst {
  type: 'state';
  states: string[];
  transitions: StateTransition[];
}

export interface StateTransition {
  from: string;
  to: string;
  label: string;
}

export interface ErAst {
  type: 'er';
  entities: string[];
  relationships: ErRelationship[];
}

export interface ErRelationship {
  from: string;
  to: string;
  label: string;
}

export interface GanttAst {
  type: 'gantt';
  tasks: GanttTask[];
}

export interface GanttTask {
  section: string;
  label: string;
  start: string;
  duration_days: number;
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
}

export interface C4Element {
  kind: string;
  id: string;
  label: string;
  description: string | null;
}

export interface C4Relationship {
  from: string;
  to: string;
  label: string;
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

export type DiagramAst = FlowchartAst | SequenceAst | ClassAst | StateAst | ErAst | GanttAst | UserJourneyAst | TimelineAst | RequirementAst | GitGraphAst | C4Ast | ZenUmlAst | SankeyAst | XyChartAst;
