import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SVGRenderer } from '../src/renderer/svg';
import type { FlowchartAst, LayoutResult, Point } from '../src/types';

function makeLayout(positions: [string, Point][], width = 400, height = 300): LayoutResult {
  return { positions, dimensions: { width, height } };
}

function makeFlowchart(overrides: Partial<FlowchartAst> = {}): FlowchartAst {
  return {
    type: 'flowchart',
    direction: 'TD',
    nodes: [],
    edges: [],
    subgraphs: [],
    ...overrides,
  };
}

describe('SVGRenderer', () => {
  let renderer: SVGRenderer;

  beforeEach(() => {
    renderer = new SVGRenderer('default');
  });

  it('creates an SVG element with correct dimensions', () => {
    const ast = makeFlowchart();
    const layout = makeLayout([], 500, 400);
    const svg = renderer.render(ast, layout);
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('width')).toBe('500');
    expect(svg.getAttribute('height')).toBe('400');
    expect(svg.getAttribute('viewBox')).toBe('0 0 500 400');
  });

  it('renders a rect node', () => {
    const ast = makeFlowchart({
      nodes: [{ id: 'A', label: 'Hello', shape: 'rect', classes: [], styles: [] }],
    });
    const layout = makeLayout([['A', { x: 100, y: 50 }]]);
    const svg = renderer.render(ast, layout);
    const node = svg.querySelector('#node-A');
    expect(node).toBeTruthy();
    const rect = node!.querySelector('rect');
    expect(rect).toBeTruthy();
    expect(rect!.getAttribute('fill')).toBe('#fff');
  });

  it('renders a diamond node', () => {
    const ast = makeFlowchart({
      nodes: [{ id: 'D', label: 'Choice', shape: 'diamond', classes: [], styles: [] }],
    });
    const layout = makeLayout([['D', { x: 100, y: 50 }]]);
    const svg = renderer.render(ast, layout);
    const node = svg.querySelector('#node-D');
    expect(node).toBeTruthy();
    const polygon = node!.querySelector('polygon');
    expect(polygon).toBeTruthy();
  });

  it('renders a circle node', () => {
    const ast = makeFlowchart({
      nodes: [{ id: 'C', label: 'Circle', shape: 'circle', classes: [], styles: [] }],
    });
    const layout = makeLayout([['C', { x: 100, y: 50 }]]);
    const svg = renderer.render(ast, layout);
    const node = svg.querySelector('#node-C');
    expect(node).toBeTruthy();
    const ellipse = node!.querySelector('ellipse');
    expect(ellipse).toBeTruthy();
  });

  it('renders node label text', () => {
    const ast = makeFlowchart({
      nodes: [{ id: 'A', label: 'My Label', shape: 'rect', classes: [], styles: [] }],
    });
    const layout = makeLayout([['A', { x: 100, y: 50 }]]);
    const svg = renderer.render(ast, layout);
    const text = svg.querySelector('#node-A text');
    expect(text?.textContent).toBe('My Label');
  });

  it('uses node id as label when label is null', () => {
    const ast = makeFlowchart({
      nodes: [{ id: 'A', label: null, shape: 'rect', classes: [], styles: [] }],
    });
    const layout = makeLayout([['A', { x: 100, y: 50 }]]);
    const svg = renderer.render(ast, layout);
    const text = svg.querySelector('#node-A text');
    expect(text?.textContent).toBe('A');
  });

  it('renders an edge with arrow', () => {
    const ast = makeFlowchart({
      nodes: [
        { id: 'A', label: null, shape: 'rect', classes: [], styles: [] },
        { id: 'B', label: null, shape: 'rect', classes: [], styles: [] },
      ],
      edges: [{ from: 'A', to: 'B', style: 'arrow', label: null, min_length: 1 }],
    });
    const layout = makeLayout([['A', { x: 40, y: 40 }], ['B', { x: 40, y: 140 }]]);
    const svg = renderer.render(ast, layout);
    const edge = svg.querySelector('#edge-A-B');
    expect(edge).toBeTruthy();
    const path = edge!.querySelector('path');
    expect(path).toBeTruthy();
    expect(path!.getAttribute('marker-end')).toContain('arrowhead');
  });

  it('renders a dotted edge', () => {
    const ast = makeFlowchart({
      nodes: [
        { id: 'A', label: null, shape: 'rect', classes: [], styles: [] },
        { id: 'B', label: null, shape: 'rect', classes: [], styles: [] },
      ],
      edges: [{ from: 'A', to: 'B', style: 'dotted', label: null, min_length: 1 }],
    });
    const layout = makeLayout([['A', { x: 40, y: 40 }], ['B', { x: 40, y: 140 }]]);
    const svg = renderer.render(ast, layout);
    const path = svg.querySelector('#edge-A-B path');
    expect(path?.getAttribute('stroke-dasharray')).toBe('5,3');
  });

  it('renders an edge label', () => {
    const ast = makeFlowchart({
      nodes: [
        { id: 'A', label: null, shape: 'rect', classes: [], styles: [] },
        { id: 'B', label: null, shape: 'rect', classes: [], styles: [] },
      ],
      edges: [{ from: 'A', to: 'B', style: 'arrow', label: 'Yes', min_length: 1 }],
    });
    const layout = makeLayout([['A', { x: 40, y: 40 }], ['B', { x: 40, y: 140 }]]);
    const svg = renderer.render(ast, layout);
    const label = svg.querySelector('#edge-A-B text');
    expect(label?.textContent).toBe('Yes');
  });

  it('renders all node shapes without error', () => {
    const shapes = ['rect', 'rounded', 'circle', 'double_circle', 'diamond', 'hexagon', 'stadium', 'subroutine', 'parallelogram', 'trapezoid', 'asymmetric', 'cylinder'] as const;
    for (const shape of shapes) {
      const ast = makeFlowchart({
        nodes: [{ id: 'N', label: 'Test', shape, classes: [], styles: [] }],
      });
      const layout = makeLayout([['N', { x: 100, y: 50 }]]);
      const svg = renderer.render(ast, layout);
      expect(svg.querySelector('#node-N')).toBeTruthy();
    }
  });

  it('applies dark theme', () => {
    const dark = new SVGRenderer('dark');
    const ast = makeFlowchart({
      nodes: [{ id: 'A', label: 'Dark', shape: 'rect', classes: [], styles: [] }],
    });
    const layout = makeLayout([['A', { x: 100, y: 50 }]]);
    const svg = dark.render(ast, layout);
    const rect = svg.querySelector('#node-A rect');
    expect(rect?.getAttribute('fill')).toBe('#1e1e2e');
  });

  it('renderToString produces valid HTML string', () => {
    const ast = makeFlowchart({
      nodes: [{ id: 'A', label: 'Test', shape: 'rect', classes: [], styles: [] }],
    });
    const layout = makeLayout([['A', { x: 100, y: 50 }]]);
    const html = renderer.renderToString(ast, layout);
    expect(html).toContain('<svg');
    expect(html).toContain('node-A');
  });
});
