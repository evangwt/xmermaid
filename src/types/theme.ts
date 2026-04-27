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
  fontSize: 14,
};

export const DARK_THEME: RenderTheme = {
  name: 'dark',
  colors: {
    background: '#1a1a2e',
    nodeFill: '#16213e',
    nodeStroke: '#e0e0e0',
    nodeText: '#e0e0e0',
    edgeStroke: '#e0e0e0',
    edgeLabel: '#e0e0e0',
    arrowFill: '#e0e0e0',
    subgraphFill: '#0f3460',
    subgraphStroke: '#555555',
  },
  arrowStyle: 'filled',
  curveStyle: 'bezier',
  edgeGap: 8,
  arrowSize: 10,
  nodeBorderRadius: 4,
  fontFamily: 'sans-serif',
  fontSize: 14,
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
