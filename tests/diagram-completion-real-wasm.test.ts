import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';
import { analyzeSupport, detectUnsupportedFeatures } from '../src/support';
import { resolveSourceTheme } from '../src/xmermaid';
import { DARK_THEME, LIGHT_THEME, MINIMAL_THEME } from '../src/types/theme';

beforeAll(async () => {
  await initWasmPackage({
    module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm'),
  });
});

describe('Pie header completion', () => {
  it('parses `pie showData` with the value table enabled', () => {
    const ast = JSON.parse(parseDsl('pie showData\n  title "Key elements"\n  "Calcium" : 42\n  "Iron" : 8'));
    expect(ast).toMatchObject({ show_data: true, title: 'Key elements' });
    const layout = renderWithConfig('pie showData\n  title "Key elements"\n  "Calcium" : 42\n  "Iron" : 8', null) as any;
    expect(layout.pie_show_data).toBe(true);
    expect(layout.pie_title).toBe('Key elements');
  });

  it('parses the combined `pie showData title` header and standalone title lines', () => {
    const combined = JSON.parse(parseDsl('pie showData title Migration\n  "Done" : 6\n  "Todo" : 4'));
    expect(combined).toMatchObject({ show_data: true, title: 'Migration' });
    const standalone = JSON.parse(parseDsl('pie\n  title Migration\n  "Done" : 6\n  "Todo" : 4'));
    expect(standalone).toMatchObject({ title: 'Migration' });
  });

  it('reports pie diagrams as fully supported including the init theme directive', () => {
    expect(analyzeSupport("%%{init: {'theme':'dark'}}%%\npie\n  \"a\": 1\n  \"b\": 2")).toMatchObject({
      diagramType: 'pie',
      status: 'supported',
    });
    expect(analyzeSupport('pie\n  "a": 1\n  "b": 2')).toMatchObject({ diagramType: 'pie', status: 'supported' });
  });
});

describe('Gantt unix dateFormat', () => {
  it('parses `dateFormat X` unix seconds into normalized task dates', () => {
    const ast = JSON.parse(parseDsl('gantt\n  dateFormat X\n  section S\n  Task : 1700000000, 2d'));
    expect(ast.type).toBe('gantt');
    expect(ast.tasks[0].start).toMatchObject({ date: '2023-11-14' });
  });

  it('parses `dateFormat x` unix milliseconds', () => {
    const ast = JSON.parse(parseDsl('gantt\n  dateFormat x\n  section S\n  Task : 1700000000000, 1d'));
    expect(ast.tasks[0].start).toMatchObject({ date: '2023-11-14' });
  });

  it('parses the historical `dateFormat unix` alias', () => {
    const ast = JSON.parse(parseDsl('gantt\n  dateFormat unix\n  section S\n  Task : 0, 1d'));
    expect(ast.tasks[0].start).toMatchObject({ date: '1970-01-01' });
  });

  it('reports gantt diagrams as fully supported', () => {
    expect(analyzeSupport('gantt\n  dateFormat X\n  section S\n  Task : 1700000000, 2d')).toMatchObject({
      diagramType: 'gantt',
      status: 'supported',
      unsupportedFeatures: [],
    });
  });
});

describe('Sequence rgba rect frames', () => {
  it('parses rgba() rect colors and carries them through layout', () => {
    const source = 'sequenceDiagram\n  A->>B: hi\n  rect rgba(0, 0, 255, 0.2)\n    A->>B: inside\n  end';
    const layout = renderWithConfig(source, null) as any;
    const colored = (layout.sequence.blocks as any[]).find(block => block.color);
    expect(colored?.color).toBe('rgba(0, 0, 255, 0.2)');
    expect(detectUnsupportedFeatures(source)).toEqual([]);
  });

  it('still rejects malformed rgba frames', () => {
    expect(() => parseDsl('sequenceDiagram\n  A->>B: hi\n  rect rgba(0, 0, 300, 0.2)\n    A->>B: x\n  end')).toThrow();
  });
});

