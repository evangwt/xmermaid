import type { LayoutResult, LayoutNode, LayoutEdge, Point } from '../types/layout';
import type { ArrowStyle, RenderTheme } from '../types/theme';
import { DEFAULT_THEME } from '../types/theme';
import { computeEdgePath, computeArrowPoints, type EdgePathResult } from './edge';

export class SVGRenderer {
  private theme: RenderTheme;

  constructor(theme?: Partial<RenderTheme>) {
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  setTheme(theme: Partial<RenderTheme>): void {
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  render(layout: LayoutResult): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(layout.dimensions.width));
    svg.setAttribute('height', String(layout.dimensions.height));
    svg.setAttribute('viewBox', `0 0 ${layout.dimensions.width} ${layout.dimensions.height}`);
    svg.classList.add('xmermaid-diagram');
    svg.style.backgroundColor = this.theme.colors.background;

    // Build node index for bounds lookup
    const nodeMap = new Map<string, LayoutNode>();
    for (const node of layout.nodes) {
      nodeMap.set(node.id, node);
    }

    // Render edges first (behind nodes)
    for (const edge of layout.edges) {
      const group = this.renderEdge(edge, nodeMap);
      svg.appendChild(group);
    }

    // Render nodes on top
    for (const node of layout.nodes) {
      const group = this.renderNode(node);
      svg.appendChild(group);
    }

    return svg;
  }

  private renderNode(node: LayoutNode): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.setAttribute('id', `node-${node.id}`);

