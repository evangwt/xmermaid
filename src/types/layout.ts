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
  /** Pre-wrapped display lines emitted by layout; absent in legacy payloads. */
  label_lines?: string[];
}

export type EdgeStyle = 'arrow' | 'line' | 'dotted' | 'thick' | 'invisible';

export interface LayoutEdge {
  from: string;
  to: string;
  waypoints: Point[];
  label?: string;
  /** Pre-wrapped display lines emitted by layout; absent in legacy payloads. */
  label_lines?: string[];
  label_position?: Point;
  style: EdgeStyle;
  source_boundary?: Point;
  target_boundary?: Point;
  path_end?: Point;
  final_tangent_angle?: number;
  label_anchor?: Point;
  geometry_version?: 1 | 2;
}

export interface Dimensions {
  width: number;
  height: number;
}
export interface PieSlice { label: string; value: number; start_angle: number; end_angle: number; }

export type XyChartSeriesKind = 'bar' | 'line';

export interface XyChartSeries {
  kind: XyChartSeriesKind;
  bars: Bounds[];
  points: Point[];
}

export interface XyChartLayout {
  title: string;
  plot: Bounds;
  x_labels: string[];
  y_min: number;
  y_max: number;
  series: XyChartSeries[];
}

export interface SankeyNode {
  id: string;
  bounds: Bounds;
  value: number;
  column: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  source_y: number;
  target_y: number;
  thickness: number;
}

export interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  dimensions: Dimensions;
  pie_slices?: PieSlice[];
  xy_chart?: XyChartLayout;
  sankey?: SankeyLayout;
}