describe('Quadrant point styling', () => {
  it('parses direct radius, color, stroke-color, and stroke-width styles', () => {
    const source = 'quadrantChart\n  x-axis L --> H\n  y-axis L --> H\n  Point D: [0.6, 0.3] radius: 15, color: #00ff0f, stroke-color: #10f0f0, stroke-width: 5px';
    const ast = JSON.parse(parseDsl(source));
    expect(ast.points[0]).toMatchObject({
      radius: 15,
      fill_color: '#00ff0f',
      stroke_color: '#10f0f0',
      stroke_width: 5,
    });
    const layout = renderWithConfig(source, null) as any;
    expect(layout.quadrant_chart.points[0]).toMatchObject({ radius: 15, fill_color: '#00ff0f' });
  });

  it('resolves classDef styles with direct styles taking precedence', () => {
    const source = [
      'quadrantChart',
      '  x-axis L --> H',
      '  y-axis L --> H',
      '  Point A:::class1: [0.9, 0.0]',
      '  Point B:::class2: [0.8, 0.1] radius: 7',
      '  classDef class1 color: #109060, radius: 10',
      '  classDef class2 color: #908342, radius: 20',
    ].join('\n');
    const ast = JSON.parse(parseDsl(source));
    expect(ast.points[0]).toMatchObject({ fill_color: '#109060', radius: 10 });
    // Direct radius wins over the class radius.
    expect(ast.points[1]).toMatchObject({ fill_color: '#908342', radius: 7 });
    expect(detectUnsupportedFeatures(source)).toEqual([]);
  });

  it('rejects references to undefined classes', () => {
    expect(() => parseDsl('quadrantChart\n  x-axis L --> H\n  y-axis L --> H\n  Point A:::missing: [0.9, 0.0]')).toThrow(/undefined class/);
  });
});

describe('Radar graticule shapes and ticks', () => {
  it('parses graticule polygon and custom tick counts into layout', () => {
    const source = 'radar-beta\n  graticule polygon\n  ticks 3\n  axis a, b, c\n  curve k { 1, 2, 3 }';
    const layout = renderWithConfig(source, null) as any;
    expect(layout.radar).toMatchObject({ graticule: 'polygon', ticks: 3 });
    expect(detectUnsupportedFeatures(source)).toEqual([]);
  });

  it('defaults to circle graticules with five ticks', () => {
    const layout = renderWithConfig('radar-beta\n  axis a, b, c\n  curve k { 1, 2, 3 }', null) as any;
    expect(layout.radar).toMatchObject({ graticule: 'circle', ticks: 5 });
  });
});

describe('XY chart completion', () => {
  it('parses horizontal orientation and lays bars out along the value axis', () => {
    const source = 'xychart-beta horizontal\n  x-axis [a, b]\n  y-axis 0 --> 10\n  bar [4, 8]';
    const layout = renderWithConfig(source, null) as any;
    expect(layout.xy_chart.horizontal).toBe(true);
    const bars = layout.xy_chart.series[0].bars as { x: number; width: number; height: number }[];
    expect(bars[1].width).toBeGreaterThan(bars[0].width);
    expect(layout.xy_chart.value_axis_labels.length).toBeGreaterThan(1);
    expect(detectUnsupportedFeatures(source)).toEqual([]);
  });

  it('parses quoted and unquoted axis titles on both axes', () => {
    const quoted = JSON.parse(parseDsl('xychart-beta\n  x-axis "Months" [a, b]\n  y-axis "Money" 0 --> 10\n  bar [1, 2]'));
    expect(quoted).toMatchObject({ x_title: 'Months', y_title: 'Money' });
    const unquoted = JSON.parse(parseDsl('xychart-beta\n  x-axis Months 0 --> 10\n  y-axis Money 0 --> 10\n  bar [1, 2]'));
    expect(unquoted).toMatchObject({ x_title: 'Months', y_title: 'Money' });
  });

  it('derives auto y ranges and default category axes from the data', () => {
    const ast = JSON.parse(parseDsl('xychart-beta\n  line [2.3, 45, .98]'));
    expect(ast.x_labels).toEqual(['1', '2', '3']);
    expect(ast.y_min).toBe(0);
    expect(ast.y_max).toBe(45);
  });

  it('renders numeric x-axis charts without support warnings', () => {
    const source = 'xychart-beta\n  x-axis 0 --> 10\n  y-axis 0 --> 100\n  bar [10, 50]';
    const layout = renderWithConfig(source, null) as any;
    expect(layout.xy_chart.x_labels.length).toBeGreaterThan(1);
    expect(detectUnsupportedFeatures(source)).toEqual([]);
  });
});

