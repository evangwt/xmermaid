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

export interface QuadrantPointLayout {
  label: string;
  center: Point;
}

export interface QuadrantChartLayout {
  title: string;
  plot: Bounds;
  x_axis: [string, string] | null;
  y_axis: [string, string] | null;
  quadrants: [string, string, string, string];
  points: QuadrantPointLayout[];
}

export interface BlockLayout {
  id: string;
  label: string;
  span: number;
  bounds: Bounds;
}

export interface BlockDiagramLayout {
  columns: number;
  blocks: BlockLayout[];
}

export interface KanbanTaskLayout {
  id: string;
  label: string;
  bounds: Bounds;
}

export interface KanbanColumnLayout {
  id: string;
  label: string;
  header: Bounds;
  tasks: KanbanTaskLayout[];
}

export interface KanbanBoardLayout {
  columns: KanbanColumnLayout[];
}

export interface TreemapNodeLayout {
  label: string;
  value: number;
  bounds: Bounds;
  depth: number;
  is_leaf: boolean;
}

export interface TreemapLayout {
  nodes: TreemapNodeLayout[];
}

export interface RadarAxisLayout {
  label: string;
  end: Point;
  label_position: Point;
}

export interface RadarCurveLayout {
  label: string;
  points: Point[];
}

export interface RadarLayout {
  title: string;
  center: Point;
  radius: number;
  axes: RadarAxisLayout[];
  curves: RadarCurveLayout[];
  min: number;
  max: number;
}

export interface PacketFieldLayout {
  start: number;
  end: number;
  label: string;
  segments: Bounds[];
}

export interface PacketLayout {
  title: string;
  fields: PacketFieldLayout[];
}
export interface VennSetLayout { id: string; label: string; center: Point; radius: number; }
export interface VennUnionLayout { label: string; position: Point; }
export interface VennLayout { title: string; sets: VennSetLayout[]; unions: VennUnionLayout[]; }
export interface SwimlaneLaneLayout { id: string; label: string; bounds: Bounds; }
export interface SwimlaneLayout { direction: FlowDirection; lanes: SwimlaneLaneLayout[]; }
export interface SequenceParticipantLayout { id: string; label: string; kind: 'participant' | 'actor'; header: Bounds; }
export interface SequenceLifelineLayout { participant: string; start: Point; end: Point; }
export interface SequenceMessageLayout { from: string; to: string; from_x: number; to_x: number; y: number; label: string; label_position: Point; self_width?: number; dashed: boolean; number?: number; end_marker?: 'arrow' | 'cross'; }
export type SequenceNotePlacementLayout = 'left_of' | 'right_of' | 'over';
export interface SequenceNoteLayout { placement: SequenceNotePlacementLayout; participants: string[]; bounds: Bounds; text: string; lines?: string[]; }
export interface SequenceActivationLayout { participant: string; bounds: Bounds; }
export interface SequenceBlockDividerLayout { label: string; y: number; }
export interface SequenceBlockLayout { kind: string; label: string; color?: string; bounds: Bounds; dividers: SequenceBlockDividerLayout[]; }
export interface SequenceLayout { participants: SequenceParticipantLayout[]; lifelines: SequenceLifelineLayout[]; messages: SequenceMessageLayout[]; activations: SequenceActivationLayout[]; notes: SequenceNoteLayout[]; blocks: SequenceBlockLayout[]; }
export interface IshikawaCauseLayout { label: string; parent: string | null; depth: number; branch_anchor: Point; position: Point; }
export interface IshikawaLayout { effect: string; effect_bounds: Bounds; spine_start: Point; spine_end: Point; causes: IshikawaCauseLayout[]; }
export interface WardleyComponentLayout { id: string; label: string; center: Point; anchor: boolean; }
export interface WardleyDependencyLayout { from: string; to: string; }
export interface WardleyLayout { title: string; plot: Bounds; components: WardleyComponentLayout[]; dependencies: WardleyDependencyLayout[]; }
export interface CynefinItemLayout { label: string; }
export interface CynefinDomainLayout { id: string; label: string; bounds: Bounds; items: CynefinItemLayout[]; }
export interface CynefinTransitionLayout { from: string; to: string; label: string; }
export interface CynefinLayout { title: string; domains: CynefinDomainLayout[]; transitions: CynefinTransitionLayout[]; }

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  dimensions: Dimensions;
  pie_slices?: PieSlice[];
  xy_chart?: XyChartLayout;
  sankey?: SankeyLayout;
  quadrant_chart?: QuadrantChartLayout;
  block_diagram?: BlockDiagramLayout;
  kanban_board?: KanbanBoardLayout;
  treemap?: TreemapLayout;
  radar?: RadarLayout;
  packet?: PacketLayout;
  venn?: VennLayout;
  swimlanes?: SwimlaneLayout;
  sequence?: SequenceLayout;
  ishikawa?: IshikawaLayout;
  wardley?: WardleyLayout;
  cynefin?: CynefinLayout;
}
