import type { LayoutConfig } from './layout';
import type { RenderTheme } from './theme';

export interface XMermaidOptions {
  container: HTMLElement;
  theme?: RenderTheme;
  layoutConfig?: Partial<LayoutConfig>;
}
