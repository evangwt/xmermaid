import type { LayoutResult, LayoutNode, LayoutEdge, Point } from '../types/layout';
import type { ArrowStyle, RenderTheme } from '../types/theme';
import { DEFAULT_THEME } from '../types/theme';
import {
  computeArrowPlacement,
  computeEdgePath,
  computeArrowPoints,
  terminalAngleAtTargetBoundary,
  type EdgePathResult,
} from './edge';
import { parseFontAwesomeLabel, type FontAwesomeLabel } from './fontawesome';

function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function isHexColor(value: string | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value);
}

function flowAxisBoundary(bounds: LayoutNode['bounds'], angle: number, end: 'source' | 'target'): Point {
  const vertical = Math.abs(Math.sin(angle)) >= Math.abs(Math.cos(angle));
  const forward = vertical ? Math.sin(angle) >= 0 : Math.cos(angle) >= 0;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  if (vertical) {
    const sourceY = forward ? bounds.y + bounds.height : bounds.y;
    const targetY = forward ? bounds.y : bounds.y + bounds.height;
    return { x: centerX, y: end === 'source' ? sourceY : targetY };
  }

  const sourceX = forward ? bounds.x + bounds.width : bounds.x;
  const targetX = forward ? bounds.x : bounds.x + bounds.width;
  return { x: end === 'source' ? sourceX : targetX, y: centerY };
}

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
    if (layout.quadrant_chart) {
      this.renderQuadrantChart(svg, layout);
      return svg;
    }
    if (layout.block_diagram) {
      this.renderBlockDiagram(svg, layout);
      return svg;
    }
    if (layout.kanban_board) {
      this.renderKanbanBoard(svg, layout);
      return svg;
    }
    if (layout.treemap) {
      this.renderTreemap(svg, layout);
      return svg;
    }
    if (layout.radar) {
      this.renderRadar(svg, layout);
      return svg;
    }
    if (layout.packet) {
      this.renderPacket(svg, layout);
      return svg;
    }
    if (layout.venn) {
      this.renderVenn(svg, layout);
      return svg;
    }
    if (layout.cynefin) {
      this.renderCynefin(svg, layout);
      return svg;
    }
    if (layout.ishikawa) {
      this.renderIshikawa(svg, layout);
      return svg;
    }
    if (layout.wardley) {
      this.renderWardley(svg, layout);
      return svg;
    }
    if (layout.sequence) {
      this.renderSequence(svg, layout);
      return svg;
    }
    if (layout.swimlanes) this.renderSwimlanes(svg, layout);

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

  private renderQuadrantChart(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.quadrant_chart!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('quadrant-chart');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = chart.title || 'Quadrant chart';
    group.appendChild(title);
    const halfWidth = chart.plot.width / 2;
    const halfHeight = chart.plot.height / 2;
    const cells = [
      { x: chart.plot.x + halfWidth, y: chart.plot.y, label: chart.quadrants[0], opacity: '.34' },
      { x: chart.plot.x, y: chart.plot.y, label: chart.quadrants[1], opacity: '.26' },
      { x: chart.plot.x, y: chart.plot.y + halfHeight, label: chart.quadrants[2], opacity: '.18' },
      { x: chart.plot.x + halfWidth, y: chart.plot.y + halfHeight, label: chart.quadrants[3], opacity: '.22' },
    ];
    for (const cell of cells) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('quadrant-cell');
      rect.setAttribute('x', String(cell.x));
      rect.setAttribute('y', String(cell.y));
      rect.setAttribute('width', String(halfWidth));
      rect.setAttribute('height', String(halfHeight));
      rect.setAttribute('fill', this.theme.colors.subgraphFill);
      rect.setAttribute('fill-opacity', cell.opacity);
      group.appendChild(rect);
      if (cell.label) this.appendQuadrantText(group, cell.label, cell.x + 12, cell.y + 22, 'start', this.theme.colors.edgeLabel, Math.max(10, this.theme.fontSize - 2));
    }
    const addAxis = (x1: number, y1: number, x2: number, y2: number) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('quadrant-axis');
      line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', this.theme.colors.subgraphStroke);
      line.setAttribute('stroke-width', '1.5');
      group.appendChild(line);
    };
    addAxis(chart.plot.x + halfWidth, chart.plot.y, chart.plot.x + halfWidth, chart.plot.y + chart.plot.height);
    addAxis(chart.plot.x, chart.plot.y + halfHeight, chart.plot.x + chart.plot.width, chart.plot.y + halfHeight);
    if (chart.title) this.appendQuadrantText(group, chart.title, chart.plot.x, chart.plot.y - 24, 'start', this.theme.colors.nodeText, this.theme.fontSize + 2);
    if (chart.x_axis) {
      this.appendQuadrantText(group, chart.x_axis[0], chart.plot.x, chart.plot.y + chart.plot.height + 22, 'start', this.theme.colors.nodeText, Math.max(10, this.theme.fontSize - 2));
      this.appendQuadrantText(group, chart.x_axis[1], chart.plot.x + chart.plot.width, chart.plot.y + chart.plot.height + 22, 'end', this.theme.colors.nodeText, Math.max(10, this.theme.fontSize - 2));
    }
    if (chart.y_axis) {
      this.appendQuadrantText(group, chart.y_axis[0], chart.plot.x - 12, chart.plot.y + chart.plot.height, 'end', this.theme.colors.nodeText, Math.max(10, this.theme.fontSize - 2));
      this.appendQuadrantText(group, chart.y_axis[1], chart.plot.x - 12, chart.plot.y + 10, 'end', this.theme.colors.nodeText, Math.max(10, this.theme.fontSize - 2));
    }
    for (const point of chart.points) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.classList.add('quadrant-point');
      circle.setAttribute('cx', String(point.center.x));
      circle.setAttribute('cy', String(point.center.y));
      circle.setAttribute('r', '5.5');
      circle.setAttribute('fill', this.theme.colors.arrowFill);
      circle.setAttribute('stroke', this.theme.colors.background);
      circle.setAttribute('stroke-width', '2');
      const description = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      description.textContent = point.label;
      circle.appendChild(description);
      group.appendChild(circle);
      this.appendQuadrantText(group, point.label, point.center.x + 8, point.center.y - 8, 'start', this.theme.colors.nodeText, Math.max(10, this.theme.fontSize - 2), 'quadrant-point-label');
    }
    svg.appendChild(group);
  }

  private appendQuadrantText(group: SVGGElement, value: string, x: number, y: number, anchor: string, fill: string, size: number, className?: string): void {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    if (className) text.classList.add(className);
    text.setAttribute('x', String(x)); text.setAttribute('y', String(y)); text.setAttribute('text-anchor', anchor);
    text.setAttribute('fill', fill); text.setAttribute('font-family', this.theme.fontFamily); text.setAttribute('font-size', String(size));
    text.textContent = value;
    group.appendChild(text);
  }

  private renderBlockDiagram(svg: SVGSVGElement, layout: LayoutResult): void {
    const diagram = layout.block_diagram!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('block-diagram');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `Block diagram with ${diagram.columns} columns`;
    group.appendChild(title);
    const nodes = diagram.blocks.map<LayoutNode>(block => ({
      id: block.id,
      label: block.label,
      label_lines: [block.label],
      center: { x: block.bounds.x + block.bounds.width / 2, y: block.bounds.y + block.bounds.height / 2 },
      bounds: block.bounds,
      shape: 'RoundedRect',
    }));
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    for (const edge of layout.edges) {
      const rendered = this.renderEdge(edge, nodeMap);
      rendered.classList.add('block-relationship');
      group.appendChild(rendered);
    }
    for (const node of nodes) {
      const rendered = this.renderNode(node);
      rendered.classList.add('block-node');
      group.appendChild(rendered);
    }
    svg.appendChild(group);
  }

  private renderKanbanBoard(svg: SVGSVGElement, layout: LayoutResult): void {
    const board = layout.kanban_board!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('kanban-board');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `Kanban board with ${board.columns.length} columns`;
    group.appendChild(title);
    for (const column of board.columns) {
      const columnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      columnGroup.classList.add('kanban-column');
      const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      header.classList.add('kanban-header');
      header.setAttribute('x', String(column.header.x));
      header.setAttribute('y', String(column.header.y));
      header.setAttribute('width', String(column.header.width));
      header.setAttribute('height', String(column.header.height));
      header.setAttribute('rx', String(Math.max(6, this.theme.nodeBorderRadius)));
      header.setAttribute('fill', this.theme.colors.nodeStroke);
      header.setAttribute('fill-opacity', '.8');
      columnGroup.appendChild(header);
      this.appendKanbanText(columnGroup, column.label, column.header, this.theme.colors.background, this.theme.fontSize, 'kanban-column-label');
      for (const task of column.tasks) {
        const card = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        card.classList.add('kanban-task');
        card.setAttribute('x', String(task.bounds.x));
        card.setAttribute('y', String(task.bounds.y));
        card.setAttribute('width', String(task.bounds.width));
        card.setAttribute('height', String(task.bounds.height));
        card.setAttribute('rx', String(Math.max(6, this.theme.nodeBorderRadius)));
        card.setAttribute('fill', this.theme.colors.nodeFill);
        card.setAttribute('stroke', this.theme.colors.nodeStroke);
        card.setAttribute('stroke-width', '1.5');
        const taskTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        taskTitle.textContent = task.label;
        card.appendChild(taskTitle);
        columnGroup.appendChild(card);
        this.appendKanbanText(columnGroup, task.label, task.bounds, this.theme.colors.nodeText, this.theme.fontSize - 1, 'kanban-task-label');
      }
      group.appendChild(columnGroup);
    }
    svg.appendChild(group);
  }

  private renderTreemap(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.treemap!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('treemap');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Treemap';
    group.appendChild(title);
    const leafPalette = [
      this.theme.colors.nodeFill,
      this.theme.colors.subgraphFill,
      this.theme.colors.arrowFill,
      this.theme.colors.nodeStroke,
      this.theme.colors.edgeStroke,
    ];
    let leafIndex = 0;

    for (const node of chart.nodes) {
      const cell = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      cell.classList.add(node.is_leaf ? 'treemap-leaf' : 'treemap-group');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(node.bounds.x));
      rect.setAttribute('y', String(node.bounds.y));
      rect.setAttribute('width', String(node.bounds.width));
      rect.setAttribute('height', String(node.bounds.height));
      rect.setAttribute('rx', String(node.is_leaf ? Math.min(this.theme.nodeBorderRadius, 6) : 5));
      rect.setAttribute('stroke', this.theme.colors.nodeStroke);
      rect.setAttribute('stroke-width', node.is_leaf ? '1.25' : '1.5');
      if (node.is_leaf) {
        rect.setAttribute('fill', leafPalette[leafIndex % leafPalette.length]!);
        rect.setAttribute('fill-opacity', '.84');
        leafIndex += 1;
      } else {
        rect.setAttribute('fill', this.theme.colors.subgraphFill);
        rect.setAttribute('fill-opacity', '.18');
      }
      const description = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      description.textContent = `${node.label}: ${node.value}`;
      rect.appendChild(description);
      cell.appendChild(rect);
      if (node.bounds.width >= 56 && node.bounds.height >= 28) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.classList.add(node.is_leaf ? 'treemap-leaf-label' : 'treemap-group-label');
        text.setAttribute('x', String(node.bounds.x + 8));
        text.setAttribute('y', String(node.bounds.y + (node.is_leaf ? 19 : 16)));
        text.setAttribute('fill', node.is_leaf ? this.theme.colors.nodeText : this.theme.colors.edgeLabel);
        text.setAttribute('font-family', this.theme.fontFamily);
        text.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - (node.is_leaf ? 1 : 2))));
        text.setAttribute('font-weight', node.is_leaf ? '600' : '700');
        text.textContent = node.is_leaf ? `${node.label} · ${node.value}` : node.label;
        cell.appendChild(text);
      }
      group.appendChild(cell);
    }
    svg.appendChild(group);
  }

  private renderRadar(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.radar!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('radar');
    const accessibleTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    accessibleTitle.textContent = chart.title || 'Radar chart';
    group.appendChild(accessibleTitle);
    const point = (x: number, y: number) => `${x},${y}`;

    for (const scale of [.25, .5, .75, 1]) {
      const grid = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      grid.classList.add('radar-grid');
      grid.setAttribute('points', chart.axes.map(axis => point(
        chart.center.x + (axis.end.x - chart.center.x) * scale,
        chart.center.y + (axis.end.y - chart.center.y) * scale,
      )).join(' '));
      grid.setAttribute('fill', 'none');
      grid.setAttribute('stroke', this.theme.colors.edgeStroke);
      grid.setAttribute('stroke-opacity', scale === 1 ? '.72' : '.32');
      grid.setAttribute('stroke-width', scale === 1 ? '1.4' : '1');
      group.appendChild(grid);
    }

    for (const axis of chart.axes) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('radar-axis');
      line.setAttribute('x1', String(chart.center.x));
      line.setAttribute('y1', String(chart.center.y));
      line.setAttribute('x2', String(axis.end.x));
      line.setAttribute('y2', String(axis.end.y));
      line.setAttribute('stroke', this.theme.colors.edgeStroke);
      line.setAttribute('stroke-opacity', '.54');
      line.setAttribute('stroke-width', '1');
      group.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.classList.add('radar-axis-label');
      label.textContent = axis.label;
      label.setAttribute('x', String(axis.label_position.x));
      label.setAttribute('y', String(axis.label_position.y));
      label.setAttribute('text-anchor', Math.abs(axis.label_position.x - chart.center.x) < 8 ? 'middle' : axis.label_position.x > chart.center.x ? 'start' : 'end');
      label.setAttribute('dominant-baseline', axis.label_position.y > chart.center.y + 8 ? 'hanging' : axis.label_position.y < chart.center.y - 8 ? 'auto' : 'middle');
      label.setAttribute('fill', this.theme.colors.nodeText);
      label.setAttribute('font-family', this.theme.fontFamily);
      label.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 1)));
      label.setAttribute('font-weight', '600');
      group.appendChild(label);
    }

    const palette = ['#8b5cf6', '#38bdf8', '#f472b6', '#fbbf24', '#34d399', '#fb7185'];
    chart.curves.forEach((curve, index) => {
      const curveGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      curveGroup.classList.add('radar-curve');
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', curve.points.map(value => point(value.x, value.y)).join(' '));
      polygon.setAttribute('fill', palette[index % palette.length]!);
      polygon.setAttribute('fill-opacity', '.2');
      polygon.setAttribute('stroke', palette[index % palette.length]!);
      polygon.setAttribute('stroke-width', '2.25');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.classList.add('radar-curve-title');
      title.textContent = curve.label;
      polygon.appendChild(title);
      curveGroup.appendChild(polygon);
      for (const value of curve.points) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.classList.add('radar-point');
        dot.setAttribute('cx', String(value.x));
        dot.setAttribute('cy', String(value.y));
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', palette[index % palette.length]!);
        curveGroup.appendChild(dot);
      }
      group.appendChild(curveGroup);
    });

    if (chart.title) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.classList.add('radar-title');
      title.textContent = chart.title;
      title.setAttribute('x', String(chart.center.x));
      title.setAttribute('y', String(Math.max(28, chart.center.y - chart.radius - 48)));
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('fill', this.theme.colors.nodeText);
      title.setAttribute('font-family', this.theme.fontFamily);
      title.setAttribute('font-size', String(this.theme.fontSize + 3));
      title.setAttribute('font-weight', '700');
      group.appendChild(title);
    }
    svg.appendChild(group);
  }

  private renderPacket(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.packet!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('packet');
    const accessibleTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    accessibleTitle.textContent = chart.title || 'Packet diagram';
    group.appendChild(accessibleTitle);

    if (chart.title) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.classList.add('packet-title');
      title.textContent = chart.title;
      title.setAttribute('x', String(layout.dimensions.width / 2));
      title.setAttribute('y', '56');
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('fill', this.theme.colors.nodeText);
      title.setAttribute('font-family', this.theme.fontFamily);
      title.setAttribute('font-size', String(this.theme.fontSize + 3));
      title.setAttribute('font-weight', '700');
      group.appendChild(title);
    }

    const palette = [this.theme.colors.nodeFill, this.theme.colors.subgraphFill, this.theme.colors.arrowFill, this.theme.colors.nodeStroke];
    chart.fields.forEach((field, fieldIndex) => {
      const fieldGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      fieldGroup.classList.add('packet-field');
      field.segments.forEach((bounds, segmentIndex) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.classList.add('packet-segment');
        rect.setAttribute('x', String(bounds.x));
        rect.setAttribute('y', String(bounds.y));
        rect.setAttribute('width', String(bounds.width));
        rect.setAttribute('height', String(bounds.height));
        rect.setAttribute('rx', String(Math.min(this.theme.nodeBorderRadius, 5)));
        rect.setAttribute('fill', palette[fieldIndex % palette.length]!);
        rect.setAttribute('fill-opacity', '.82');
        rect.setAttribute('stroke', this.theme.colors.nodeStroke);
        rect.setAttribute('stroke-width', '1.25');
        const description = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        description.textContent = `${field.start}-${field.end}: ${field.label}`;
        rect.appendChild(description);
        fieldGroup.appendChild(rect);

        if (segmentIndex === 0 && bounds.width >= 54) {
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.classList.add('packet-field-label');
          label.textContent = field.label;
          label.setAttribute('x', String(bounds.x + bounds.width / 2));
          label.setAttribute('y', String(bounds.y + bounds.height / 2));
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'middle');
          label.setAttribute('fill', this.theme.colors.nodeText);
          label.setAttribute('font-family', this.theme.fontFamily);
          label.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 1)));
          label.setAttribute('font-weight', '600');
          fieldGroup.appendChild(label);
        }
      });
      group.appendChild(fieldGroup);
    });
    svg.appendChild(group);
  }

  private renderVenn(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.venn!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g'); group.classList.add('venn');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = chart.title || 'Venn diagram'; group.appendChild(title);
    const palette = ['#8b5cf6', '#38bdf8', '#f472b6', '#fbbf24'];
    chart.sets.forEach((set, index) => {
      const setGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g'); setGroup.classList.add('venn-set');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', String(set.center.x)); circle.setAttribute('cy', String(set.center.y)); circle.setAttribute('r', String(set.radius)); circle.setAttribute('fill', palette[index % palette.length]!); circle.setAttribute('fill-opacity', '.25'); circle.setAttribute('stroke', palette[index % palette.length]!); circle.setAttribute('stroke-width', '2'); setGroup.appendChild(circle);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.classList.add('venn-set-label'); label.textContent = set.label; label.setAttribute('x', String(set.center.x)); label.setAttribute('y', String(set.center.y - set.radius * .58)); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', this.theme.colors.nodeText); label.setAttribute('font-family', this.theme.fontFamily); label.setAttribute('font-size', String(this.theme.fontSize)); label.setAttribute('font-weight', '700'); setGroup.appendChild(label); group.appendChild(setGroup);
    });
    chart.unions.forEach(union => { const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.classList.add('venn-union-label'); label.textContent = union.label; label.setAttribute('x', String(union.position.x)); label.setAttribute('y', String(union.position.y)); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle'); label.setAttribute('fill', this.theme.colors.nodeText); label.setAttribute('font-family', this.theme.fontFamily); label.setAttribute('font-size', String(this.theme.fontSize + 1)); label.setAttribute('font-weight', '700'); group.appendChild(label); });
    if (chart.title) { const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.classList.add('venn-title'); text.textContent = chart.title; text.setAttribute('x', String(layout.dimensions.width / 2)); text.setAttribute('y', '58'); text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', this.theme.colors.nodeText); text.setAttribute('font-family', this.theme.fontFamily); text.setAttribute('font-size', String(this.theme.fontSize + 3)); text.setAttribute('font-weight', '700'); group.appendChild(text); }
    svg.appendChild(group);
  }

  private renderCynefin(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.cynefin!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('cynefin');
    const accessibleTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    accessibleTitle.textContent = chart.title || 'Cynefin framework';
    group.appendChild(accessibleTitle);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'cynefin-arrow'); marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto');
    const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); markerPath.setAttribute('fill', this.theme.colors.edgeStroke);
    marker.appendChild(markerPath); defs.appendChild(marker); group.appendChild(defs);

    const domains = new Map(chart.domains.map(domain => [domain.id, domain]));
    const text = (value: string, x: number, y: number, className: string, size: number, weight = '500') => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      element.classList.add(className); element.textContent = value;
      element.setAttribute('x', String(x)); element.setAttribute('y', String(y)); element.setAttribute('text-anchor', 'middle');
      element.setAttribute('fill', this.theme.colors.nodeText); element.setAttribute('font-family', this.theme.fontFamily);
      element.setAttribute('font-size', String(size)); element.setAttribute('font-weight', weight);
      group.appendChild(element);
    };

    for (const domain of chart.domains) {
      const element = document.createElementNS('http://www.w3.org/2000/svg', domain.id === 'confusion' ? 'ellipse' : 'rect');
      element.classList.add('cynefin-domain');
      if (domain.id === 'confusion') element.classList.add('cynefin-confusion');
      if (domain.id === 'confusion') {
        element.setAttribute('cx', String(domain.bounds.x + domain.bounds.width / 2)); element.setAttribute('cy', String(domain.bounds.y + domain.bounds.height / 2));
        element.setAttribute('rx', String(domain.bounds.width / 2)); element.setAttribute('ry', String(domain.bounds.height / 2));
      } else {
        element.setAttribute('x', String(domain.bounds.x)); element.setAttribute('y', String(domain.bounds.y));
        element.setAttribute('width', String(domain.bounds.width)); element.setAttribute('height', String(domain.bounds.height)); element.setAttribute('rx', '18');
      }
      element.setAttribute('fill', this.theme.colors.subgraphFill); element.setAttribute('fill-opacity', domain.id === 'confusion' ? '.88' : '.42');
      element.setAttribute('stroke', this.theme.colors.subgraphStroke); element.setAttribute('stroke-width', domain.id === 'confusion' ? '2' : '1.25');
      group.appendChild(element);
      text(domain.label, domain.bounds.x + domain.bounds.width / 2, domain.bounds.y + 31, 'cynefin-domain-label', Math.max(11, this.theme.fontSize - 1), '700');
    }

    for (const transition of chart.transitions) {
      const from = domains.get(transition.from); const to = domains.get(transition.to);
      if (!from || !to) continue;
      const start = { x: from.bounds.x + from.bounds.width / 2, y: from.bounds.y + from.bounds.height / 2 };
      const end = { x: to.bounds.x + to.bounds.width / 2, y: to.bounds.y + to.bounds.height / 2 };
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path'); line.classList.add('cynefin-transition');
      line.setAttribute('d', `M ${start.x} ${start.y} L ${end.x} ${end.y}`); line.setAttribute('fill', 'none'); line.setAttribute('stroke', this.theme.colors.edgeStroke); line.setAttribute('stroke-opacity', '.68'); line.setAttribute('stroke-width', '1.5'); line.setAttribute('marker-end', 'url(#cynefin-arrow)'); group.appendChild(line);
      if (transition.label) text(transition.label, (start.x + end.x) / 2, (start.y + end.y) / 2 - 6, 'cynefin-transition-label', Math.max(10, this.theme.fontSize - 3));
    }

    for (const domain of chart.domains) {
      for (const [index, item] of domain.items.entries()) {
        const itemGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g'); itemGroup.classList.add('cynefin-item');
        const center = domain.id === 'confusion'
          ? { x: domain.bounds.x + domain.bounds.width / 2, y: domain.bounds.y + 31 + Math.min(index, 2) * 24 }
          : { x: domain.bounds.x + domain.bounds.width / 2, y: domain.bounds.y + 62 + index * 34 };
        const width = Math.min(domain.bounds.width - 36, Math.max(108, this.measureText(item.label, this.theme.fontSize - 2) + 26));
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(center.x - width / 2)); rect.setAttribute('y', String(center.y - 13)); rect.setAttribute('width', String(width)); rect.setAttribute('height', '26'); rect.setAttribute('rx', '8');
        rect.setAttribute('fill', this.theme.colors.nodeFill); rect.setAttribute('stroke', this.theme.colors.nodeStroke); rect.setAttribute('stroke-width', '1'); itemGroup.appendChild(rect);
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.textContent = item.label;
        label.setAttribute('x', String(center.x)); label.setAttribute('y', String(center.y + 4)); label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', this.theme.colors.nodeText); label.setAttribute('font-family', this.theme.fontFamily); label.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 2))); itemGroup.appendChild(label);
        group.appendChild(itemGroup);
      }
    }
    if (chart.title) text(chart.title, layout.dimensions.width / 2, 42, 'cynefin-title', this.theme.fontSize + 5, '700');
    svg.appendChild(group);
  }

  private renderIshikawa(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.ishikawa!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('ishikawa');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `Ishikawa: ${chart.effect}`;
    group.appendChild(title);

    const spine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    spine.classList.add('ishikawa-spine');
    spine.setAttribute('x1', String(chart.spine_start.x)); spine.setAttribute('y1', String(chart.spine_start.y));
    spine.setAttribute('x2', String(chart.spine_end.x)); spine.setAttribute('y2', String(chart.spine_end.y));
    spine.setAttribute('stroke', this.theme.colors.edgeStroke); spine.setAttribute('stroke-width', '2.5');
    group.appendChild(spine);

    for (const cause of chart.causes) {
      const causeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      causeGroup.classList.add('ishikawa-cause');
      const branch = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      branch.classList.add('ishikawa-branch');
      branch.setAttribute('x1', String(cause.branch_anchor.x)); branch.setAttribute('y1', String(cause.branch_anchor.y));
      branch.setAttribute('x2', String(cause.position.x)); branch.setAttribute('y2', String(cause.position.y));
      branch.setAttribute('stroke', this.theme.colors.edgeStroke); branch.setAttribute('stroke-width', cause.depth ? '1.25' : '1.8');
      causeGroup.appendChild(branch);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.classList.add('ishikawa-cause-label'); label.textContent = cause.label;
      label.setAttribute('x', String(cause.position.x - 7));
      label.setAttribute('y', String(cause.position.y + (cause.position.y < chart.spine_start.y ? -5 : 15)));
      label.setAttribute('text-anchor', 'end'); label.setAttribute('fill', this.theme.colors.nodeText);
      label.setAttribute('font-family', this.theme.fontFamily); label.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - cause.depth)));
      label.setAttribute('font-weight', cause.depth ? '500' : '700');
      causeGroup.appendChild(label); group.appendChild(causeGroup);
    }

    const effect = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    effect.classList.add('ishikawa-effect');
    const bounds = chart.effect_bounds;
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    box.setAttribute('x', String(bounds.x)); box.setAttribute('y', String(bounds.y));
    box.setAttribute('width', String(bounds.width)); box.setAttribute('height', String(bounds.height));
    box.setAttribute('rx', String(Math.max(8, this.theme.nodeBorderRadius)));
    box.setAttribute('fill', this.theme.colors.nodeFill); box.setAttribute('stroke', this.theme.colors.nodeStroke); box.setAttribute('stroke-width', '2');
    effect.appendChild(box);
    const effectLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    effectLabel.textContent = chart.effect; effectLabel.setAttribute('x', String(bounds.x + bounds.width / 2));
    effectLabel.setAttribute('y', String(bounds.y + bounds.height / 2)); effectLabel.setAttribute('text-anchor', 'middle');
    effectLabel.setAttribute('dominant-baseline', 'middle'); effectLabel.setAttribute('fill', this.theme.colors.nodeText);
    effectLabel.setAttribute('font-family', this.theme.fontFamily); effectLabel.setAttribute('font-size', String(this.theme.fontSize)); effectLabel.setAttribute('font-weight', '700');
    effect.appendChild(effectLabel); group.appendChild(effect);
    svg.appendChild(group);
  }

  private renderWardley(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.wardley!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('wardley');
    const accessibleTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    accessibleTitle.textContent = chart.title || 'Wardley map';
    group.appendChild(accessibleTitle);

    const plot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    plot.classList.add('wardley-plot');
    plot.setAttribute('x', String(chart.plot.x)); plot.setAttribute('y', String(chart.plot.y));
    plot.setAttribute('width', String(chart.plot.width)); plot.setAttribute('height', String(chart.plot.height));
    plot.setAttribute('fill', this.theme.colors.subgraphFill); plot.setAttribute('fill-opacity', '.18');
    plot.setAttribute('stroke', this.theme.colors.subgraphStroke); plot.setAttribute('stroke-width', '1.25');
    group.appendChild(plot);

    for (let step = 1; step < 4; step++) {
      const x = chart.plot.x + chart.plot.width * step / 4;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('wardley-evolution-grid');
      line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x));
      line.setAttribute('y1', String(chart.plot.y)); line.setAttribute('y2', String(chart.plot.y + chart.plot.height));
      line.setAttribute('stroke', this.theme.colors.edgeStroke); line.setAttribute('stroke-opacity', '.23'); line.setAttribute('stroke-dasharray', '4 6');
      group.appendChild(line);
    }
    for (const [label, fraction] of [['Genesis', .125], ['Custom', .375], ['Product', .625], ['Commodity', .875]] as const) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.classList.add('wardley-evolution-label'); text.textContent = label;
      text.setAttribute('x', String(chart.plot.x + chart.plot.width * fraction)); text.setAttribute('y', String(chart.plot.y + chart.plot.height + 24));
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', this.theme.colors.edgeLabel);
      text.setAttribute('font-family', this.theme.fontFamily); text.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 2)));
      group.appendChild(text);
    }

    const componentMap = new Map(chart.components.map(component => [component.id, component]));
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'wardley-arrow'); marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6'); marker.setAttribute('orient', 'auto-start-reverse');
    const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); markerPath.setAttribute('fill', this.theme.colors.edgeStroke); marker.appendChild(markerPath); defs.appendChild(marker); group.appendChild(defs);
    for (const dependency of chart.dependencies) {
      const from = componentMap.get(dependency.from); const to = componentMap.get(dependency.to);
      if (!from || !to) continue;
      const source = this.wardleyBoundary(from, to.center);
      const target = this.wardleyBoundary(to, from.center);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.classList.add('wardley-dependency');
      line.setAttribute('x1', String(source.x)); line.setAttribute('y1', String(source.y)); line.setAttribute('x2', String(target.x)); line.setAttribute('y2', String(target.y));
      line.setAttribute('stroke', this.theme.colors.edgeStroke); line.setAttribute('stroke-width', '1.5'); line.setAttribute('marker-end', 'url(#wardley-arrow)'); group.appendChild(line);
    }
    for (const component of chart.components) {
      const item = document.createElementNS('http://www.w3.org/2000/svg', 'g'); item.classList.add(component.anchor ? 'wardley-anchor' : 'wardley-component');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = component.label; item.appendChild(title);
      if (component.anchor) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', String(component.center.x)); circle.setAttribute('cy', String(component.center.y)); circle.setAttribute('r', '8'); circle.setAttribute('fill', this.theme.colors.nodeStroke); item.appendChild(circle);
      } else {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); rect.setAttribute('x', String(component.center.x - 48)); rect.setAttribute('y', String(component.center.y - 16)); rect.setAttribute('width', '96'); rect.setAttribute('height', '32'); rect.setAttribute('rx', String(Math.min(this.theme.nodeBorderRadius, 8))); rect.setAttribute('fill', this.theme.colors.nodeFill); rect.setAttribute('stroke', this.theme.colors.nodeStroke); rect.setAttribute('stroke-width', '1.5'); item.appendChild(rect);
      }
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.classList.add('wardley-component-label'); label.textContent = component.label;
      label.setAttribute('x', String(component.center.x)); label.setAttribute('y', String(component.center.y + (component.anchor ? -13 : 5))); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', this.theme.colors.nodeText); label.setAttribute('font-family', this.theme.fontFamily); label.setAttribute('font-size', String(Math.max(10, this.theme.fontSize - 1))); label.setAttribute('font-weight', component.anchor ? '700' : '600'); item.appendChild(label); group.appendChild(item);
    }
    if (chart.title) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text'); title.classList.add('wardley-title'); title.textContent = chart.title;
      title.setAttribute('x', String(chart.plot.x)); title.setAttribute('y', String(chart.plot.y - 20)); title.setAttribute('fill', this.theme.colors.nodeText); title.setAttribute('font-family', this.theme.fontFamily); title.setAttribute('font-size', String(this.theme.fontSize + 4)); title.setAttribute('font-weight', '700'); group.appendChild(title);
    }
    svg.appendChild(group);
  }

  private wardleyBoundary(component: { center: Point; anchor: boolean }, toward: Point): Point {
    const dx = toward.x - component.center.x;
    const dy = toward.y - component.center.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return component.center;
    if (component.anchor) {
      return { x: component.center.x + dx / distance * 8, y: component.center.y + dy / distance * 8 };
    }

    const scale = 1 / Math.max(Math.abs(dx) / 48, Math.abs(dy) / 16);
    return { x: component.center.x + dx * scale, y: component.center.y + dy * scale };
  }

  private renderSwimlanes(svg: SVGSVGElement, layout: LayoutResult): void {
    const chart = layout.swimlanes!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('swimlanes');
    chart.lanes.forEach((lane, index) => {
      const laneGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      laneGroup.classList.add('swimlane');
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('x', String(lane.bounds.x)); background.setAttribute('y', String(lane.bounds.y));
      background.setAttribute('width', String(lane.bounds.width)); background.setAttribute('height', String(lane.bounds.height));
      background.setAttribute('rx', String(this.theme.nodeBorderRadius + 6));
      background.setAttribute('fill', this.theme.colors.subgraphFill); background.setAttribute('fill-opacity', index % 2 ? '.17' : '.28');
      background.setAttribute('stroke', this.theme.colors.subgraphStroke); background.setAttribute('stroke-width', '1.25');
      laneGroup.appendChild(background);
      const header = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      header.classList.add('swimlane-header'); header.textContent = lane.label;
      header.setAttribute('x', String(lane.bounds.x + 16)); header.setAttribute('y', String(lane.bounds.y + 23));
      header.setAttribute('fill', this.theme.colors.nodeText); header.setAttribute('font-family', this.theme.fontFamily);
      header.setAttribute('font-size', String(Math.max(11, this.theme.fontSize - 1))); header.setAttribute('font-weight', '700');
      laneGroup.appendChild(header); group.appendChild(laneGroup);
    });
    svg.appendChild(group);
  }

  private renderSequence(svg: SVGSVGElement, layout: LayoutResult): void {
    const sequence = layout.sequence!;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('sequence');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Sequence diagram';
    group.appendChild(title);

    for (const block of sequence.blocks) {
      const blockGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      blockGroup.classList.add('sequence-block');
      const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      frame.setAttribute('x', String(block.bounds.x)); frame.setAttribute('y', String(block.bounds.y));
      frame.setAttribute('width', String(block.bounds.width)); frame.setAttribute('height', String(block.bounds.height));
      if (block.kind === 'rect') {
        frame.classList.add('sequence-rect');
        frame.setAttribute('fill', block.color ?? this.theme.colors.subgraphFill);
        frame.setAttribute('fill-opacity', '.45');
      } else {
        frame.setAttribute('fill', this.theme.colors.subgraphFill); frame.setAttribute('fill-opacity', '.22');
      }
      frame.setAttribute('stroke', this.theme.colors.subgraphStroke); frame.setAttribute('stroke-width', '1.25');
      blockGroup.appendChild(frame);
      if (block.label) this.appendSequenceText(blockGroup, block.label, block.bounds.x + 10, block.bounds.y + 17, 'start', 'sequence-block-label', Math.max(10, this.theme.fontSize - 2));
      for (const divider of block.dividers) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('sequence-block-divider'); line.setAttribute('x1', String(block.bounds.x)); line.setAttribute('x2', String(block.bounds.x + block.bounds.width));
        line.setAttribute('y1', String(divider.y)); line.setAttribute('y2', String(divider.y));
        line.setAttribute('stroke', this.theme.colors.subgraphStroke); line.setAttribute('stroke-width', '1'); line.setAttribute('stroke-dasharray', '4 4');
        blockGroup.appendChild(line);
        this.appendSequenceText(blockGroup, divider.label, block.bounds.x + 10, divider.y - 7, 'start', 'sequence-block-divider-label', Math.max(10, this.theme.fontSize - 3));
      }
      group.appendChild(blockGroup);
    }

    for (const lifeline of sequence.lifelines) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('sequence-lifeline'); line.setAttribute('x1', String(lifeline.start.x)); line.setAttribute('x2', String(lifeline.end.x));
      line.setAttribute('y1', String(lifeline.start.y)); line.setAttribute('y2', String(lifeline.end.y));
      line.setAttribute('stroke', this.theme.colors.edgeStroke); line.setAttribute('stroke-width', '1.25'); line.setAttribute('stroke-dasharray', '6 5');
      group.appendChild(line);
    }

    for (const message of sequence.messages) {
      const messageGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      messageGroup.classList.add('sequence-message');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.classList.add('sequence-message-line');
      const selfMessage = message.self_width !== undefined;
      const selfWidth = message.self_width ?? 34;
      line.setAttribute('d', selfMessage
        ? `M ${message.from_x} ${message.y} h ${selfWidth} v 24 h -${selfWidth}`
        : `M ${message.from_x} ${message.y} L ${message.to_x} ${message.y}`);
      line.setAttribute('fill', 'none'); line.setAttribute('stroke', this.theme.colors.edgeStroke); line.setAttribute('stroke-width', '1.5');
      if (message.dashed) line.setAttribute('stroke-dasharray', '5 4');
      messageGroup.appendChild(line);
      const direction = selfMessage ? 1 : Math.sign(message.to_x - message.from_x) || 1;
      const tipX = selfMessage ? message.from_x : message.to_x;
      if (message.end_marker === 'cross') {
        const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        cross.classList.add('sequence-message-cross');
        cross.setAttribute('d', `M ${tipX - 4} ${message.y - 4} L ${tipX + 4} ${message.y + 4} M ${tipX - 4} ${message.y + 4} L ${tipX + 4} ${message.y - 4}`);
        cross.setAttribute('fill', 'none'); cross.setAttribute('stroke', this.theme.colors.edgeStroke); cross.setAttribute('stroke-width', '1.5');
        messageGroup.appendChild(cross);
      } else {
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.classList.add('sequence-message-arrow');
        arrow.setAttribute('points', `${tipX},${message.y} ${tipX - direction * 8},${message.y - 4} ${tipX - direction * 8},${message.y + 4}`);
        arrow.setAttribute('fill', this.theme.colors.edgeStroke); messageGroup.appendChild(arrow);
      }
      if (message.number !== undefined) {
        this.appendSequenceText(messageGroup, String(message.number), message.from_x + direction * 12, message.y - 9, 'middle', 'sequence-message-number', Math.max(9, this.theme.fontSize - 3));
      }
      this.appendSequenceText(messageGroup, message.label, message.label_position.x, message.label_position.y, 'middle', 'sequence-message-label', Math.max(10, this.theme.fontSize - 2));
      group.appendChild(messageGroup);
    }

    for (const activation of sequence.activations) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('sequence-activation'); rect.setAttribute('x', String(activation.bounds.x)); rect.setAttribute('y', String(activation.bounds.y));
      rect.setAttribute('width', String(activation.bounds.width)); rect.setAttribute('height', String(activation.bounds.height));
      rect.setAttribute('fill', this.theme.colors.nodeFill); rect.setAttribute('fill-opacity', '.72'); rect.setAttribute('stroke', this.theme.colors.nodeStroke); rect.setAttribute('stroke-width', '1');
      group.appendChild(rect);
    }

    for (const note of sequence.notes) {
      const noteGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g'); noteGroup.classList.add('sequence-note');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(note.bounds.x)); rect.setAttribute('y', String(note.bounds.y)); rect.setAttribute('width', String(note.bounds.width)); rect.setAttribute('height', String(note.bounds.height));
      rect.setAttribute('fill', this.theme.colors.subgraphFill); rect.setAttribute('stroke', this.theme.colors.subgraphStroke); rect.setAttribute('stroke-width', '1'); rect.setAttribute('rx', '4');
      noteGroup.appendChild(rect);
      this.appendSequenceLines(noteGroup, note.lines?.length ? note.lines : [note.text], note.bounds.x + note.bounds.width / 2, note.bounds.y + 15, 'sequence-note-label', Math.max(10, this.theme.fontSize - 3));
      group.appendChild(noteGroup);
    }

    for (const participant of sequence.participants) {
      const participantGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g'); participantGroup.classList.add('sequence-participant');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(participant.header.x)); rect.setAttribute('y', String(participant.header.y)); rect.setAttribute('width', String(participant.header.width)); rect.setAttribute('height', String(participant.header.height));
      rect.setAttribute('fill', this.theme.colors.nodeFill); rect.setAttribute('stroke', this.theme.colors.nodeStroke); rect.setAttribute('stroke-width', '1.5');
      if (participant.kind === 'actor') rect.setAttribute('rx', String(participant.header.height / 2));
      participantGroup.appendChild(rect);
      this.appendSequenceText(participantGroup, participant.label, participant.header.x + participant.header.width / 2, participant.header.y + participant.header.height / 2 + 5, 'middle', 'sequence-participant-label', this.theme.fontSize);
      group.appendChild(participantGroup);
    }
    svg.appendChild(group);
  }

  private appendSequenceText(group: SVGGElement, value: string, x: number, y: number, anchor: 'start' | 'middle', className: string, size: number): void {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add(className); text.textContent = value; text.setAttribute('x', String(x)); text.setAttribute('y', String(y));
    text.setAttribute('text-anchor', anchor); text.setAttribute('fill', this.theme.colors.nodeText); text.setAttribute('font-family', this.theme.fontFamily); text.setAttribute('font-size', String(size));
    group.appendChild(text);
  }

  private appendSequenceLines(group: SVGGElement, lines: string[], x: number, y: number, className: string, size: number): void {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add(className); text.setAttribute('x', String(x)); text.setAttribute('y', String(y));
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', this.theme.colors.nodeText); text.setAttribute('font-family', this.theme.fontFamily); text.setAttribute('font-size', String(size));
    lines.forEach((line, index) => {
      const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      span.setAttribute('x', String(x)); span.setAttribute('dy', index === 0 ? '0' : '16'); span.textContent = line; text.appendChild(span);
    });
    group.appendChild(text);
  }

  private appendKanbanText(group: SVGGElement, value: string, bounds: { x: number; y: number; width: number; height: number }, fill: string, size: number, className: string): void {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add(className);
    text.setAttribute('x', String(bounds.x + bounds.width / 2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', fill);
    text.setAttribute('font-family', this.theme.fontFamily);
    text.setAttribute('font-size', String(size));
    this.setTextLines(text, [value], { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, size);
    group.appendChild(text);
  }

  private renderNode(node: LayoutNode): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('node');
    g.setAttribute('id', `node-${node.id}`);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = node.label;
    g.appendChild(title);

    const shape = this.createNodeShape(node);
    shape.setAttribute('fill', isHexColor(node.style?.fill) ? node.style.fill : this.theme.colors.nodeFill);
    shape.setAttribute('stroke', isHexColor(node.style?.stroke) ? node.style.stroke : this.theme.colors.nodeStroke);
    shape.setAttribute('stroke-width', '1.5');
    g.appendChild(shape);

    const labelLines = node.label_lines?.length ? node.label_lines : [node.label];
    const fill = isHexColor(node.style?.color) ? node.style.color : this.theme.colors.nodeText;
    const fontAwesomeLabel = labelLines.length === 1 ? parseFontAwesomeLabel(labelLines[0]!) : undefined;
    if (fontAwesomeLabel) {
      this.appendFontAwesomeLabel(g, fontAwesomeLabel, node.center, fill);
    } else {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(node.center.x));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', fill);
      text.setAttribute('font-family', this.theme.fontFamily);
      text.setAttribute('font-size', String(this.theme.fontSize));
      this.setTextLines(text, labelLines, node.center, this.theme.fontSize);
      g.appendChild(text);
    }

    return g;
  }

  private appendFontAwesomeLabel(group: SVGGElement, label: FontAwesomeLabel, center: Point, fill: string): void {
    const iconSize = this.theme.fontSize;
    const gap = label.text ? 4 : 0;
    const textWidth = label.text ? this.measureText(label.text, this.theme.fontSize) : 0;
    const totalWidth = iconSize + gap + textWidth;
    const startX = center.x - totalWidth / 2;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('data-icon', `fa:${label.name}`);
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', label.name);
    icon.setAttribute('x', String(startX));
    icon.setAttribute('y', String(center.y - iconSize / 2));
    icon.setAttribute('width', String(iconSize));
    icon.setAttribute('height', String(iconSize));
    icon.setAttribute('viewBox', `0 0 ${label.icon.width ?? 16} ${label.icon.height ?? 16}`);
    icon.setAttribute('fill', fill);
    icon.setAttribute('color', fill);
    icon.innerHTML = label.icon.body;
    group.appendChild(icon);

    if (!label.text) return;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(startX + iconSize + gap + textWidth / 2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', fill);
    text.setAttribute('font-family', this.theme.fontFamily);
    text.setAttribute('font-size', String(this.theme.fontSize));
    this.setTextLines(text, [label.text], { x: startX + iconSize + gap + textWidth / 2, y: center.y }, this.theme.fontSize);
    group.appendChild(text);
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
    const explicit = this.computeExplicitEdgePath(edge, sourceNode, targetNode);
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

  private computeExplicitEdgePath(
    edge: LayoutEdge,
    sourceNode: LayoutNode,
    targetNode: LayoutNode,
  ): EdgePathResult | undefined {
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

    const directFlowEdge = edge.geometry_version === 2 && edge.waypoints.length === 2;
    const arrowAngle = directFlowEdge || this.theme.curveStyle === 'step'
      ? terminalAngleAtTargetBoundary(edge.target_boundary, targetNode.bounds, edge.final_tangent_angle)
      : edge.final_tangent_angle;
    const sourceBoundary = directFlowEdge
      ? flowAxisBoundary(sourceNode.bounds, arrowAngle, 'source')
      : edge.source_boundary;
    const targetBoundary = directFlowEdge
      ? flowAxisBoundary(targetNode.bounds, arrowAngle, 'target')
      : edge.target_boundary;
    const placement = this.edgeHasArrow(edge)
      ? computeArrowPlacement(
        targetBoundary,
        arrowAngle,
        this.theme.arrowSize,
        this.theme.edgeGap,
        this.theme.arrowStyle,
        this.edgeStrokeWidth(edge),
      )
      : {
        arrowTip: targetBoundary,
        arrowAnchor: targetBoundary,
        pathEnd: targetBoundary,
      };

    return {
      path: this.buildExplicitPath(edge, sourceBoundary, placement.pathEnd, arrowAngle, directFlowEdge),
      arrowTip: placement.arrowTip,
      arrowAnchor: placement.arrowAnchor,
      arrowAngle,
      pathEnd: placement.pathEnd,
    };
  }

  private buildExplicitPath(
    edge: LayoutEdge,
    sourceBoundary: Point,
    pathEnd: Point,
    arrowAngle: number,
    directFlowEdge: boolean,
  ): string {
    const points = [
      sourceBoundary,
      ...edge.waypoints.slice(1, -1),
      pathEnd,
    ];
    const flowAxisElbow = directFlowEdge && this.theme.curveStyle === 'step'
      ? {
        x: (edge.waypoints[0]!.x + edge.waypoints[1]!.x) / 2,
        y: (edge.waypoints[0]!.y + edge.waypoints[1]!.y) / 2,
      }
      : undefined;

    if (this.theme.curveStyle === 'step') {
      return this.buildStepPath(points, arrowAngle, flowAxisElbow);
    }

    if (this.theme.curveStyle === 'bezier') {
      return directFlowEdge
        ? this.buildFlowAxisBezierPath(points[0]!, points.at(-1)!, arrowAngle)
        : this.buildExplicitBezierPath(points, edge.final_tangent_angle);
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

  private buildStepPath(points: Point[], finalAngle?: number, flowAxisElbow?: Point): string {
    const [start, ...rest] = points;

    if (flowAxisElbow && rest.length === 1 && finalAngle !== undefined) {
      const end = rest[0]!;
      const terminalVertical = Math.abs(Math.sin(finalAngle)) >= Math.abs(Math.cos(finalAngle));
      if (terminalVertical) {
        if (sameCoordinate(start.x, end.x)) return `M ${start.x} ${start.y} V ${end.y}`;
        return `M ${start.x} ${start.y} V ${flowAxisElbow.y} H ${end.x} V ${end.y}`;
      }
      if (sameCoordinate(start.y, end.y)) return `M ${start.x} ${start.y} H ${end.x}`;
      return `M ${start.x} ${start.y} H ${flowAxisElbow.x} V ${end.y} H ${end.x}`;
    }

    const parts = [`M ${start.x} ${start.y}`];
    let previous = start;

    for (const [index, point] of rest.entries()) {
      const isFinal = index === rest.length - 1;
      const terminalVertical = finalAngle !== undefined && Math.abs(Math.sin(finalAngle)) >= Math.abs(Math.cos(finalAngle));
      if (isFinal && terminalVertical) {
        if (sameCoordinate(previous.x, point.x)) parts.push(`V ${point.y}`);
        else {
          parts.push(`H ${point.x}`);
          parts.push(`V ${point.y}`);
        }
      } else if (isFinal && finalAngle !== undefined) {
        if (sameCoordinate(previous.y, point.y)) parts.push(`H ${point.x}`);
        else {
          parts.push(`V ${point.y}`);
          parts.push(`H ${point.x}`);
        }
      } else if (sameCoordinate(previous.y, point.y)) {
        parts.push(`H ${point.x}`);
      } else if (sameCoordinate(previous.x, point.x)) {
        parts.push(`V ${point.y}`);
      } else {
        parts.push(`H ${(previous.x + point.x) / 2}`);
        parts.push(`V ${point.y}`);
        parts.push(`H ${point.x}`);
      }
      previous = point;
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

  private buildFlowAxisBezierPath(start: Point, end: Point, angle: number): string {
    const vertical = Math.abs(Math.sin(angle)) >= Math.abs(Math.cos(angle));
    const forward = vertical ? Math.sign(Math.sin(angle)) || 1 : Math.sign(Math.cos(angle)) || 1;
    const distance = vertical ? Math.abs(end.y - start.y) : Math.abs(end.x - start.x);
    const routeDistance = Math.hypot(end.x - start.x, end.y - start.y);
    const control = Math.min(Math.max(distance * .45, 16), 48);
    const terminalControlDistance = Math.min(Math.max(routeDistance * .25, 32), 48);
    const firstControl = vertical
      ? { x: start.x, y: start.y + forward * control }
      : { x: start.x + forward * control, y: start.y };
    const terminalControl = vertical
      ? { x: end.x, y: end.y - forward * terminalControlDistance }
      : { x: end.x - forward * terminalControlDistance, y: end.y };

    return `M ${start.x} ${start.y} C ${firstControl.x} ${firstControl.y} ${terminalControl.x} ${terminalControl.y} ${end.x} ${end.y}`;
  }

  private buildExplicitBezierPath(points: Point[], finalAngle?: number): string {
    if (points.length === 2) return this.buildSimpleBezierPath(points[0], points[1]);
    const end = points.at(-1)!;
    const beforeEnd = points.at(-2)!;
    const prefix = points.slice(0, -2);
    const commands = [`M ${points[0].x} ${points[0].y}`, ...prefix.slice(1).map(point => `L ${point.x} ${point.y}`)];
    const curveStart = prefix.at(-1)!;
    const routeDx = beforeEnd.x - curveStart.x;
    const routeDy = beforeEnd.y - curveStart.y;
    const routeDistance = Math.hypot(routeDx, routeDy);
    const targetDistance = Math.hypot(end.x - beforeEnd.x, end.y - beforeEnd.y);
    const routeControl = Math.min(Math.max(routeDistance * .45, 16), 48);
    // Keep the terminal handle long enough that the final visible segment has
    // the layout-owned entry direction, even after marker shortening.
    const targetControl = Math.min(Math.max(targetDistance * .45, 32), 48);
    const angle = finalAngle ?? Math.atan2(end.y - beforeEnd.y, end.x - beforeEnd.x);
    const routeAngle = routeDistance > 0
      ? Math.atan2(routeDy, routeDx)
      : angle;
    const cp1 = {
      x: curveStart.x + Math.cos(routeAngle) * routeControl,
      y: curveStart.y + Math.sin(routeAngle) * routeControl,
    };
    const cp2 = {
      x: end.x - Math.cos(angle) * targetControl,
      y: end.y - Math.sin(angle) * targetControl,
    };

    // The final cubic starts at the current SVG pen position, not at the
    // previous route waypoint. Its controls therefore preserve the route's
    // outgoing direction and the layout-supplied target tangent without a
    // reverse hook immediately before the marker.
    commands.push(`C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`);
    return commands.join(' ');
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
