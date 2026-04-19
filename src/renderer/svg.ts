import type { FlowchartAst, LayoutResult, Point, Node, Edge } from '../types';

const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;
const EDGE_WIDTH = 2;

export class SVGRenderer {
  render(ast: FlowchartAst, layout: LayoutResult): SVGElement {
    const svg = this.createSvgElement(layout.dimensions);

    // Add arrowhead marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', '#333');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Render edges first (so nodes appear on top)
    for (const edge of ast.edges) {
      const edgeElement = this.renderEdge(edge, layout.positions);
      svg.appendChild(edgeElement);
    }

    // Render nodes
    for (const node of ast.nodes) {
      const pos = this.findPosition(node.id, layout.positions);
      const nodeElement = this.renderNode(node, pos);
      svg.appendChild(nodeElement);
    }

    return svg;
  }

  private createSvgElement(dimensions: { width: number; height: number }): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(dimensions.width));
    svg.setAttribute('height', String(dimensions.height));
    svg.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
    svg.classList.add('xmermaid-diagram');
    return svg;
  }

  private findPosition(id: string, positions: [string, Point][]): Point {
    const entry = positions.find(([nodeId]) => nodeId === id);
    return entry?.[1] ?? { x: 0, y: 0 };
  }

  private renderNode(node: Node, pos: Point): SVGGElement {
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

  private createNodeShape(node: Node): SVGElement {
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    shape.classList.add('node-shape');
    shape.setAttribute('x', String(-NODE_WIDTH / 2));
    shape.setAttribute('y', String(-NODE_HEIGHT / 2));
    shape.setAttribute('width', String(NODE_WIDTH));
    shape.setAttribute('height', String(NODE_HEIGHT));
    shape.setAttribute('rx', '5');
    shape.setAttribute('fill', '#fff');
    shape.setAttribute('stroke', '#333');
    shape.setAttribute('stroke-width', '1');

    if (node.shape === 'rounded') {
      shape.setAttribute('rx', '15');
    } else if (node.shape === 'circle') {
      shape.setAttribute('rx', String(NODE_HEIGHT / 2));
      shape.setAttribute('ry', String(NODE_HEIGHT / 2));
    }

    return shape;
  }

  private createNodeLabel(node: Node): SVGTextElement {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('node-label');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#333');
    text.textContent = node.label ?? node.id;
    return text;
  }

  private renderEdge(edge: Edge, positions: [string, Point][]): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('edge');
    g.setAttribute('id', `edge-${edge.from}-${edge.to}`);

    const fromPos = this.findPosition(edge.from, positions);
    const toPos = this.findPosition(edge.to, positions);

    const start = this.getEdgeStart(fromPos, toPos);
    const end = this.getEdgeEnd(toPos, fromPos);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('edge-path');
    path.setAttribute('d', `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
    path.setAttribute('stroke', '#333');
    path.setAttribute('stroke-width', String(EDGE_WIDTH));
    path.setAttribute('fill', 'none');

    if (edge.style === 'arrow' || edge.style === 'thick') {
      path.setAttribute('marker-end', 'url(#arrowhead)');
    }

    if (edge.style === 'dotted') {
      path.setAttribute('stroke-dasharray', '5,3');
    }

    if (edge.style === 'thick') {
      path.setAttribute('stroke-width', '4');
    }

    g.appendChild(path);

    if (edge.label) {
      const labelEl = this.createEdgeLabel(edge.label, start, end);
      g.appendChild(labelEl);
    }

    return g;
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
    text.setAttribute('fill', '#333');
    text.textContent = label;
    return text;
  }
}
