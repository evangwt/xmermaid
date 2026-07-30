import { beforeAll, describe, it, expect } from 'vitest';
import { SVGRenderer } from '../src/renderer/svg';
import { DARK_THEME, DEFAULT_THEME } from '../src/types/theme';
import type { LayoutResult, LayoutNode } from '../src/types/layout';

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
});

function createTestLayout(): LayoutResult {
  const node1: LayoutNode = {
    id: 'A',
    center: { x: 160, y: 60 },
    bounds: { x: 100, y: 40, width: 120, height: 40 },
    shape: 'RoundedRect',
    label: 'Node A',
  };
  const node2: LayoutNode = {
    id: 'B',
    center: { x: 160, y: 180 },
    bounds: { x: 100, y: 160, width: 120, height: 40 },
    shape: 'RoundedRect',
    label: 'Node B',
  };
  const edge: LayoutEdge = {
    from: 'A',
    to: 'B',
    waypoints: [{ x: 160, y: 60 }, { x: 160, y: 180 }],
    label: 'yes',
    style: 'arrow',
  };

  return {
    nodes: [node1, node2],
    edges: [edge],
    dimensions: { width: 320, height: 240 },
  };
}

function renderArrow(arrowStyle: 'filled' | 'triangle' | 'open' | 'circle' | 'cross'): SVGSVGElement {
  const renderer = new SVGRenderer({ arrowStyle });
  return renderer.render(createTestLayout());
}

function layoutWithGeometry(version: 1 | 2): LayoutResult {
  const layout = createTestLayout();
  layout.edges[0] = {
    ...layout.edges[0],
    source_boundary: { x: 20, y: 30 },
    target_boundary: { x: 120, y: 30 },
    path_end: version === 1 ? { x: 96, y: 30 } : { x: 120, y: 30 },
    final_tangent_angle: 0,
    label_anchor: { x: 58, y: 42 },
    geometry_version: version,
  };
  return layout;
}

function renderedPathEnd(svg: SVGSVGElement): string {
  const values = svg.querySelector('g.edge path')?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g);
  if (!values || values.length < 2) throw new Error('Expected edge path coordinates.');
  return values.slice(-2).join(',');
}

function renderedArrowTip(svg: SVGSVGElement): string {
  const values = svg.querySelector('g.edge polygon')?.getAttribute('points')?.match(/-?\d+(?:\.\d+)?/g);
  if (!values || values.length < 4) throw new Error('Expected filled arrow coordinates.');
  return values.slice(2, 4).join(',');
}

