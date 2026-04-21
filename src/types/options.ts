export interface XMermaidOptions {
  renderer?: 'svg';
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  themeConfig?: Record<string, unknown>;
  securityLevel?: 'strict' | 'loose';
  performance?: {
    maxParseTime?: number;
    maxLayoutTime?: number;
    maxRenderTime?: number;
  };
}
