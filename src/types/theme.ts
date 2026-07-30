export type ArrowStyle = 'triangle' | 'filled' | 'open' | 'circle' | 'cross';
export type CurveStyle = 'bezier' | 'step' | 'straight';

export interface ThemeColors {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  edgeStroke: string;
  edgeLabel: string;
  arrowFill: string;
  subgraphFill: string;
  subgraphStroke: string;
}

export interface RenderTheme {
  name: string;
  colors: ThemeColors;
  arrowStyle: ArrowStyle;
  curveStyle: CurveStyle;
  edgeGap: number;
  arrowSize: number;
  nodeBorderRadius: number;
  fontFamily: string;
  fontSize: number;
}

export const DEFAULT_THEME: RenderTheme = {
  name: 'default',
  colors: {
    background: '#ffffff',
    nodeFill: '#f9f9f9',
    nodeStroke: '#333333',
    nodeText: '#333333',
    edgeStroke: '#333333',
    edgeLabel: '#333333',
    arrowFill: '#333333',
    subgraphFill: '#f0f0f0',
    subgraphStroke: '#999999',
  },
  arrowStyle: 'filled',
  curveStyle: 'bezier',
  edgeGap: 8,
  arrowSize: 10,
  nodeBorderRadius: 4,
  fontFamily: 'sans-serif',
  fontSize: 12,
};

export const LIGHT_THEME: RenderTheme = {
  ...DEFAULT_THEME,
  name: 'xmermaid-light',
  colors: {
    background: '#F8F7FF',
    nodeFill: '#FFFFFF',
    nodeStroke: '#6D28D9',
    nodeText: '#211A36',
    edgeStroke: '#665E7D',
    edgeLabel: '#4F4666',
    arrowFill: '#6D28D9',
    subgraphFill: '#F0EDFF',
    subgraphStroke: '#B8A9E8',
  },
  edgeGap: 2,
};

export const DARK_THEME: RenderTheme = {
  ...DEFAULT_THEME,
  name: 'xmermaid-dark',
  colors: {
    background: '#0D0B1A',
    nodeFill: '#15112A',
    nodeStroke: '#A78BFA',
    nodeText: '#F4F1FF',
    edgeStroke: '#B9B1D4',
    edgeLabel: '#DDD7F2',
    arrowFill: '#A78BFA',
    subgraphFill: '#100D22',
    subgraphStroke: '#4C426D',
  },
  edgeGap: 2,
};

export const MINIMAL_THEME: RenderTheme = {
  name: 'minimal',
  colors: {
    background: '#ffffff',
    nodeFill: '#ffffff',
    nodeStroke: '#666666',
    nodeText: '#333333',
    edgeStroke: '#999999',
    edgeLabel: '#666666',
    arrowFill: '#999999',
    subgraphFill: '#fafafa',
    subgraphStroke: '#cccccc',
  },
  arrowStyle: 'open',
  curveStyle: 'step',
  edgeGap: 6,
  arrowSize: 8,
  nodeBorderRadius: 0,
  fontFamily: 'monospace',
  fontSize: 12,
};

export function createTheme(overrides: Partial<RenderTheme> = {}): RenderTheme {
  return { ...DEFAULT_THEME, ...overrides };
}
