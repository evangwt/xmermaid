import { describe, it, expect } from 'vitest';
import { SVGRenderer } from '../src/renderer/svg';
import { DEFAULT_THEME } from '../src/types/theme';
import type { LayoutResult, LayoutNode, LayoutEdge } from '../src/types/layout';

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
  };

  return {
    nodes: [node1, node2],
    edges: [edge],
    dimensions: { width: 320, height: 240 },
  };
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
});
