import type { FlowchartAst, LayoutResult } from '../types';

export interface RenderContext {
  ast: FlowchartAst;
  layout: LayoutResult;
  container?: Element;
}

export interface RenderOutput {
  element: SVGElement;
  dimensions: { width: number; height: number };
}
