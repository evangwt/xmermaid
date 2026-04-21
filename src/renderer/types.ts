export interface RenderContext {
  ast: unknown;
  layout: unknown;
  theme: string;
  container?: HTMLElement;
}

export interface RenderOutput {
  svg: SVGElement;
  width: number;
  height: number;
}
