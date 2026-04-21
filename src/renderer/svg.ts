import type { FlowchartAst, LayoutResult, Point, FlowchartNode, FlowchartEdge } from '../types';

const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;
const EDGE_WIDTH = 2;

interface ThemeColors {
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  edgeStroke: string;
  edgeLabel: string;
  background: string;
}

const THEMES: Record<string, ThemeColors> = {
  default: {
    nodeFill: '#fff',
    nodeStroke: '#333',
    nodeText: '#333',
    edgeStroke: '#333',
    edgeLabel: '#333',
    background: 'transparent',
  },
  dark: {
    nodeFill: '#1e1e2e',
    nodeStroke: '#cdd6f4',
    nodeText: '#cdd6f4',
    edgeStroke: '#a6adc8',
    edgeLabel: '#a6adc8',
    background: '#1e1e2e',
  },
  forest: {
    nodeFill: '#e8f5e9',
    nodeStroke: '#2e7d32',
    nodeText: '#1b5e20',
    edgeStroke: '#388e3c',
    edgeLabel: '#2e7d32',
    background: '#f1f8e9',
  },
  neutral: {
    nodeFill: '#f5f5f5',
    nodeStroke: '#666',
    nodeText: '#333',
    edgeStroke: '#666',
    edgeLabel: '#666',
    background: '#fafafa',
  },
};

export class SVGRenderer {
  private theme: ThemeColors;

  constructor(theme: string = 'default') {
    this.theme = THEMES[theme] ?? THEMES.default;
  }

  render(ast: FlowchartAst, layout: LayoutResult): SVGElement {
    const svg = this.createSvgElement(layout.dimensions);

    const defs = this.createDefs();
    svg.appendChild(defs);

    for (const edge of ast.edges) {
      const edgeElement = this.renderEdge(edge, layout.positions, ast);
      svg.appendChild(edgeElement);
    }

    for (const node of ast.nodes) {
      const pos = this.findPosition(node.id, layout.positions);
      const nodeElement = this.renderNode(node, pos);
      svg.appendChild(nodeElement);
    }

    return svg;
  }

  renderToString(ast: FlowchartAst, layout: LayoutResult): string {
    const svg = this.render(ast, layout);
    return svg.outerHTML;
  }

