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
}

export type DiagramAst = FlowchartAst | SequenceAst;
