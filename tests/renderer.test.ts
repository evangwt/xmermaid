import { beforeAll, describe, it, expect } from 'vitest';
import { SVGRenderer } from '../src/renderer/svg';
import { DEFAULT_THEME } from '../src/types/theme';
import type { LayoutResult, LayoutNode, LayoutEdge } from '../src/types/layout';

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

describe('SVGRenderer', () => {
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
    expect(Number(label?.getAttribute('y'))).toBeCloseTo(115, 1);
  });

  it('prefers explicit edge geometry over waypoint fallback', () => {
    const layout = createTestLayout();
    layout.edges[0] = {
      ...layout.edges[0],
      waypoints: [{ x: 160, y: 60 }, { x: 160, y: 180 }],
      source_boundary: { x: 20, y: 30 },
      target_boundary: { x: 120, y: 30 },
      path_end: { x: 96, y: 30 },
      final_tangent_angle: 0,
      label_anchor: { x: 58, y: 42 },
      geometry_version: 1,
    } as LayoutEdge;

    const svg = new SVGRenderer({ curveStyle: 'straight', edgeGap: 8, arrowSize: 10 }).render(layout);
    const path = svg.querySelector('g.edge path');
    const label = Array.from(svg.querySelectorAll('g.edge text'))
      .find(el => el.textContent === 'yes');

    expect(path?.getAttribute('d')).toBe('M 20 30 L 96 30');
    expect(label?.getAttribute('x')).toBe('58');
    expect(label?.getAttribute('y')).toBe('42');
    expect(svg.querySelector('g.edge polygon')?.getAttribute('points')).toContain('120,30');
  });
});