describe('Expanded flowchart shapes are no longer blanket-flagged', () => {
  it('keeps supported expanded shapes free of support errors', () => {
    expect(detectUnsupportedFeatures('flowchart TD\n  A@{ shape: stadium, label: "Start" } --> B')).toEqual([]);
  });
});

describe('Kanban ticket metadata is no longer blanket-flagged', () => {
  it('keeps ticket-only metadata free of support errors and flags other keys', () => {
    expect(detectUnsupportedFeatures('kanban\n  col[Col]\n    t1[Task]@{ ticket: ABC-1 }')).toEqual([]);
    expect(detectUnsupportedFeatures('kanban\n  col[Col]\n    t1[Task]@{ ticket: ABC-1, priority: High }')).toEqual([
      expect.objectContaining({ id: 'kanban.advanced', severity: 'error' }),
    ]);
  });
});

describe('Class diagram style directives and namespaces', () => {
  it('applies safe style directives to class nodes', () => {
    const source = 'classDiagram\n  class Foo\n  Foo : +int a\n  style Foo fill:#ff0000, color: white';
    expect(detectUnsupportedFeatures(source)).toEqual([]);
    const layout = renderWithConfig(source, null) as any;
    expect(layout.nodes[0]).toMatchObject({ id: 'Foo', style: { fill: '#ff0000', color: 'white' } });
  });

  it('renders namespace containers without support warnings', () => {
    const source = 'classDiagram\n  namespace Payments {\n    class Invoice\n  }\n  Invoice : +int total';
    expect(detectUnsupportedFeatures(source)).toEqual([]);
    const layout = renderWithConfig(source, null) as any;
    expect(layout.nodes.map((node: any) => node.id)).toContain('Invoice');
  });

  it('still flags classDef, cssClass, and click directives', () => {
    expect(detectUnsupportedFeatures('classDiagram\n  class Foo\n  classDef red fill:#f00')).toEqual([
      expect.objectContaining({ id: 'class.advanced', severity: 'error' }),
    ]);
  });
});

describe('Audit regressions', () => {
  it('rejects non-ASCII pie header tokens with a parse error instead of panicking', () => {
    expect(() => parseDsl('pie showdaté\n  "a": 1')).toThrow(/Unsupported Pie header|Invalid Pie slice/);
    expect(() => parseDsl('pie üüüüüüüü\n  "a": 1')).toThrow();
  });

  it('accepts case variants of the pie header keywords', () => {
    const ast = JSON.parse(parseDsl('pie SHOWDATA TITLE Migration\n  "Done" : 6\n  "Todo" : 4'));
    expect(ast).toMatchObject({ show_data: true, title: 'Migration' });
  });

  it('accepts rgba alpha written as .5 (detector and parser agree)', () => {
    const source = 'sequenceDiagram\n  A->>B: hi\n  rect rgba(0, 0, 255, .5)\n    A->>B: x\n  end';
    expect(detectUnsupportedFeatures(source)).toEqual([]);
    expect(() => renderWithConfig(source, null)).not.toThrow();
  });

  it('rejects unix timestamps outside the four-digit ISO year range', () => {
    expect(() => parseDsl('gantt\n  dateFormat X\n  section S\n  T : -99999999999, 1d')).toThrow();
    expect(() => parseDsl('gantt\n  dateFormat X\n  section S\n  T : 99999999999999, 1d')).toThrow();
  });

  it('rejects a bare numeric y-axis declaration instead of treating it as a title', () => {
    expect(() => parseDsl('xychart-beta\n  y-axis 0\n  bar [1, 2]')).toThrow(/y-axis/);
  });

  it('still enforces series length against categorical x-axis labels', () => {
    expect(() => parseDsl('xychart-beta\n  x-axis [a, b]\n  bar [1, 2, 3]')).toThrow(/one value per x-axis label/);
  });

  it('lets the source init directive override an explicitly passed theme', async () => {
    const { XMermaid } = await import('../src/xmermaid');
    const xm = new XMermaid({ container: document.createElement('div') });
    const result = await xm.renderToSVGElement(
      "%%{init: {'theme': 'minimal'}}%%\nflowchart TD\n  A --> B",
      { theme: DARK_THEME },
    );
    // The directive wins, so the dark background must not appear.
    expect(result.svg.querySelector('rect')?.getAttribute('fill')).not.toBe(DARK_THEME.colors.background);
  });
});

