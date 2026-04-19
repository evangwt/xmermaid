export type FlowDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export type NodeShape =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'diamond'
  | 'stadium'
  | 'subroutine'
  | 'hexagon'
  | 'parallelogram'
  | 'trapezoid'
  | 'doubleCircle';

export type EdgeStyle = 'arrow' | 'line' | 'dotted' | 'thick' | 'invisible';

export interface StyleDef {
  key: string;
  value: string;
}

export interface Node {
  id: string;
  label?: string;
  shape: NodeShape;
  classes: string[];
  styles: StyleDef[];
}

export interface Edge {
  from: string;
  to: string;
  style: EdgeStyle;
  label?: string;
  min_length: number;
}

export interface Subgraph {
  title: string;
  nodes: string[];
  subgraphs: Subgraph[];
}

export interface FlowchartAst {
  direction: FlowDirection;
  nodes: Node[];
  edges: Edge[];
  subgraphs: Subgraph[];
}

export interface SequenceAst {
  participants: string[];
}

export type DiagramAst =
  | ({ type: 'flowchart' } & FlowchartAst)
  | ({ type: 'sequence' } & SequenceAst);