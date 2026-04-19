export type RendererType = 'svg' | 'canvas' | 'auto';

export type ThemeName = 'default' | 'dark' | 'forest' | 'neutral' | 'custom';

export interface ThemeConfig {
  primaryColor?: string;
  primaryTextColor?: string;
  primaryBorderColor?: string;
  lineColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  background?: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface PerformanceOptions {
  streaming?: boolean;
  incremental?: boolean;
  cacheSize?: number;
}

export interface XMermaidOptions {
  renderer?: RendererType;
  theme?: ThemeName;
  themeConfig?: ThemeConfig;
  securityLevel?: 'loose' | 'strict';
  performance?: PerformanceOptions;
}