describe('Front matter and detector alignment', () => {
  it('renders front-matter sources end-to-end for line-based families', () => {
    const source = '---\ntitle: T\n---\npie\n  "a": 1\n  "b": 2';
    expect(analyzeSupport(source)).toMatchObject({ diagramType: 'pie', status: 'supported' });
    const layout = renderWithConfig(source, null) as any;
    expect(layout.pie_slices).toHaveLength(2);
    const gantt = '---\ntitle: T\n---\ngantt\n  section S\n  T : 2024-01-01, 1d';
    expect(analyzeSupport(gantt)).toMatchObject({ diagramType: 'gantt', status: 'supported' });
    expect(() => renderWithConfig(gantt, null)).not.toThrow();
  });

  it('flags radar showLegend as unsupported instead of failing deep in the parser', () => {
    expect(detectUnsupportedFeatures('radar-beta\n  showLegend true\n  axis a, b, c\n  curve k { 1, 2, 3 }')).toEqual([
      expect.objectContaining({ id: 'radar.advanced', severity: 'error' }),
    ]);
  });

  it('rejects signed rgb channels consistently with the analyzer', () => {
    const source = 'sequenceDiagram\n  A->>B: hi\n  rect rgb(+10, 20, 30)\n    A->>B: x\n  end';
    expect(detectUnsupportedFeatures(source)).not.toEqual([]);
    expect(() => parseDsl(source)).toThrow(/plain decimal/);
  });
});

describe('init theme directive resolution', () => {
  it('maps mermaid theme names onto render themes', () => {
    expect(resolveSourceTheme("%%{init: {'theme': 'dark'}}%%\nflowchart TD\n  A-->B")).toBe(DARK_THEME);
    expect(resolveSourceTheme('%%{init: {"theme":"neutral"}}%%\nflowchart TD\n  A-->B')).toBe(LIGHT_THEME);
    expect(resolveSourceTheme('%%{init: {theme: forest}}%%\nflowchart TD\n  A-->B')).toBe(MINIMAL_THEME);
    expect(resolveSourceTheme("%%{init: {'fontFamily': 'x', theme: dark}}%%\nflowchart TD\n  A-->B")).toBe(DARK_THEME);
    expect(resolveSourceTheme('flowchart TD\n  A-->B')).toBeUndefined();
    expect(resolveSourceTheme("%%{init: {'theme':'unobtainium'}}%%\nflowchart TD\n  A-->B")).toBeUndefined();
    // Keys merely ending in "theme" must not resolve.
    expect(resolveSourceTheme("%%{init: {'footheme': 'dark'}}%%\nflowchart TD\n  A-->B")).toBeUndefined();
  });
});

describe('User journey is fully supported', () => {
  it('renders journey tasks end-to-end without support warnings', () => {
    const source = 'journey\n  title Checkout\n  section Shop\n    Find product: 5: Buyer';
    expect(analyzeSupport(source)).toMatchObject({ diagramType: 'user-journey', status: 'supported' });
    const layout = renderWithConfig(source, null) as any;
    expect(layout.dimensions.width).toBeGreaterThan(0);
  });
});
