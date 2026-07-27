import { beforeAll, describe, expect, it } from 'vitest';
import { SVGRenderer } from '../src/renderer/svg';
import { DEFAULT_THEME, type ArrowStyle } from '../src/types/theme';
import type { LayoutEdge, LayoutNode, LayoutResult, NodeShape } from '../src/types/layout';

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
});

function node(id: string, center: { x: number; y: number }, shape: NodeShape = 'RoundedRect'): LayoutNode {
  return {
    id,
    center,
    bounds: {
      x: center.x - 60,
      y: center.y - 20,
      width: 120,
      height: 40,
    },
    shape,
    label: id,
  };
}

function layoutFor(edge: LayoutEdge, nodes: LayoutNode[]): LayoutResult {
  return {
    nodes,
    edges: [edge],
    dimensions: { width: 520, height: 280 },
  };
}

function renderEdge(edge: LayoutEdge, nodes: LayoutNode[], arrowStyle: ArrowStyle = 'filled'): SVGGElement {
  const svg = new SVGRenderer({
    curveStyle: 'straight',
    edgeGap: 8,
    arrowSize: 10,
    arrowStyle,
  }).render(layoutFor(edge, nodes));

  const group = svg.querySelector('g.edge');
  expect(group).not.toBeNull();
  return group as SVGGElement;
}

function pathNumbers(path: string): number[] {
  return path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
}

describe('SVG geometry regression suite', () => {
  it('renders a multi-waypoint path through intermediate routing points without entering the target node', () => {
    const a = node('A', { x: 100, y: 60 });
    const b = node('B', { x: 380, y: 180 });
    const edge: LayoutEdge = {
      from: 'A',
      to: 'B',
      waypoints: [
        a.center,
        { x: 260, y: 60 },
        { x: 260, y: 180 },
        b.center,
      ],
      label: 'route',
      style: 'arrow',
    };

    const group = renderEdge(edge, [a, b]);
    const path = group.querySelector('path')?.getAttribute('d') ?? '';

    expect(path).toContain('L 260 60');
    expect(path).toContain('L 260 180');
    expect(path).toContain('L 304.08974596215563 180');

    const nums = pathNumbers(path);
    expect(nums.slice(0, 2)).toEqual([168, 60]);
    expect(nums.slice(-2)[0]).toBeCloseTo(304.09, 2);
    expect(nums.slice(-2)[1]).toBe(180);
    expect(nums[nums.length - 2]).toBeLessThan(b.bounds.x);
  });

  it('positions fallback labels from the final visible path geometry', () => {
    const a = node('A', { x: 100, y: 60 });
    const b = node('B', { x: 100, y: 180 });
    const edge: LayoutEdge = {
      from: 'A',
      to: 'B',
      waypoints: [a.center, b.center],
      label: 'fallback',
      label_position: undefined,
      label_anchor: undefined,
      style: 'arrow',
    };

    const group = renderEdge(edge, [a, b]);
    const label = Array.from(group.querySelectorAll('text'))
      .find(el => el.textContent === 'fallback');

    expect(label).toBeDefined();
    expect(Number(label?.getAttribute('x'))).toBeCloseTo(100, 1);
    expect(Number(label?.getAttribute('y'))).toBeCloseTo(116.04, 1);
  });

  it('clips fallback paths at non-rectangle shape boundaries', () => {
    const shapeCases: Array<{ shape: NodeShape; expectedStart: { x: number; y: number } }> = [
      { shape: 'Diamond', expectedStart: { x: 168, y: 60 } },
      { shape: 'Circle', expectedStart: { x: 128, y: 60 } },
      { shape: 'Stadium', expectedStart: { x: 168, y: 60 } },
    ];

    for (const { shape, expectedStart } of shapeCases) {
      const a = node('A', { x: 100, y: 60 }, shape);
      const b = node('B', { x: 300, y: 60 });
      const edge: LayoutEdge = {
        from: 'A',
        to: 'B',
        waypoints: [a.center, b.center],
        style: 'arrow',
      };

      const group = renderEdge(edge, [a, b]);
      const path = group.querySelector('path')?.getAttribute('d') ?? '';
      const [startX, startY] = pathNumbers(path);

      expect(startX).toBeCloseTo(expectedStart.x, 1);
      expect(startY).toBeCloseTo(expectedStart.y, 1);
      expect(startX).toBeGreaterThan(a.bounds.x);
      expect(startX).toBeGreaterThan(a.center.x);
    }
  });

  it.each([
    ['filled', 'polygon'],
    ['triangle', 'polygon'],
    ['open', 'polyline'],
    ['circle', 'circle'],
    ['cross', 'line.arrow-cross'],
  ] as const)('renders %s arrowheads with stable SVG elements', (arrowStyle, selector) => {
    const a = node('A', { x: 100, y: 60 });
    const b = node('B', { x: 260, y: 60 });
    const edge: LayoutEdge = {
      from: 'A',
      to: 'B',
      waypoints: [a.center, b.center],
      style: 'arrow',
    };

    const group = renderEdge(edge, [a, b], arrowStyle);
    const matches = group.querySelectorAll(selector);
    const expectedCount = arrowStyle === 'cross' ? 2 : 1;

    expect(matches.length).toBe(expectedCount);

    if (arrowStyle === 'open') {
      expect(group.querySelector('polyline')?.getAttribute('fill')).toBe('none');
    }

    if (arrowStyle === 'circle') {
      expect(group.querySelector('circle')?.getAttribute('r')).toBe(String(DEFAULT_THEME.arrowSize / 2));
    }
  });
});
