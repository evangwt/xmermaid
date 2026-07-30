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

function stepPathPoints(path: string): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let x = 0;
  let y = 0;
  const commandPattern = /([MLHV])\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g;

  for (const match of path.matchAll(commandPattern)) {
    const command = match[1]!;
    const first = Number(match[2]);
    const second = match[3] === undefined ? undefined : Number(match[3]);

    if (command === 'H') x = first;
    else if (command === 'V') y = first;
    else if (second !== undefined) {
      x = first;
      y = second;
    }

    points.push({ x, y });
  }

  return points;
}

function filledArrow(path: SVGGElement): { base: { x: number; y: number }; tip: { x: number; y: number } } {
  const values = path.querySelector('polygon')?.getAttribute('points')?.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!values || values.length < 6) throw new Error('Expected a filled arrowhead.');

  return {
    base: {
      x: (values[0]! + values[4]!) / 2,
      y: (values[1]! + values[5]!) / 2,
    },
    tip: { x: values[2]!, y: values[3]! },
  };
}

describe('SVG geometry regression suite', () => {
  it('routes direct TD fan-out edges from the flow-axis ports in step mode', () => {
    // Captured from the user's Mermaid source after the layout pass. The raw
    // geometry deliberately hits the diamond's side and the target's top
    // corner; Step rendering must instead use the cardinal flow-axis ports.
    const source: LayoutNode = {
      id: 'C',
      center: { x: 325, y: 260 },
      bounds: { x: 227, y: 240, width: 196, height: 40 },
      shape: 'Diamond',
      label: 'Let me think',
    };
    const targets: LayoutNode[] = [
      { id: 'D', center: { x: 100, y: 360 }, bounds: { x: 40, y: 340, width: 120, height: 40 }, shape: 'Rectangle', label: 'Laptop' },
      { id: 'E', center: { x: 280, y: 360 }, bounds: { x: 220, y: 340, width: 120, height: 40 }, shape: 'Rectangle', label: 'iPhone' },
      { id: 'F', center: { x: 505, y: 360 }, bounds: { x: 400, y: 340, width: 210, height: 40 }, shape: 'Rectangle', label: 'fa:fa-car Car' },
    ];
    const edges: LayoutEdge[] = [
      {
        from: 'C', to: 'D', waypoints: [source.center, targets[0]!.center], label: 'One', label_anchor: { x: 212.5, y: 310 }, style: 'arrow',
        source_boundary: { x: 294.16083916083915, y: 273.7062937062937 }, target_boundary: { x: 145, y: 340 }, path_end: { x: 145, y: 340 }, final_tangent_angle: 2.723368324010564, geometry_version: 2,
      },
      {
        from: 'C', to: 'E', waypoints: [source.center, targets[1]!.center], label: 'Two', label_anchor: { x: 302.5, y: 310 }, style: 'arrow',
        source_boundary: { x: 316.7570093457944, y: 278.31775700934577 }, target_boundary: { x: 289, y: 340 }, path_end: { x: 289, y: 340 }, final_tangent_angle: 1.9936502529278375, geometry_version: 2,
      },
      {
        from: 'C', to: 'F', waypoints: [source.center, targets[2]!.center], label: 'Three', label_anchor: { x: 415, y: 310 }, style: 'arrow',
        source_boundary: { x: 351.32835820895525, y: 274.6268656716418 }, target_boundary: { x: 469, y: 340 }, path_end: { x: 469, y: 340 }, final_tangent_angle: 0.507098504392337, geometry_version: 2,
      },
    ];
    const svg = new SVGRenderer({ curveStyle: 'step', edgeGap: 2, arrowSize: 10, arrowStyle: 'filled' })
      .render({ nodes: [source, ...targets], edges, dimensions: { width: 650, height: 420 } });

    for (const [index, target] of targets.entries()) {
      const group = svg.querySelectorAll<SVGGElement>('g.edge')[index]!;
      const points = stepPathPoints(group.querySelector('path')?.getAttribute('d') ?? '');
      const label = group.querySelector('text');

      expect(points[0]).toEqual({ x: source.center.x, y: source.bounds.y + source.bounds.height });
      expect(points[1]).toEqual({ x: source.center.x, y: 310 });
      expect(points[2]).toEqual({ x: target.center.x, y: 310 });
      expect(points.at(-1)?.x).toBe(target.center.x);
      expect(Number(label?.getAttribute('x'))).toBe(edges[index]!.label_anchor!.x);
      expect(Number(label?.getAttribute('y'))).toBe(edges[index]!.label_anchor!.y);
    }
  });

  it('routes direct TD fan-out curves through the flow-axis ports in bezier mode', () => {
    const source: LayoutNode = {
      id: 'C',
      center: { x: 325, y: 260 },
      bounds: { x: 227, y: 240, width: 196, height: 40 },
      shape: 'Diamond',
      label: 'Let me think',
    };
    const targets: LayoutNode[] = [
      { id: 'D', center: { x: 100, y: 360 }, bounds: { x: 40, y: 340, width: 120, height: 40 }, shape: 'Rectangle', label: 'Laptop' },
      { id: 'E', center: { x: 280, y: 360 }, bounds: { x: 220, y: 340, width: 120, height: 40 }, shape: 'Rectangle', label: 'iPhone' },
      { id: 'F', center: { x: 505, y: 360 }, bounds: { x: 400, y: 340, width: 210, height: 40 }, shape: 'Rectangle', label: 'fa:fa-car Car' },
    ];
    const edges: LayoutEdge[] = [
      { from: 'C', to: 'D', waypoints: [source.center, targets[0]!.center], style: 'arrow', source_boundary: { x: 294.16083916083915, y: 273.7062937062937 }, target_boundary: { x: 145, y: 340 }, path_end: { x: 145, y: 340 }, final_tangent_angle: 2.723368324010564, geometry_version: 2 },
      { from: 'C', to: 'E', waypoints: [source.center, targets[1]!.center], style: 'arrow', source_boundary: { x: 316.7570093457944, y: 278.31775700934577 }, target_boundary: { x: 289, y: 340 }, path_end: { x: 289, y: 340 }, final_tangent_angle: 1.9936502529278375, geometry_version: 2 },
      { from: 'C', to: 'F', waypoints: [source.center, targets[2]!.center], style: 'arrow', source_boundary: { x: 351.32835820895525, y: 274.6268656716418 }, target_boundary: { x: 469, y: 340 }, path_end: { x: 469, y: 340 }, final_tangent_angle: 0.507098504392337, geometry_version: 2 },
    ];
    const svg = new SVGRenderer({ curveStyle: 'bezier', edgeGap: 2, arrowSize: 10, arrowStyle: 'filled' })
      .render({ nodes: [source, ...targets], edges, dimensions: { width: 650, height: 420 } });

    for (const [index, target] of targets.entries()) {
      const group = svg.querySelectorAll<SVGGElement>('g.edge')[index]!;
      const path = group.querySelector('path')?.getAttribute('d') ?? '';
      const [startX, startY, firstControlX, , terminalControlX, , endX, endY] = pathNumbers(path);
      const arrow = filledArrow(group);

      expect(path).toContain(' C ');
      expect(startX).toBe(source.center.x);
      expect(startY).toBe(source.bounds.y + source.bounds.height);
      expect(firstControlX).toBe(source.center.x);
      expect(terminalControlX).toBe(target.center.x);
      expect(endX).toBe(target.center.x);
      expect(endY).toBeLessThan(target.bounds.y);
      expect(arrow.tip.x).toBe(target.center.x);
      expect(arrow.tip.y).toBeGreaterThan(arrow.base.y);
    }
  });

  it('keeps explicit multi-branch step paths attached to and tangent with their arrowheads', () => {
    const a = node('A', { x: 100, y: 60 });
    const b = node('B', { x: 100, y: 220 });
    const edge: LayoutEdge = {
      from: 'A',
      to: 'B',
      waypoints: [a.center, { x: 180, y: 120 }, b.center],
      source_boundary: { x: 100, y: 80 },
      target_boundary: { x: 100, y: 200 },
      path_end: { x: 100, y: 190 },
      final_tangent_angle: Math.PI * .75,
      geometry_version: 2,
      style: 'arrow',
    };
    const svg = new SVGRenderer({ curveStyle: 'step', edgeGap: 8, arrowSize: 10, arrowStyle: 'filled' })
      .render(layoutFor(edge, [a, b]));
    const group = svg.querySelector<SVGGElement>('g.edge');
    const path = group?.querySelector('path')?.getAttribute('d') ?? '';
    const points = stepPathPoints(path);
    const end = points.at(-1)!;
    const previous = points.at(-2)!;
    const arrow = filledArrow(group!);
    const tangent = { x: end.x - previous.x, y: end.y - previous.y };
    const arrowVector = { x: arrow.tip.x - arrow.base.x, y: arrow.tip.y - arrow.base.y };
    const alignment = (tangent.x * arrowVector.x + tangent.y * arrowVector.y)
      / (Math.hypot(tangent.x, tangent.y) * Math.hypot(arrowVector.x, arrowVector.y));

    expect(Math.hypot(end.x - arrow.base.x, end.y - arrow.base.y)).toBeLessThanOrEqual(.76);
    expect(alignment).toBeGreaterThan(.999);
  });

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