    const shape = this.createNodeShape(node);
    shape.setAttribute('fill', this.theme.colors.nodeFill);
    shape.setAttribute('stroke', this.theme.colors.nodeStroke);
    shape.setAttribute('stroke-width', '1.5');
    g.appendChild(shape);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(node.center.x));
    text.setAttribute('y', String(node.center.y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', this.theme.colors.nodeText);
    text.setAttribute('font-family', this.theme.fontFamily);
    text.setAttribute('font-size', String(this.theme.fontSize));
    text.textContent = node.label;
    g.appendChild(text);

    return g;
  }

  private createNodeShape(node: LayoutNode): SVGElement {
    const { bounds, shape } = node;
    const { x, y, width, height } = bounds;
    const cx = node.center.x;
    const cy = node.center.y;

    switch (shape) {
      case 'RoundedRect': {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(this.theme.nodeBorderRadius + 8));
        rect.setAttribute('ry', String(this.theme.nodeBorderRadius + 8));
        return rect;
      }
      case 'Stadium': {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(height / 2));
        rect.setAttribute('ry', String(height / 2));
        return rect;
      }
      case 'Diamond': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`);
        return polygon;
      }
      case 'Circle': {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const r = Math.min(width, height) / 2;
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(r));
        return circle;
      }
      case 'Hexagon': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const offset = width * 0.25;
        polygon.setAttribute('points', [
          `${x + offset},${y}`,
          `${x + width - offset},${y}`,
          `${x + width},${cy}`,
          `${x + width - offset},${y + height}`,
          `${x + offset},${y + height}`,
          `${x},${cy}`,
        ].join(' '));
        return polygon;
      }
      case 'Parallelogram': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const offset = width * 0.15;
        polygon.setAttribute('points', [
          `${x + offset},${y}`,
          `${x + width},${y}`,
          `${x + width - offset},${y + height}`,
          `${x},${y + height}`,
        ].join(' '));
        return polygon;
      }
      case 'Trapezoid': {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const offset = width * 0.15;
        polygon.setAttribute('points', [
          `${x + offset},${y}`,
          `${x + width - offset},${y}`,
          `${x + width},${y + height}`,
          `${x},${y + height}`,
        ].join(' '));
        return polygon;
      }
      case 'Rectangle':
      default: {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
        rect.setAttribute('rx', String(this.theme.nodeBorderRadius));
        rect.setAttribute('ry', String(this.theme.nodeBorderRadius));
        return rect;
      }
    }
  }

  private renderEdge(edge: LayoutEdge, nodeMap: Map<string, LayoutNode>): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edge');

    const sourceNode = nodeMap.get(edge.from);
    const targetNode = nodeMap.get(edge.to);

    if (!sourceNode || !targetNode) return g;

    const edgeResult = this.resolveEdgePath(edge, sourceNode, targetNode);

    // Draw the edge path (ends at arrow base, not arrow tip)
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', edgeResult.path);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', this.theme.colors.edgeStroke);

    // Apply edge style
    switch (edge.style) {
      case 'dotted':
        pathEl.setAttribute('stroke-dasharray', '5,5');
        pathEl.setAttribute('stroke-width', '1.5');
        break;
      case 'thick':
        pathEl.setAttribute('stroke-width', '3');
        break;
      case 'invisible':
        pathEl.setAttribute('stroke', 'none');
        break;
      default:
        pathEl.setAttribute('stroke-width', '1.5');
    }
    g.appendChild(pathEl);

    // Draw arrowhead (skip for 'line' and 'invisible' styles)
    if (edge.style !== 'line' && edge.style !== 'invisible') {
      for (const arrowEl of this.createArrowElements(this.theme.arrowStyle, edgeResult)) {
        g.appendChild(arrowEl);
      }
    }

    // Draw edge label if present
    if (edge.label) {
      const labelPos = edge.label_anchor ?? edge.label_position ?? this.computeLabelPosition(edgeResult);
      const fontSize = this.theme.fontSize - 2;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(labelPos.x));
      text.setAttribute('y', String(labelPos.y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', this.theme.colors.edgeLabel);
      text.setAttribute('font-family', this.theme.fontFamily);
      text.setAttribute('font-size', String(fontSize));

      // Background for readability — measure actual text width
      const textWidth = this.measureText(edge.label, fontSize);
      const padX = 4;
      const padY = 3;
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', String(labelPos.x - textWidth / 2 - padX));
      bg.setAttribute('y', String(labelPos.y - fontSize / 2 - padY));
      bg.setAttribute('width', String(textWidth + padX * 2));
      bg.setAttribute('height', String(fontSize + padY * 2));
      bg.setAttribute('fill', this.theme.colors.background);
      bg.setAttribute('rx', '2');
      g.appendChild(bg);

      text.textContent = edge.label;
      g.appendChild(text);
    }

    return g;
  }

  private resolveEdgePath(edge: LayoutEdge, sourceNode: LayoutNode, targetNode: LayoutNode): EdgePathResult {
    const explicit = this.computeExplicitEdgePath(edge);
    if (explicit) return explicit;

    return computeEdgePath(
      edge.waypoints,
      sourceNode.bounds,
      targetNode.bounds,
      this.theme.curveStyle,
      this.theme.edgeGap,
      this.theme.arrowSize,
      sourceNode.shape,
      targetNode.shape,
    );
  }

  private computeExplicitEdgePath(edge: LayoutEdge): EdgePathResult | undefined {
    if (
      edge.geometry_version !== 1 ||
      !edge.source_boundary ||
      !edge.target_boundary ||
      !edge.path_end ||
      edge.final_tangent_angle === undefined ||
      !Number.isFinite(edge.final_tangent_angle)
    ) {
      return undefined;
    }

    return {
      path: this.buildExplicitPath(edge),
      arrowTip: edge.target_boundary,
      arrowAngle: edge.final_tangent_angle,
      pathEnd: edge.path_end,
    };
  }

  private buildExplicitPath(edge: LayoutEdge): string {
    const points = [
      edge.source_boundary!,
      ...edge.waypoints.slice(1, -1),
      edge.path_end!,
    ];

    if (this.theme.curveStyle === 'step') {
      return this.buildStepPath(points);
    }

    if (this.theme.curveStyle === 'bezier' && points.length === 2) {
      return this.buildSimpleBezierPath(points[0], points[1]);
    }

    return this.buildStraightPath(points);
  }

  private buildStraightPath(points: Point[]): string {
    const [start, ...rest] = points;
    return [
      `M ${start.x} ${start.y}`,
      ...rest.map(point => `L ${point.x} ${point.y}`),
    ].join(' ');
  }

  private buildStepPath(points: Point[]): string {
    const [start, ...rest] = points;
    const parts = [`M ${start.x} ${start.y}`];

    for (const point of rest) {
      const prev = this.parsePathEnd(parts[parts.length - 1]) ?? start;
      const midX = (prev.x + point.x) / 2;
      parts.push(`H ${midX}`);
      parts.push(`V ${point.y}`);
      parts.push(`L ${point.x} ${point.y}`);
    }

    return parts.join(' ');
  }

  private buildSimpleBezierPath(start: Point, end: Point): string {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tension = Math.min(dist * 0.4, 50);
    const isVertical = Math.abs(dy) >= Math.abs(dx);

    if (isVertical) {
      const sign = dy >= 0 ? 1 : -1;
      return `M ${start.x} ${start.y} C ${start.x} ${start.y + tension * sign} ${end.x} ${end.y - tension * sign} ${end.x} ${end.y}`;
    }

    const sign = dx >= 0 ? 1 : -1;
    return `M ${start.x} ${start.y} C ${start.x + tension * sign} ${start.y} ${end.x - tension * sign} ${end.y} ${end.x} ${end.y}`;
  }

  private parsePathEnd(pathPart: string): Point | undefined {
    const nums = pathPart.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
    if (!nums || nums.length < 2) return undefined;
    return {
      x: nums[nums.length - 2],
      y: nums[nums.length - 1],
    };
  }

  private createArrowElements(style: ArrowStyle, edgeResult: EdgePathResult): SVGElement[] {
    switch (style) {
      case 'open': {
        const arrowPoints = this.computeArrowPoints(style, edgeResult);
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', arrowPoints);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', this.theme.colors.edgeStroke);
        polyline.setAttribute('stroke-width', '1.5');
        return [polyline];
      }
      case 'circle': {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(edgeResult.arrowTip.x));
        circle.setAttribute('cy', String(edgeResult.arrowTip.y));
        circle.setAttribute('r', String(this.theme.arrowSize / 2));
        circle.setAttribute('fill', this.theme.colors.arrowFill);
        circle.setAttribute('stroke', this.theme.colors.edgeStroke);
        circle.setAttribute('stroke-width', '1');
        return [circle];
      }
      case 'cross': {
        const points = this.parsePoints(this.computeArrowPoints(style, edgeResult));
        if (points.length < 3) return [];
        const crossA = this.createArrowLine(points[0], points[2]);
        const crossB = this.createArrowLine(edgeResult.arrowTip, edgeResult.pathEnd ?? points[1]);
        return [crossA, crossB];
      }
      case 'filled':
      case 'triangle':
      default: {
        const arrowPoints = this.computeArrowPoints(style, edgeResult);
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', arrowPoints);
        polygon.setAttribute('fill', this.theme.colors.arrowFill);
        polygon.setAttribute('stroke', this.theme.colors.edgeStroke);
        polygon.setAttribute('stroke-width', '1');
        return [polygon];
      }
    }
  }

  private computeArrowPoints(style: ArrowStyle, edgeResult: EdgePathResult): string {
    return computeArrowPoints(
      edgeResult.arrowTip,
      edgeResult.arrowAngle,
      this.theme.arrowSize,
      style,
    );
  }

  private createArrowLine(from: Point, to: Point): SVGLineElement {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('arrow-cross');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x));
    line.setAttribute('y2', String(to.y));
    line.setAttribute('stroke', this.theme.colors.edgeStroke);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linecap', 'round');
    return line;
  }

  private parsePoints(points: string): Point[] {
    return points.split(' ').map(point => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  private computeLabelPosition(edgeResult: EdgePathResult): Point {
    const pathStart = this.parsePathStart(edgeResult.path);
    if (pathStart && edgeResult.pathEnd) {
      return {
        x: (pathStart.x + edgeResult.pathEnd.x) / 2,
        y: (pathStart.y + edgeResult.pathEnd.y) / 2,
      };
    }
    return edgeResult.pathEnd ?? edgeResult.arrowTip;
  }

  private parsePathStart(path: string): Point | undefined {
    const match = /^M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/.exec(path.trim());
    if (!match) return undefined;
    return {
      x: Number(match[1]),
      y: Number(match[2]),
    };
  }

  private measureText(text: string, fontSize: number): number {
    const fallbackWidth = text.length * fontSize * 0.6;

    try {
      const canvas = SVGRenderer.getCanvas();
      if (!canvas) return fallbackWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return fallbackWidth;
      ctx.font = `${fontSize}px ${this.theme.fontFamily}`;
      return ctx.measureText(text).width;
    } catch {
      return fallbackWidth;
    }
  }

  private static _canvas: HTMLCanvasElement | null = null;

  private static getCanvas(): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    SVGRenderer._canvas ??= document.createElement('canvas');
    return SVGRenderer._canvas;
  }
}
