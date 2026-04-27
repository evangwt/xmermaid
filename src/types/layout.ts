export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type NodeShape =
  | 'Rectangle'
  | 'RoundedRect'
  | 'Stadium'
  | 'Diamond'
  | 'Circle'
  | 'Hexagon'
  | 'Parallelogram'
  | 'Trapezoid';

export interface LayoutConfig {
  node_width: number;
  node_height: number;
  h_spacing: number;
  v_spacing: number;
  padding: number;
  direction: FlowDirection;
}

export interface LayoutNode {
  id: string;
  center: Point;
  bounds: Bounds;
  shape: NodeShape;
  label: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
  waypoints: Point[];
  label?: string;
  label_position?: Point;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  dimensions: Dimensions;
}
