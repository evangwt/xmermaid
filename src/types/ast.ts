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

export type DiagramAst = FlowchartAst | SequenceAst | ClassAst | StateAst;
