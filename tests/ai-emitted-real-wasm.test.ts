import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, { render_with_config as renderWithConfig } from '../pkg/xmermaid_wasm.js';
import { normalizeSource } from '../src/normalize';

beforeAll(async () => {
  await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
});

function layoutFor(source: string): any {
  return renderWithConfig(source, null) as any;
}

describe('AI-emitted syntax real WASM contract', () => {
  // Regression: the sequence arrow table used to omit `->`, `-->`, `-x`, and
  // the canonical bidirectional `<<->>`, so the most common AI arrows threw a
  // parse error and failed the whole diagram. Every Mermaid arrow now parses.
  it('parses every sequence arrow form, including the no-head and cross lines', () => {
    const layout = layoutFor([
      'sequenceDiagram',
      '  A->>B: solid-head',
      '  A-->>B: dashed-head',
      '  A->B: solid-line',
      '  A-->B: dashed-line',
      '  A-xB: solid-cross',
      '  A--xB: dashed-cross',
      '  A-)B: solid-open',
      '  A--)B: dashed-open',
    ].join('\n'));
    expect(layout.sequence.messages).toMatchObject([
      { from: 'A', to: 'B', label: 'solid-head', dashed: false, end_marker: 'arrow' },
      { from: 'A', to: 'B', label: 'dashed-head', dashed: true, end_marker: 'arrow' },
      { from: 'A', to: 'B', label: 'solid-line', dashed: false, end_marker: 'none' },
      { from: 'A', to: 'B', label: 'dashed-line', dashed: true, end_marker: 'none' },
      { from: 'A', to: 'B', label: 'solid-cross', dashed: false, end_marker: 'cross' },
      { from: 'A', to: 'B', label: 'dashed-cross', dashed: true, end_marker: 'cross' },
      { from: 'A', to: 'B', label: 'solid-open', dashed: false, end_marker: 'open' },
      { from: 'A', to: 'B', label: 'dashed-open', dashed: true, end_marker: 'open' },
    ]);
  });

  it('parses canonical and legacy bidirectional arrows without stray participants', () => {
    const layout = layoutFor([
      'sequenceDiagram',
      '  A<<->>B: canonical',
      '  A<<-->>B: canonical-dashed',
      '  A<->B: legacy',
    ].join('\n'));
    expect(layout.sequence.messages).toMatchObject([
      { from: 'A', to: 'B', label: 'canonical', bidirectional: true, end_marker: 'arrow' },
      { from: 'A', to: 'B', label: 'canonical-dashed', dashed: true, bidirectional: true },
      { from: 'A', to: 'B', label: 'legacy', bidirectional: true, end_marker: 'none' },
    ]);
  });

  // Regression: `direction LR` and `note for X "…"` used to throw
  // "Invalid class statement" and failed the whole class diagram.
  it('accepts class direction directives and applies them to the layout', () => {
    const vertical = layoutFor('classDiagram\n  direction TB\n  A --> B\n  B --> C');
    expect(vertical.nodes).toHaveLength(3);
    // A top-to-bottom chain stacks nodes by increasing y.
    const ys = vertical.nodes.map((node: any) => node.center.y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('defaults class diagrams to left-to-right when no direction is given', () => {
    const layout = layoutFor('classDiagram\n  A --> B');
    const xs = layout.nodes.map((node: any) => node.center.x);
    expect(xs[0]).toBeLessThan(xs[1]);
  });

  it('rejects an invalid class direction', () => {
    expect(() => layoutFor('classDiagram\n  direction XY\n  A --> B')).toThrow(/direction/i);
  });

  it('accepts and skips class notes instead of failing the diagram', () => {
    for (const note of ['note for A "hello"', 'note left of A "hi"', 'note right of A "hi"', 'note "floating"']) {
      const layout = layoutFor(`classDiagram\n  class A\n  ${note}\n  A --> B`);
      expect(layout.nodes, note).toHaveLength(2);
    }
  });

  // Regression: a quadrant point-to-point connector `A --> B` used to be fed
  // to the point parser, which requires `[x, y]` and threw.
  it('accepts quadrant point-to-point connectors while keeping the points', () => {
    const layout = layoutFor([
      'quadrantChart',
      '  A: [0.3, 0.6]',
      '  B: [0.7, 0.2]',
      '  A --> B',
    ].join('\n'));
    expect(layout.quadrant_chart.points).toHaveLength(2);
    expect(layout.quadrant_chart.points.map((point: any) => point.label)).toEqual(['A', 'B']);
  });

  // Regression: `::icon(fa fa-book) Docs` on one line used to throw
  // "Unbalanced or unsupported mindmap shape delimiters" because the icon
  // parens were mistaken for a node shape.
  it('accepts a mindmap icon prefix on the same line as its label', () => {
    const layout = layoutFor('mindmap\n  root((M))\n    ::icon(fa fa-book) Docs\n    ::icon(fa fa-cog) Settings');
    // The mindmap layout folds the icon into the node label as a `fa:fa-*`
    // prefix (later interpreted as a FontAwesome icon by the renderer).
    expect(layout.nodes).toMatchObject([
      { id: 'mindmap-0', label: 'M', shape: 'Circle' },
      { id: 'mindmap-1', label: 'fa:fa-book Docs' },
      { id: 'mindmap-2', label: 'fa:fa-cog Settings' },
    ]);
  });

  it('still accepts a mindmap icon on its own line', () => {
    const layout = layoutFor('mindmap\n  root((M))\n    Docs\n    ::icon(fa fa-book)');
    expect(layout.nodes[1]).toMatchObject({ label: 'fa:fa-book Docs' });
  });

  // Regression: a top-level concurrent-region separator `--` used to be fed to
  // the transition parser and threw. Regions are flattened; the support
  // analyzer surfaces a warning so the flattening is not silent.
  it('accepts a state concurrent-region separator and keeps both regions', () => {
    const layout = layoutFor([
      'stateDiagram-v2',
      '  [*] --> A',
      '  A --> B',
      '  --',
      '  B --> C',
    ].join('\n'));
    const ids = layout.nodes.map((node: any) => node.id);
    expect(ids).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });

  // Regression: a boundary container that opens its block on the same line
  // (`Enterprise_Boundary(b, "B") {`) used to feed the trailing brace to the
  // argument parser and throw.
  it('accepts a C4 boundary whose block opens on the call line', () => {
    const layout = layoutFor([
      'C4Context',
      '  Enterprise_Boundary(b, "B") {',
      '    System(s, "S")',
      '  }',
    ].join('\n'));
    const labels = layout.nodes.map((node: any) => node.label);
    expect(labels).toEqual(expect.arrayContaining(['S']));
  });

  // Regression: treemap depth was computed against a fixed four-space step, so
  // the common two-space AI indentation threw. Depth is now relative.
  it('accepts two-space treemap indentation and infers relative depth', () => {
    const layout = layoutFor(['treemap-beta', '"Root"', '  "Child": 10'].join('\n'));
    expect(layout.treemap.nodes).toHaveLength(2);
    expect(layout.treemap.nodes.map((node: any) => node.depth)).toEqual([0, 1]);
  });

  // Regression: kanban ids were validated as ASCII block identifiers, so a
  // Chinese board threw. Ids now accept any Unicode alphanumeric run.
  it('accepts non-ASCII kanban column and card ids', () => {
    const layout = layoutFor(['kanban', '  完成[Done]', '    任务[Task]'].join('\n'));
    expect(layout.kanban_board.columns).toHaveLength(1);
    expect(layout.kanban_board.columns[0]).toMatchObject({ id: '完成', label: 'Done' });
    expect(layout.kanban_board.columns[0].tasks[0]).toMatchObject({ id: '任务', label: 'Task' });
  });

  // Regression: quadrant `classDef` used `fill`, which the point style parser
  // rejected (it only knew `color`), and the class reference after the
  // coordinates (`[..]:::cls`) was not parsed at all — both threw.
  it('applies a quadrant classDef fill to a trailing :::class point', () => {
    const layout = layoutFor([
      'quadrantChart',
      '  classDef hot fill:#ff0000',
      '  A: [0.3, 0.6]:::hot',
      '  B: [0.7, 0.2]',
    ].join('\n'));
    expect(layout.quadrant_chart.points).toHaveLength(2);
    expect(layout.quadrant_chart.points[0]).toMatchObject({ label: 'A', fill_color: '#ff0000' });
    expect(layout.quadrant_chart.points[1]).toMatchObject({ label: 'B' });
  });

  it('applies a quadrant classDef to a leading :::class point', () => {
    const layout = layoutFor([
      'quadrantChart',
      '  classDef hot fill:#00ff00',
      '  A:::hot: [0.3, 0.6]',
    ].join('\n'));
    expect(layout.quadrant_chart.points[0]).toMatchObject({ label: 'A', fill_color: '#00ff00' });
  });

  // Regression: AI-emitted arrows often use a smart (en/em) or full-width dash
  // instead of the ASCII hyphen. `normalizeSource` folds the dash run only when
  // it forms an arrow head, so the canonical `->` reaches the Rust parser.
  it('renders every smart/full-width dash arrow after normalization', () => {
    for (const dash of ['\u2013', '\u2014', '\u2212', '\uFF0D']) {
      const layout = layoutFor(normalizeSource(`flowchart TD\n  A ${dash}> B`).text);
      expect(layout.nodes.map((node: any) => node.id), dash).toEqual(['A', 'B']);
      expect(layout.edges, dash).toHaveLength(1);
    }
  });

  it('renders a source with a leading UTF-8 BOM after normalization', () => {
    const layout = layoutFor(normalizeSource('\uFEFFflowchart TD\n  A --> B').text);
    expect(layout.nodes.map((node: any) => node.id)).toEqual(['A', 'B']);
  });

  // Regression: `A -->|a \| b| B` used to close the edge label at the escaped
  // pipe and throw "unterminated label"; the lexer now honours the backslash.
  it('reads a backslash-escaped pipe inside an edge label without closing it', () => {
    const layout = layoutFor('flowchart TD\n  A -->|a \\| b| B');
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({ label: 'a | b' });
  });

  // Regression: a standalone `<<interface>> A` line (no surrounding class
  // block) used to throw "Invalid class statement".
  it('accepts a standalone class stereotype annotation line', () => {
    const layout = layoutFor([
      'classDiagram',
      '  <<interface>> A',
      '  A <|-- B',
    ].join('\n'));
    expect(layout.nodes.map((node: any) => node.id)).toEqual(['A', 'B']);
  });

  // Regression: zenuml `participant`/`actor` declarations used to be rejected.
  it('accepts explicit zenuml participant declarations', () => {
    const layout = layoutFor('zenuml\n  participant A\n  A->B: x');
    expect(layout.nodes.map((node: any) => node.id)).toEqual(['A', 'B']);
  });
});
