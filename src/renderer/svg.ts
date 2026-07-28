import type { LayoutResult, LayoutNode, LayoutEdge, Point } from '../types/layout';
import type { ArrowStyle, RenderTheme } from '../types/theme';
import { DEFAULT_THEME } from '../types/theme';
import { computeArrowPlacement, computeEdgePath, computeArrowPoints, type EdgePathResult } from './edge';

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
    if (layout.pie_slices?.length) {
      this.renderPie(svg, layout);
      return svg;
    }
    if (layout.xy_chart) {
      this.renderXyChart(svg, layout);
      return svg;
    }
    if (layout.sankey) {
      this.renderSankey(svg, layout);
      return svg;
    }

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

  private renderPie(svg: SVGSVGElement, layout: LayoutResult): void {
    const cx = layout.dimensions.width / 2;
    const cy = layout.dimensions.height / 2;
    const radius = Math.min(layout.dimensions.width, layout.dimensions.height) * .34;
    const palette = ['#8b5cf6', '#38bdf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185'];
    layout.pie_slices?.forEach((slice, index) => {
      const start = { x: cx + radius * Math.cos(slice.start_angle), y: cy + radius * Math.sin(slice.start_angle) };
      const end = { x: cx + radius * Math.cos(slice.end_angle), y: cy + radius * Math.sin(slice.end_angle) };
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${slice.end_angle - slice.start_angle > Math.PI ? 1 : 0} 1 ${end.x} ${end.y} Z`);
      path.setAttribute('fill', palette[index % palette.length]); path.setAttribute('stroke', this.theme.colors.background); path.setAttribute('stroke-width', '2'); svg.appendChild(path);
      const mid = (slice.start_angle + slice.end_angle) / 2; const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = `${slice.label} ${slice.value}`; text.setAttribute('x', String(cx + (radius + 28) * Math.cos(mid))); text.setAttribute('y', String(cy + (radius + 28) * Math.sin(mid))); text.setAttribute('fill', this.theme.colors.nodeText); text.setAttribute('font-size', String(this.theme.fontSize)); text.setAttribute('text-anchor', Math.cos(mid) > .2 ? 'start' : Math.cos(mid) < -.2 ? 'end' : 'middle'); svg.appendChild(text);
    });
  }

  private renderXyChart(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.xy_chart!;
    const plotRight = chart.plot.x + chart.plot.width;
    const plotBottom = chart.plot.y + chart.plot.height;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('xychart');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = chart.title || 'XY chart';
    group.appendChild(title);

    const axis = (x1: number, y1: number, x2: number, y2: number) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('xychart-axis');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', this.theme.colors.edgeStroke);
      line.setAttribute('stroke-width', '1.5');
      group.appendChild(line);
    };
    axis(chart.plot.x, plotBottom, plotRight, plotBottom);
    axis(chart.plot.x, chart.plot.y, chart.plot.x, plotBottom);

    const addText = (value: string, x: number, y: number, anchor: string) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', anchor);
      text.setAttribute('fill', this.theme.colors.nodeText);
      text.setAttribute('font-family', this.theme.fontFamily);
      text.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 2)));
      text.textContent = value;
      group.appendChild(text);
    };
    if (chart.title) addText(chart.title, chart.plot.x, chart.plot.y - 18, 'start');
    addText(String(chart.y_max), chart.plot.x - 10, chart.plot.y + 4, 'end');
    addText(String(chart.y_min), chart.plot.x - 10, plotBottom + 4, 'end');
    const categoryWidth = chart.plot.width / chart.x_labels.length;
    chart.x_labels.forEach((label, index) => {
      addText(label, chart.plot.x + categoryWidth * (index + .5), plotBottom + 22, 'middle');
    });

    chart.series.forEach(series => {
      if (series.kind === 'bar') {
        series.bars.forEach(bar => {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.classList.add('xychart-bar');
          rect.setAttribute('x', String(bar.x));
          rect.setAttribute('y', String(bar.y));
          rect.setAttribute('width', String(bar.width));
          rect.setAttribute('height', String(bar.height));
          rect.setAttribute('rx', String(Math.min(4, bar.width / 4)));
          rect.setAttribute('fill', this.theme.colors.nodeFill);
          rect.setAttribute('stroke', this.theme.colors.nodeStroke);
          rect.setAttribute('stroke-width', '1.5');
          group.appendChild(rect);
        });
      } else if (series.points.length) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.classList.add('xychart-line');
        line.setAttribute('points', series.points.map(point => `${point.x},${point.y}`).join(' '));
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', this.theme.colors.edgeStroke);
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');
        group.appendChild(line);
      }
    });
    svg.appendChild(group);
  }

  private renderSankey(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.sankey!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('sankey');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Sankey diagram';
    group.appendChild(title);
    const nodes = new Map(chart.nodes.map(node => [node.id, node]));

    for (const link of chart.links) {
      const source = nodes.get(link.source);
      const target = nodes.get(link.target);
      if (!source || !target) continue;
      const sourceX = source.bounds.x + source.bounds.width;
      const targetX = target.bounds.x;
      const control = Math.max(24, (targetX - sourceX) * .46);
      const sourceTop = link.source_y - link.thickness / 2;
      const sourceBottom = link.source_y + link.thickness / 2;
      const targetTop = link.target_y - link.thickness / 2;
      const targetBottom = link.target_y + link.thickness / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('sankey-link');
      path.setAttribute('d', [
        `M ${sourceX} ${sourceTop}`,
        `C ${sourceX + control} ${sourceTop}, ${targetX - control} ${targetTop}, ${targetX} ${targetTop}`,
        `L ${targetX} ${targetBottom}`,
        `C ${targetX - control} ${targetBottom}, ${sourceX + control} ${sourceBottom}, ${sourceX} ${sourceBottom}`,
        'Z',
      ].join(' '));
      path.setAttribute('fill', this.theme.colors.edgeStroke);
      path.setAttribute('fill-opacity', '.38');
      path.setAttribute('stroke', this.theme.colors.edgeStroke);
      path.setAttribute('stroke-opacity', '.5');
      path.setAttribute('stroke-width', '1');
      const description = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      description.textContent = `${link.source} → ${link.target}: ${link.value}`;
      path.appendChild(description);
      group.appendChild(path);
    }

    const palette = [
      this.theme.colors.nodeFill,
      this.theme.colors.nodeStroke,
      this.theme.colors.arrowFill,
      this.theme.colors.subgraphStroke,
      this.theme.colors.subgraphFill,
    ];
    const lastColumn = Math.max(...chart.nodes.map(node => node.column));
    chart.nodes.forEach((node, index) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('sankey-node');
      rect.setAttribute('x', String(node.bounds.x));
      rect.setAttribute('y', String(node.bounds.y));
      rect.setAttribute('width', String(node.bounds.width));
      rect.setAttribute('height', String(node.bounds.height));
      rect.setAttribute('rx', String(Math.min(4, node.bounds.width / 3)));
      rect.setAttribute('fill', palette[index % palette.length]);
      rect.setAttribute('stroke', this.theme.colors.nodeStroke);
      rect.setAttribute('stroke-width', '1.25');
      const description = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      description.textContent = `${node.id}: ${node.value}`;
      rect.appendChild(description);
      group.appendChild(rect);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.classList.add('sankey-label');
      const onRight = node.column < lastColumn;
      label.setAttribute('x', String(onRight ? node.bounds.x + node.bounds.width + 8 : node.bounds.x - 8));
      label.setAttribute('y', String(node.bounds.y + node.bounds.height / 2));
      label.setAttribute('dy', '.35em');
      label.setAttribute('text-anchor', onRight ? 'start' : 'end');
      label.setAttribute('fill', this.theme.colors.nodeText);
      label.setAttribute('font-family', this.theme.fontFamily);
      label.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 1)));
      label.textContent = node.id;
      group.appendChild(label);
    });
    svg.appendChild(group);
  }

  private renderNode(node: LayoutNode): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.setAttribute('id', `node-${node.id}`);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = node.label;
    g.appendChild(title);

    const shape = this.createNodeShape(node);
    shape.setAttribute('fill', this.theme.colors.nodeFill);
    shape.setAttribute('stroke', this.theme.colors.nodeStroke);
    shape.setAttribute('stroke-width', '1.5');
    g.appendChild(shape);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(node.center.x));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', this.theme.colors.nodeText);
    text.setAttribute('font-family', this.theme.fontFamily);
    text.setAttribute('font-size', String(this.theme.fontSize));
    this.setTextLines(text, node.label_lines?.length ? node.label_lines : [node.label], node.center, this.theme.fontSize);
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
      const labelLines = edge.label_lines?.length ? edge.label_lines : [edge.label];
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(labelPos.x));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', this.theme.colors.edgeLabel);
      text.setAttribute('font-family', this.theme.fontFamily);
      text.setAttribute('font-size', String(fontSize));

      // Background for readability — measure actual text width
      const textWidth = Math.max(...labelLines.map(line => this.measureText(line, fontSize)));
      const textHeight = fontSize + (labelLines.length - 1) * fontSize * 1.2;
      const padX = 4;
      const padY = 3;
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', String(labelPos.x - textWidth / 2 - padX));
      bg.setAttribute('y', String(labelPos.y - textHeight / 2 - padY));
      bg.setAttribute('width', String(textWidth + padX * 2));
      bg.setAttribute('height', String(textHeight + padY * 2));
      bg.setAttribute('fill', this.theme.colors.background);
      bg.setAttribute('rx', '2');
      g.appendChild(bg);

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = edge.label;
      g.appendChild(title);
      this.setTextLines(text, labelLines, labelPos, fontSize);
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
      this.edgeHasArrow(edge) ? this.theme.arrowStyle : null,
      this.edgeStrokeWidth(edge),
    );
  }

  private computeExplicitEdgePath(edge: LayoutEdge): EdgePathResult | undefined {
    if (
      (edge.geometry_version !== 1 && edge.geometry_version !== 2) ||
      !edge.source_boundary ||
      !edge.target_boundary ||
      !edge.path_end ||
      edge.final_tangent_angle === undefined ||
      !Number.isFinite(edge.final_tangent_angle)
    ) {
      return undefined;
    }

    const placement = this.edgeHasArrow(edge)
      ? computeArrowPlacement(
        edge.target_boundary,
        edge.final_tangent_angle,
        this.theme.arrowSize,
        this.theme.edgeGap,
        this.theme.arrowStyle,
        this.edgeStrokeWidth(edge),
      )
      : {
        arrowTip: edge.target_boundary,
        arrowAnchor: edge.target_boundary,
        pathEnd: edge.target_boundary,
      };

    return {
      path: this.buildExplicitPath(edge, placement.pathEnd),
      arrowTip: placement.arrowTip,
      arrowAnchor: placement.arrowAnchor,
      arrowAngle: edge.final_tangent_angle,
      pathEnd: placement.pathEnd,
    };
  }

  private buildExplicitPath(edge: LayoutEdge, pathEnd: Point): string {
    const points = [
      edge.source_boundary!,
      ...edge.waypoints.slice(1, -1),
      pathEnd,
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
        const center = edgeResult.arrowAnchor ?? edgeResult.arrowTip;
        circle.setAttribute('cx', String(center.x));
        circle.setAttribute('cy', String(center.y));
        circle.setAttribute('r', String(this.theme.arrowSize / 2));
        circle.setAttribute('fill', this.theme.colors.arrowFill);
        circle.setAttribute('stroke', this.theme.colors.edgeStroke);
        circle.setAttribute('stroke-width', '1');
        return [circle];
      }
      case 'cross': {
        const center = edgeResult.arrowAnchor ?? edgeResult.arrowTip;
        const half = this.theme.arrowSize / 2;
        const diagonalA = edgeResult.arrowAngle + Math.PI / 4;
        const diagonalB = edgeResult.arrowAngle - Math.PI / 4;
        const endpoints = (angle: number): [Point, Point] => [
          { x: center.x - Math.cos(angle) * half, y: center.y - Math.sin(angle) * half },
          { x: center.x + Math.cos(angle) * half, y: center.y + Math.sin(angle) * half },
        ];
        const [a1, a2] = endpoints(diagonalA);
        const [b1, b2] = endpoints(diagonalB);
        const crossA = this.createArrowLine(a1, a2);
        const crossB = this.createArrowLine(b1, b2);
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

  private edgeHasArrow(edge: LayoutEdge): boolean {
    return edge.style !== 'line' && edge.style !== 'invisible';
  }

  private edgeStrokeWidth(edge: LayoutEdge): number {
    return edge.style === 'thick' ? 3 : 1.5;
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

  private setTextLines(text: SVGTextElement, lines: string[], center: Point, fontSize: number): void {
    if (lines.length <= 1) {
      text.setAttribute('y', String(center.y));
      text.setAttribute('dominant-baseline', 'central');
      text.textContent = lines[0] ?? '';
      return;
    }

    const lineHeight = fontSize * 1.2;
    const firstLineY = center.y - (lines.length - 1) * lineHeight / 2;
    for (const [index, line] of lines.entries()) {
      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', String(center.x));
      tspan.setAttribute('y', String(firstLineY + index * lineHeight));
      tspan.textContent = line;
      text.appendChild(tspan);
    }
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