  private createSvgElement(dimensions: { width: number; height: number }): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(dimensions.width));
    svg.setAttribute('height', String(dimensions.height));
    svg.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
    svg.classList.add('xmermaid-diagram');
    if (this.theme.background !== 'transparent') {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', String(dimensions.width));
      rect.setAttribute('height', String(dimensions.height));
      rect.setAttribute('fill', this.theme.background);
      svg.appendChild(rect);
    }
    return svg;
  }

  private createDefs(): SVGDefsElement {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Arrowhead marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', this.theme.edgeStroke);
    marker.appendChild(polygon);
    defs.appendChild(marker);

    // Thick arrowhead marker
    const thickMarker = marker.cloneNode(true) as SVGMarkerElement;
    thickMarker.setAttribute('id', 'arrowhead-thick');
    defs.appendChild(thickMarker);

    return defs;
  }

  private findPosition(id: string, positions: [string, Point][]): Point {
    const entry = positions.find(([nodeId]) => nodeId === id);
    return entry?.[1] ?? { x: 0, y: 0 };
  }

  private renderNode(node: FlowchartNode, pos: Point): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.setAttribute('id', `node-${node.id}`);
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    const shape = this.createNodeShape(node);
    g.appendChild(shape);

    const label = this.createNodeLabel(node);
    g.appendChild(label);

    return g;
  }

  private createNodeShape(node: FlowchartNode): SVGElement {
    const hw = NODE_WIDTH / 2;
    const hh = NODE_HEIGHT / 2;

    switch (node.shape) {
      case 'rounded':
        return this.createRect(hw, hh, 15);

      case 'circle':
        return this.createEllipse(hw, hh);

      case 'double_circle': {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const outer = this.createEllipse(hw + 4, hh + 4);
        const inner = this.createEllipse(hw - 4, hh - 4);
        g.appendChild(outer);
        g.appendChild(inner);
        return g;
      }

      case 'diamond':
        return this.createPolygon([
          [0, -hh - 8], [hw + 12, 0], [0, hh + 8], [-hw - 12, 0],
        ]);

      case 'hexagon':
        return this.createPolygon([
          [-hw + 12, -hh], [hw - 12, -hh], [hw, 0],
          [hw - 12, hh], [-hw + 12, hh], [-hw, 0],
        ]);

      case 'stadium':
        return this.createRect(hw, hh, hh);

      case 'subroutine':
        return this.createSubroutineShape(hw, hh);

      case 'parallelogram':
        return this.createPolygon([
          [-hw + 16, -hh], [hw, -hh], [hw - 16, hh], [-hw, hh],
        ]);

      case 'trapezoid':
        return this.createPolygon([
          [-hw + 16, -hh], [hw - 16, -hh], [hw, hh], [-hw, hh],
        ]);

      case 'asymmetric':
        return this.createPolygon([
          [-hw, -hh], [hw - 12, -hh], [hw, 0], [hw - 12, hh], [-hw, hh],
        ]);

      case 'cylinder':
        return this.createCylinderShape(hw, hh);

      case 'rect':
      default:
        return this.createRect(hw, hh, 5);
    }
  }

  private createRect(hw: number, hh: number, rx: number): SVGRectElement {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('node-shape');
    rect.setAttribute('x', String(-hw));
    rect.setAttribute('y', String(-hh));
    rect.setAttribute('width', String(hw * 2));
    rect.setAttribute('height', String(hh * 2));
    rect.setAttribute('rx', String(rx));
    rect.setAttribute('fill', this.theme.nodeFill);
    rect.setAttribute('stroke', this.theme.nodeStroke);
    rect.setAttribute('stroke-width', '1');
    return rect;
  }

  private createEllipse(rx: number, ry: number): SVGEllipseElement {
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.classList.add('node-shape');
    ellipse.setAttribute('cx', '0');
    ellipse.setAttribute('cy', '0');
    ellipse.setAttribute('rx', String(rx));
    ellipse.setAttribute('ry', String(ry));
    ellipse.setAttribute('fill', this.theme.nodeFill);
    ellipse.setAttribute('stroke', this.theme.nodeStroke);
    ellipse.setAttribute('stroke-width', '1');
    return ellipse;
  }

  private createPolygon(points: [number, number][]): SVGPolygonElement {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.classList.add('node-shape');
    polygon.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));
    polygon.setAttribute('fill', this.theme.nodeFill);
    polygon.setAttribute('stroke', this.theme.nodeStroke);
    polygon.setAttribute('stroke-width', '1');
    return polygon;
  }

  private createSubroutineShape(hw: number, hh: number): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node-shape');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(-hw));
    rect.setAttribute('y', String(-hh));
    rect.setAttribute('width', String(hw * 2));
    rect.setAttribute('height', String(hh * 2));
    rect.setAttribute('fill', this.theme.nodeFill);
    rect.setAttribute('stroke', this.theme.nodeStroke);
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);

    // Inner vertical lines
    for (const x of [-hw + 10, hw - 10]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x));
      line.setAttribute('y1', String(-hh));
      line.setAttribute('x2', String(x));
      line.setAttribute('y2', String(hh));
      line.setAttribute('stroke', this.theme.nodeStroke);
      line.setAttribute('stroke-width', '1');
      g.appendChild(line);
    }

    return g;
  }

  private createCylinderShape(hw: number, hh: number): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node-shape');

    const ry = 8;

    // Body
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(-hw));
    rect.setAttribute('y', String(-hh + ry));
    rect.setAttribute('width', String(hw * 2));
    rect.setAttribute('height', String(hh * 2 - ry));
    rect.setAttribute('fill', this.theme.nodeFill);
    rect.setAttribute('stroke', 'none');
    g.appendChild(rect);

    // Bottom ellipse
    const bottom = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    bottom.setAttribute('cx', '0');
    bottom.setAttribute('cy', String(hh));
    bottom.setAttribute('rx', String(hw));
    bottom.setAttribute('ry', String(ry));
    bottom.setAttribute('fill', this.theme.nodeFill);
    bottom.setAttribute('stroke', this.theme.nodeStroke);
    bottom.setAttribute('stroke-width', '1');
    g.appendChild(bottom);

    // Top ellipse
    const top = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    top.setAttribute('cx', '0');
    top.setAttribute('cy', String(-hh + ry));
    top.setAttribute('rx', String(hw));
    top.setAttribute('ry', String(ry));
    top.setAttribute('fill', this.theme.nodeFill);
    top.setAttribute('stroke', this.theme.nodeStroke);
    top.setAttribute('stroke-width', '1');
    g.appendChild(top);

    // Side lines
    for (const x of [-hw, hw]) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x));
      line.setAttribute('y1', String(-hh + ry));
      line.setAttribute('x2', String(x));
      line.setAttribute('y2', String(hh));
      line.setAttribute('stroke', this.theme.nodeStroke);
      line.setAttribute('stroke-width', '1');
      g.appendChild(line);
    }

    return g;
  }

  private createNodeLabel(node: FlowchartNode): SVGTextElement {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('node-label');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', this.theme.nodeText);
    text.setAttribute('font-size', '14');
    text.setAttribute('font-family', 'sans-serif');
    text.textContent = node.label ?? node.id;
    return text;
  }

  private renderEdge(edge: FlowchartEdge, positions: [string, Point][], ast: FlowchartAst): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edge');
    g.setAttribute('id', `edge-${edge.from}-${edge.to}`);

    const fromPos = this.findPosition(edge.from, positions);
    const toPos = this.findPosition(edge.to, positions);

    const start = this.getEdgeStart(fromPos, toPos);
    const end = this.getEdgeEnd(toPos, fromPos);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('edge-path');

    // Orthogonal routing for non-straight edges
    const d = this.buildEdgePath(start, end, fromPos, toPos);
    path.setAttribute('d', d);
    path.setAttribute('stroke', this.theme.edgeStroke);
    path.setAttribute('stroke-width', String(EDGE_WIDTH));
    path.setAttribute('fill', 'none');

    if (edge.style === 'arrow' || edge.style === 'thick') {
      path.setAttribute('marker-end', edge.style === 'thick' ? 'url(#arrowhead-thick)' : 'url(#arrowhead)');
    }

    if (edge.style === 'dotted') {
      path.setAttribute('stroke-dasharray', '5,3');
    }

    if (edge.style === 'thick') {
      path.setAttribute('stroke-width', '4');
    }

    if (edge.style === 'invisible') {
      path.setAttribute('stroke', 'none');
      path.setAttribute('fill', 'none');
    }

    g.appendChild(path);

    if (edge.label) {
      const labelEl = this.createEdgeLabel(edge.label, start, end);
      g.appendChild(labelEl);
    }

    return g;
  }

  private buildEdgePath(start: Point, end: Point, from: Point, to: Point): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // If roughly horizontal or vertical, use straight line
    if (Math.abs(dx) < 5 || Math.abs(dy) < 5) {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    // Orthogonal routing: L-shaped path
    // Prefer routing along the dominant direction
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant: go horizontal then vertical
      const midX = end.x;
      return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${end.x} ${end.y}`;
    } else {
      // Vertical dominant: go vertical then horizontal
      const midY = end.y;
      return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${end.y}`;
    }
  }

  private getEdgeStart(from: Point, to: Point): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const offset = NODE_HEIGHT / 2 + 5;
    return {
      x: from.x + (dx / dist) * offset,
      y: from.y + (dy / dist) * offset,
    };
  }

  private getEdgeEnd(to: Point, from: Point): Point {
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const offset = NODE_HEIGHT / 2 + 5;
    return {
      x: to.x + (dx / dist) * offset,
      y: to.y + (dy / dist) * offset,
    };
  }

  private createEdgeLabel(label: string, start: Point, end: Point): SVGTextElement {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('edge-label');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('x', String((start.x + end.x) / 2));
    text.setAttribute('y', String((start.y + end.y) / 2 - 10));
    text.setAttribute('fill', this.theme.edgeLabel);
    text.setAttribute('font-size', '12');
    text.setAttribute('font-family', 'sans-serif');
    text.textContent = label;
    return text;
  }
}
