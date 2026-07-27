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

export const LIGHT_THEME: RenderTheme = {
  ...DEFAULT_THEME,
  name: 'xmermaid-light',
  colors: {
    background: '#f7f9fb',
    nodeFill: '#ffffff',
    nodeStroke: '#0f766e',
    nodeText: '#17212b',
    edgeStroke: '#52606d',
    edgeLabel: '#334155',
    arrowFill: '#0f9f8f',
    subgraphFill: '#edf7f5',
    subgraphStroke: '#94a3b8',
  },
  edgeGap: 2,
};

export const DARK_THEME: RenderTheme = {
  ...DEFAULT_THEME,
  name: 'xmermaid-dark',
  colors: {
    background: '#0b1117',
    nodeFill: '#15212b',
    nodeStroke: '#2dd4bf',
    nodeText: '#e6edf3',
    edgeStroke: '#9fb0bf',
    edgeLabel: '#d5dee7',
    arrowFill: '#2dd4bf',
    subgraphFill: '#111c24',
    subgraphStroke: '#3c4b57',
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