describe('SVGRenderer', () => {
  it('renders swimlane backgrounds beneath their native nodes and edges', () => {
    const layout = {
      nodes: [
        { id: 'request', center: { x: 120, y: 92 }, bounds: { x: 60, y: 72, width: 120, height: 40 }, shape: 'RoundedRect', label: 'Request' },
        { id: 'triage', center: { x: 120, y: 256 }, bounds: { x: 60, y: 236, width: 120, height: 40 }, shape: 'RoundedRect', label: 'Triage' },
      ],
      edges: [{ from: 'request', to: 'triage', waypoints: [{ x: 120, y: 92 }, { x: 120, y: 256 }], style: 'arrow' }],
      dimensions: { width: 520, height: 340 },
      swimlanes: { direction: 'LR', lanes: [
        { id: 'Customer', label: 'Customer', bounds: { x: 40, y: 40, width: 440, height: 120 } },
        { id: 'Support', label: 'Support', bounds: { x: 40, y: 204, width: 440, height: 120 } },
      ] },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.swimlane')).toHaveLength(2);
    expect(svg.querySelectorAll('.swimlane-header')).toHaveLength(2);
    expect(svg.querySelector('.swimlane-header')?.textContent).toBe('Customer');
    expect(svg.querySelectorAll('.node')).toHaveLength(2);
    expect(svg.querySelectorAll('.edge')).toHaveLength(1);
  });

  it('renders native xychart axes, bars, and a line without flowchart nodes', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 480, height: 360 },
      xy_chart: {
        title: 'Quarterly revenue',
        plot: { x: 64, y: 44, width: 388, height: 216 },
        x_labels: ['Q1', 'Q2'],
        y_min: 0,
        y_max: 100,
        series: [
          { kind: 'bar', bars: [{ x: 120, y: 180, width: 36, height: 80 }, { x: 314, y: 100, width: 36, height: 160 }], points: [] },
          { kind: 'line', bars: [], points: [{ x: 138, y: 160 }, { x: 332, y: 140 }] },
        ],
      },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.xychart-axis')).toHaveLength(2);
    expect(svg.querySelectorAll('.xychart-bar')).toHaveLength(2);
    expect(svg.querySelector('.xychart-line')).not.toBeNull();
    expect(svg.querySelectorAll('.node')).toHaveLength(0);
  });

  it('renders weighted Sankey bands and node labels without flowchart edges', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 720, height: 400 },
      sankey: {
        nodes: [
          { id: 'Source', bounds: { x: 40, y: 80, width: 18, height: 120 }, value: 12, column: 0 },
          { id: 'Target', bounds: { x: 650, y: 120, width: 18, height: 120 }, value: 12, column: 1 },
        ],
        links: [
          { source: 'Source', target: 'Target', value: 12, source_y: 140, target_y: 180, thickness: 120 },
        ],
      },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.sankey-link')).toHaveLength(1);
    expect(svg.querySelectorAll('.sankey-node')).toHaveLength(2);
    expect(svg.querySelector('.sankey-label')?.textContent).toContain('Source');
    expect(svg.querySelectorAll('.edge')).toHaveLength(0);
  });

  it('renders a native four-cell quadrant chart and normalized points', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 560, height: 560 },
      quadrant_chart: {
        title: 'Reach and engagement',
        plot: { x: 80, y: 80, width: 360, height: 360 },
        x_axis: ['Low reach', 'High reach'],
        y_axis: ['Low engagement', 'High engagement'],
        quadrants: ['Expand', 'Promote', 'Re-evaluate', 'Improve'],
        points: [{ label: 'Campaign A', center: { x: 188, y: 188 } }, { label: 'Campaign B', center: { x: 332, y: 332 } }],
      },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.quadrant-cell')).toHaveLength(4);
    expect(svg.querySelectorAll('.quadrant-axis')).toHaveLength(2);
    expect(svg.querySelectorAll('.quadrant-point')).toHaveLength(2);
    expect(svg.querySelectorAll('.node')).toHaveLength(0);
  });

  it('renders Block Diagram grid cells and direct relationships as native SVG', () => {
    const layout = {
      nodes: [],
      edges: [{ from: 'A', to: 'B', waypoints: [{ x: 106, y: 76 }, { x: 258, y: 76 }], style: 'arrow' }],
      dimensions: { width: 476, height: 224 },
      block_diagram: {
        columns: 3,
        blocks: [
          { id: 'A', label: 'A', span: 1, bounds: { x: 40, y: 40, width: 132, height: 72 } },
          { id: 'B', label: 'B', span: 1, bounds: { x: 192, y: 40, width: 132, height: 72 } },
          { id: 'Wide', label: 'Wide', span: 2, bounds: { x: 40, y: 132, width: 284, height: 72 } },
        ],
      },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.block-node')).toHaveLength(3);
    expect(svg.querySelector('.block-relationship path')).not.toBeNull();
    expect(svg.querySelector('.block-node text')?.textContent).toBe('A');
  });

  it('renders a native Kanban board with headers and task cards', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 516, height: 224 },
      kanban_board: {
        columns: [
          { id: 'todo', label: 'To do', header: { x: 40, y: 40, width: 220, height: 46 }, tasks: [{ id: 'write', label: 'Write docs', bounds: { x: 40, y: 104, width: 220, height: 64 } }] },
          { id: 'done', label: 'Done', header: { x: 278, y: 40, width: 220, height: 46 }, tasks: [] },
        ],
      },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.kanban-column')).toHaveLength(2);
    expect(svg.querySelectorAll('.kanban-header')).toHaveLength(2);
    expect(svg.querySelectorAll('.kanban-task')).toHaveLength(1);
    expect(svg.querySelector('.kanban-task-label')?.textContent).toBe('Write docs');
  });

  it('renders nested treemap groups and proportioned leaf cells as native SVG', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 720, height: 480 },
      treemap: {
        nodes: [
          { label: 'Category A', value: 30, bounds: { x: 40, y: 40, width: 300, height: 400 }, depth: 0, is_leaf: false },
          { label: 'Item A1', value: 10, bounds: { x: 48, y: 62, width: 94, height: 370 }, depth: 1, is_leaf: true },
          { label: 'Item A2', value: 20, bounds: { x: 142, y: 62, width: 190, height: 370 }, depth: 1, is_leaf: true },
        ],
      },
    } as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.treemap-group')).toHaveLength(1);
    expect(svg.querySelectorAll('.treemap-leaf')).toHaveLength(2);
    expect(svg.querySelector('.treemap-leaf-label')?.textContent).toContain('Item A1');
    expect(svg.querySelectorAll('.node')).toHaveLength(0);
  });

  it('renders Radar grids, axes, and native curve polygons', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 600, height: 600 },
      radar: {
        title: 'Restaurant Comparison',
        center: { x: 300, y: 300 },
        radius: 172,
        min: 0,
        max: 5,
        axes: [
          { label: 'Food Quality', end: { x: 300, y: 128 }, label_position: { x: 300, y: 88 } },
          { label: 'Service', end: { x: 449, y: 386 }, label_position: { x: 484, y: 406 } },
          { label: 'Price', end: { x: 151, y: 386 }, label_position: { x: 116, y: 406 } },
        ],
        curves: [
          { label: 'Restaurant A', points: [{ x: 300, y: 162 }, { x: 389, y: 352 }, { x: 240, y: 334 }] },
        ],
      },
    } as unknown as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelectorAll('.radar-grid')).toHaveLength(4);
    expect(svg.querySelectorAll('.radar-axis')).toHaveLength(3);
    expect(svg.querySelectorAll('.radar-curve')).toHaveLength(1);
    expect(svg.querySelector('.radar-axis-label')?.textContent).toContain('Food Quality');
    expect(svg.querySelector('.radar-curve-title')?.textContent).toBe('Restaurant A');
    expect(svg.querySelectorAll('.node')).toHaveLength(0);
  });

  it('renders Packet bit fields as a native structured grid', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 656, height: 210 },
      packet: {
        title: 'UDP Packet',
        fields: [
          { start: 0, end: 15, label: 'Source Port', segments: [{ x: 40, y: 74, width: 288, height: 44 }] },
          { start: 16, end: 31, label: 'Destination Port', segments: [{ x: 328, y: 74, width: 288, height: 44 }] },
          { start: 32, end: 63, label: 'Length and Checksum', segments: [{ x: 40, y: 130, width: 576, height: 44 }] },
        ],
      },
    } as unknown as LayoutResult;

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelector('.packet')).not.toBeNull();
    expect(svg.querySelectorAll('.packet-field')).toHaveLength(3);
    expect(svg.querySelectorAll('.packet-segment')).toHaveLength(3);
    expect(svg.querySelector('.packet-title')?.textContent).toBe('UDP Packet');
    expect(svg.querySelector('.packet-field-label')?.textContent).toBe('Source Port');
  });

  it('creates an SVG element with correct dimensions', () => {
    const renderer = new SVGRenderer();
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('width')).toBe('320');
    expect(svg.getAttribute('height')).toBe('240');
  });

  it('renders nodes as groups with shapes and text', () => {
    const renderer = new SVGRenderer();
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    const groups = svg.querySelectorAll('g');
    expect(groups.length).toBeGreaterThanOrEqual(3);
  });

  it('renders edges with paths', () => {
    const renderer = new SVGRenderer();
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('applies theme colors', () => {
    const renderer = new SVGRenderer({ colors: { ...DEFAULT_THEME.colors, nodeFill: '#ff0000' } });
    const layout = createTestLayout();
    const svg = renderer.render(layout);

    const rects = svg.querySelectorAll('rect');
    let foundRed = false;
    rects.forEach(r => {
      if (r.getAttribute('fill') === '#ff0000') foundRed = true;
    });
    expect(foundRed).toBe(true);
  });

  it('renders filled arrows as polygons', () => {
    const svg = renderArrow('filled');

    expect(svg.querySelectorAll('g.edge polygon').length).toBe(1);
  });

  it('renders open arrows as an unclosed polyline', () => {
    const svg = renderArrow('open');

    expect(svg.querySelectorAll('g.edge polygon').length).toBe(0);
    const arrow = svg.querySelector('g.edge polyline');
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute('fill')).toBe('none');
  });

  it('renders circle arrows as circles', () => {
    const svg = renderArrow('circle');

    expect(svg.querySelectorAll('g.edge polygon').length).toBe(0);
    const arrow = svg.querySelector('g.edge circle');
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute('r')).toBe(String(DEFAULT_THEME.arrowSize / 2));
  });

  it('renders cross arrows as two crossing line elements', () => {
    const svg = renderArrow('cross');

    expect(svg.querySelectorAll('g.edge polygon').length).toBe(0);
    expect(svg.querySelectorAll('g.edge line.arrow-cross').length).toBe(2);
  });

  it('does not render arrowheads for line edges', () => {
    const layout = createTestLayout();
    layout.edges[0].style = 'line';
    const svg = new SVGRenderer().render(layout);

    expect(svg.querySelector('g.edge polygon, g.edge polyline, g.edge circle, g.edge line.arrow-cross')).toBeNull();
  });

  it('uses final path geometry for fallback label position', () => {
    const layout = createTestLayout();
    layout.edges[0].label_position = undefined;
    const svg = new SVGRenderer({ curveStyle: 'straight', edgeGap: 8, arrowSize: 10 }).render(layout);

    const label = Array.from(svg.querySelectorAll('g.edge text'))
      .find(el => el.textContent === 'yes');

    expect(label).toBeDefined();
    expect(Number(label?.getAttribute('y'))).toBeCloseTo(116.04, 1);
  });

  it('uses explicit route geometry while recomputing marker placement for geometry v1', () => {
    const svg = new SVGRenderer({ curveStyle: 'straight', edgeGap: 8, arrowSize: 10 }).render(layoutWithGeometry(1));
    const path = svg.querySelector('g.edge path');
    const label = Array.from(svg.querySelectorAll('g.edge text'))
      .find(el => el.textContent === 'yes');

    expect(path?.getAttribute('d')).not.toBe('M 20 30 L 96 30');
    expect(Number(renderedPathEnd(svg).split(',')[0])).toBeCloseTo(104.09, 2);
    expect(label?.getAttribute('x')).toBe('58');
    expect(label?.getAttribute('y')).toBe('42');
    expect(renderedArrowTip(svg)).toBe('112,30');
  });

  it('recomputes geometry v2 for the active arrow size without moving its tip', () => {
    const small = new SVGRenderer({ curveStyle: 'straight', edgeGap: 2, arrowSize: 8 }).render(layoutWithGeometry(2));
    const large = new SVGRenderer({ curveStyle: 'straight', edgeGap: 2, arrowSize: 20 }).render(layoutWithGeometry(2));

    expect(renderedPathEnd(small)).not.toBe(renderedPathEnd(large));
    expect(renderedArrowTip(small)).toBe(renderedArrowTip(large));
  });

  it('aligns explicit step and bezier path endings with the supplied target tangent', () => {
    const layout = layoutWithGeometry(2);
    layout.edges[0] = {
      ...layout.edges[0],
      waypoints: [{ x: 20, y: 30 }, { x: 78, y: 90 }, { x: 120, y: 30 }],
      source_boundary: { x: 20, y: 30 },
      target_boundary: { x: 120, y: 30 },
      final_tangent_angle: -Math.PI / 2,
    };

    const step = new SVGRenderer({ curveStyle: 'step' }).render(layout).querySelector('g.edge path')?.getAttribute('d') ?? '';
    const bezier = new SVGRenderer({ curveStyle: 'bezier' }).render(layout).querySelector('g.edge path')?.getAttribute('d') ?? '';

    expect(step.trim()).toMatch(/V\s+[^\s]+$/);
    expect(bezier).toContain('C');
  });

  it('keeps an explicit bezier turn attached to the current routed segment', () => {
    const layout = layoutWithGeometry(2);
    layout.edges[0] = {
      ...layout.edges[0],
      waypoints: [
        { x: 160, y: 260 },
        { x: 205, y: 260 },
        { x: 205, y: 201 },
        { x: 100, y: 201 },
        { x: 100, y: 180 },
      ],
      source_boundary: { x: 160, y: 260 },
      target_boundary: { x: 100, y: 180 },
      path_end: { x: 100, y: 180 },
      final_tangent_angle: -Math.PI / 2,
    };

    const path = new SVGRenderer({ curveStyle: 'bezier', edgeGap: 2, arrowSize: 10 })
      .render(layout)
      .querySelector('g.edge path')
      ?.getAttribute('d') ?? '';
    const finalCurve = path.match(/C\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)$/);

    expect(finalCurve).not.toBeNull();
    const firstControlX = Number(finalCurve?.[1]);
    const firstControlY = Number(finalCurve?.[2]);

    // The route reaches (205, 201) before it bends toward the target. Starting
    // the cubic control at (100, 201) skips that segment and creates a visible
    // reverse hook before the arrow.
    expect(firstControlX).toBeGreaterThan(152.5);
    expect(firstControlX).toBeLessThan(205);
    expect(firstControlY).toBe(201);
  });

  it('preserves axis-aligned explicit step routes without duplicate bends', () => {
    const layout = layoutWithGeometry(2);
    layout.edges[0] = {
      ...layout.edges[0],
      waypoints: [
        { x: 160, y: 260 },
        { x: 205, y: 260 },
        { x: 205, y: 201 },
        { x: 100, y: 201 },
        { x: 100, y: 180 },
      ],
      source_boundary: { x: 160, y: 260 },
      target_boundary: { x: 100, y: 180 },
      path_end: { x: 100, y: 180 },
      final_tangent_angle: -Math.PI / 2,
    };

    const path = new SVGRenderer({ curveStyle: 'step', edgeGap: 2, arrowSize: 10 })
      .render(layout)
      .querySelector('g.edge path')
      ?.getAttribute('d');

    expect(path).toBe('M 160 260 H 205 V 201 H 100 V 189.9102540378444');
  });

  it('renders native Ishikawa spine, effect, and indented causes', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 920, height: 520 },
      ishikawa: {
        effect: 'Blurry Photo',
        spine_start: { x: 84, y: 260 },
        spine_end: { x: 730, y: 260 },
        effect_bounds: { x: 752, y: 229, width: 128, height: 62 },
        causes: [
          { label: 'Process', parent: null, depth: 0, branch_anchor: { x: 302, y: 260 }, position: { x: 210, y: 130 } },
          { label: 'Out of focus', parent: 'Process', depth: 1, branch_anchor: { x: 210, y: 130 }, position: { x: 148, y: 172 } },
        ],
      },
    } as LayoutResult & { ishikawa: unknown };

    const svg = new SVGRenderer().render(layout);

    expect(svg.querySelector('.ishikawa-spine')).not.toBeNull();
    expect(svg.querySelector('.ishikawa-effect')?.textContent).toBe('Blurry Photo');
    expect(svg.querySelectorAll('.ishikawa-cause')).toHaveLength(2);
    expect(svg.textContent).toContain('Out of focus');
  });

  it('renders native Cynefin domains, quoted items, and transitions', () => {
    const layout = {
      nodes: [], edges: [], dimensions: { width: 980, height: 700 },
      cynefin: {
        title: 'Incident Response',
        domains: [
          { id: 'complex', label: 'Complex', bounds: { x: 60, y: 110, width: 400, height: 220 }, items: [{ label: 'Investigate root cause' }] },
          { id: 'complicated', label: 'Complicated', bounds: { x: 520, y: 110, width: 400, height: 220 }, items: [] },
          { id: 'chaotic', label: 'Chaotic', bounds: { x: 60, y: 390, width: 400, height: 220 }, items: [] },
          { id: 'clear', label: 'Clear', bounds: { x: 520, y: 390, width: 400, height: 220 }, items: [{ label: 'Restart service' }] },
          { id: 'confusion', label: 'Confusion', bounds: { x: 400, y: 310, width: 120, height: 80 }, items: [{ label: 'Unknown failure mode' }] },
        ],
        transitions: [{ from: 'complex', to: 'complicated', label: 'Pattern identified' }],
      },
    } as LayoutResult & { cynefin: unknown };

    const svg = new SVGRenderer().render(layout);

    expect(svg.querySelector('.cynefin')).not.toBeNull();
    expect(svg.querySelectorAll('.cynefin-domain')).toHaveLength(5);
    expect(svg.querySelector('.cynefin-confusion')).not.toBeNull();
    expect(svg.querySelectorAll('.cynefin-item')).toHaveLength(3);
    expect(svg.querySelectorAll('.cynefin-transition')).toHaveLength(1);
    expect(svg.textContent).toContain('Incident Response');
  });

  it('renders native sequence lifelines, activation bars, notes, and control frames', () => {
    const layout = {
      nodes: [],
      edges: [],
      dimensions: { width: 560, height: 420 },
      sequence: {
        participants: [
          { id: 'Client', label: 'Client', kind: 'participant', header: { x: 80, y: 40, width: 120, height: 44 } },
          { id: 'API', label: 'API', kind: 'participant', header: { x: 320, y: 40, width: 120, height: 44 } },
        ],
        lifelines: [
          { participant: 'Client', start: { x: 140, y: 84 }, end: { x: 140, y: 374 } },
          { participant: 'API', start: { x: 380, y: 84 }, end: { x: 380, y: 374 } },
        ],
        messages: [
          { from: 'Client', to: 'API', from_x: 140, to_x: 380, y: 134, label: 'Request', dashed: false, number: 1, end_marker: 'arrow', label_position: { x: 178, y: 125 }, self_width: null },
          { from: 'API', to: 'Client', from_x: 380, to_x: 140, y: 264, label: 'Response', dashed: true, number: 2, end_marker: 'cross', label_position: { x: 342, y: 255 }, self_width: null },
        ],
        activations: [{ participant: 'API', bounds: { x: 374, y: 134, width: 12, height: 130 } }],
        notes: [{ placement: 'right_of', participants: ['API'], bounds: { x: 404, y: 164, width: 128, height: 36 }, text: 'Validate request' }],
        blocks: [
          { kind: 'alt', label: 'Accepted', bounds: { x: 48, y: 206, width: 456, height: 120 }, dividers: [{ label: 'Rejected', y: 264 }] },
          { kind: 'rect', label: '', color: 'rgb(255, 235, 235)', bounds: { x: 48, y: 326, width: 456, height: 64 }, dividers: [] },
        ],
      },
    } as LayoutResult & { sequence: unknown };

    const svg = new SVGRenderer(DARK_THEME).render(layout);

    expect(svg.querySelector('.sequence')).not.toBeNull();
    expect(svg.querySelectorAll('.sequence-lifeline')).toHaveLength(2);
    expect(svg.querySelectorAll('.sequence-message')).toHaveLength(2);
    expect(svg.querySelectorAll('.sequence-message-number')).toHaveLength(2);
    expect(svg.querySelector('.sequence-message-number')?.textContent).toBe('1');
    expect(svg.querySelectorAll('.sequence-message-cross')).toHaveLength(1);
    expect(svg.querySelectorAll('.sequence-activation')).toHaveLength(1);
    expect(svg.querySelector('.sequence-note')?.textContent).toContain('Validate request');
    expect(svg.querySelector('.sequence-block')?.textContent).toContain('Accepted');
    expect(svg.querySelector('.sequence-rect')?.getAttribute('fill')).toBe('rgb(255, 235, 235)');
    expect(svg.querySelector('.sequence-participant-label')?.getAttribute('font-size')).toBe('12');
    expect(svg.querySelector('.sequence-message-label')?.getAttribute('x')).toBe('178');
  });
});
