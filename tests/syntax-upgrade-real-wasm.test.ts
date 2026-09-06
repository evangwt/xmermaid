import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

beforeAll(async () => {
  await initWasmPackage({
    module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm'),
  });
});

interface LayoutNodeView {
  id: string;
  shape: string;
  label: string;
  style?: { fill?: string };
}

interface LayoutEdgeView {
  from: string;
  to: string;
  style: string;
  label?: string;
  start_marker?: string;
  end_marker?: string;
}

interface LayoutView {
  nodes: LayoutNodeView[];
  edges: LayoutEdgeView[];
  pie_title?: string;
  sequence?: { messages: { end_marker: string; number?: number }[] };
}

function layoutFor(source: string): LayoutView {
  return renderWithConfig(source, null) as LayoutView;
}

describe('Syntax upgrade real WASM contract', () => {
  it('renders flowchart ampersand chains as cross-product edges', () => {
    const layout = layoutFor('flowchart TD\n  A & B --> C & D');
    expect(layout.edges).toHaveLength(4);
    expect(layout.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'A', to: 'C' }),
      expect.objectContaining({ from: 'A', to: 'D' }),
      expect.objectContaining({ from: 'B', to: 'C' }),
      expect.objectContaining({ from: 'B', to: 'D' }),
    ]));
  });

  it('carries circle, cross, and bidirectional edge markers through layout', () => {
    const layout = layoutFor([
      'flowchart LR',
      '  A o--o B',
      '  C--xD',
      '  E<-->F',
    ].join('\n'));
    expect(layout.edges[0]).toMatchObject({ from: 'A', to: 'B', start_marker: 'circle', end_marker: 'circle' });
    expect(layout.edges[1]).toMatchObject({ from: 'C', to: 'D', end_marker: 'cross' });
    expect(layout.edges[2]).toMatchObject({ from: 'E', to: 'F', start_marker: 'arrow', end_marker: 'arrow' });
  });

  it('parses inline edge labels into a single labeled edge', () => {
    const layout = layoutFor('flowchart LR\n  A -- send --> B\n  C == confirm ==> D');
    expect(layout.edges[0]).toMatchObject({ from: 'A', to: 'B', label: 'send', style: 'arrow' });
    expect(layout.edges[1]).toMatchObject({ from: 'C', to: 'D', label: 'confirm', style: 'thick', end_marker: 'arrow' });
  });

  it('applies safe inline style statements to node styles', () => {
    const layout = layoutFor('flowchart TD\n  A[Start] --> B[End]\n  style A fill:#ff0000, color:#ffffff');
    expect(layout.nodes[0].style).toMatchObject({ fill: '#ff0000', color: '#ffffff' });
    expect(layout.nodes[1].style).toBeUndefined();
  });

  it('renders stadium and cylinder shapes natively', () => {
    const layout = layoutFor('flowchart TD\n  A([Start]) --> B[(Database)]');
    expect(layout.nodes[0]).toMatchObject({ id: 'A', shape: 'Stadium', label: 'Start' });
    expect(layout.nodes[1]).toMatchObject({ id: 'B', shape: 'Cylinder', label: 'Database' });
  });

  it('parses class relations with kinds, labels, and cardinalities', () => {
    const layout = layoutFor([
      'classDiagram',
      '  Animal <|-- Dog : inherits',
      '  Company "1" *-- "1..n" Department : has',
      '  Order ..> Customer : references',
    ].join('\n'));
    expect(layout.edges[0]).toMatchObject({ from: 'Dog', to: 'Animal', style: 'line', end_marker: 'triangle', label: 'inherits' });
    expect(layout.edges[1]).toMatchObject({ from: 'Company', to: 'Department', start_marker: 'diamond', label: '1 has 1..n' });
    expect(layout.edges[2]).toMatchObject({ from: 'Order', to: 'Customer', style: 'dotted', end_marker: 'arrow' });
  });

  it('renders class members inside class boxes', () => {
    const layout = layoutFor([
      'classDiagram',
      '  class Animal {',
      '    <<abstract>>',
      '    +int age',
      '    +makeSound()',
      '  }',
      '  Animal <|-- Dog',
    ].join('\n'));
    expect(layout.nodes[0].label).toContain('<<abstract>>');
    expect(layout.nodes[0].label).toContain('+int age');
    expect(layout.nodes[0].label).toContain('+makeSound()');
  });

  it('renders state pseudostates and composite blocks', () => {
    const layout = layoutFor([
      'stateDiagram-v2',
      '  [*] --> Idle',
      '  Idle --> s2 : submit',
      '  state s2 {',
      '    [*] --> Editing',
      '  }',
    ].join('\n'));
    const start = layout.nodes.find(node => node.id === '__start__');
    expect(start).toBeDefined();
    expect(start!.shape).toBe('Circle');
    expect(layout.edges[0]).toMatchObject({ from: '__start__', to: 'Idle' });
    expect(layout.edges[1]).toMatchObject({ from: 'Idle', to: 's2', label: 'submit' });
    expect(layout.edges[2]).toMatchObject({ from: '__start__', to: 'Editing' });
  });

  it('parses full ER cardinalities and attribute blocks', () => {
    const layout = layoutFor([
      'erDiagram',
      '  PERSON {',
      '    string name PK',
      '  }',
      '  PERSON ||--o{ CAR : owns',
      '  ALBUM |o..|{ TRACK : contains',
    ].join('\n'));
    expect(layout.edges[0]).toMatchObject({
      from: 'PERSON', to: 'CAR', label: 'owns', style: 'line',
      start_marker: 'crow_one', end_marker: 'crow_many',
    });
    expect(layout.edges[1]).toMatchObject({
      from: 'ALBUM', to: 'TRACK', label: 'contains', style: 'dotted',
      start_marker: 'crow_zero_one', end_marker: 'crow_one_or_more',
    });
    const person = layout.nodes.find(node => node.id === 'PERSON');
    expect(person!.label).toContain('string name PK');
  });

  it('renders gantt states, milestones, dependencies, and titles', () => {
    const layout = layoutFor([
      'gantt',
      '  title Roadmap',
      '  dateFormat YYYY-MM-DD',
      '  section Track',
      '  Research : done, t1, 2026-01-01, 2d',
      '  Launch : milestone, 2026-01-03, 0d',
      '  Follow-up : after t1, 3d',
    ].join('\n'));
    expect(layout.nodes[0].style).toMatchObject({ fill: '#a3a3a3' });
    expect(layout.nodes[1].shape).toBe('Diamond');
    // Follow-up starts after Research ends (2026-01-03), not at its own date.
    expect(layout.nodes[2].center.x).toBeGreaterThan(layout.nodes[0].center.x);
  });

  it('renders sequence async endings and autonumber offsets', () => {
    const layout = layoutFor([
      'sequenceDiagram',
      '  autonumber 10',
      '  A->>B: hello',
      '  A-)B: async',
    ].join('\n'));
    expect(layout.sequence!.messages[0]).toMatchObject({ number: 10 });
    expect(layout.sequence!.messages[1]).toMatchObject({ end_marker: 'open' });
  });

  it('renders subgraph containers and edges to container ids', () => {
    const layout = layoutFor([
      'flowchart TD',
      '  subgraph one [Group One]',
      '    A[Start]',
      '  end',
      '  A --> one',
    ].join('\n'));
    expect(layout.subgraph_boxes).toHaveLength(1);
    expect(layout.subgraph_boxes![0]).toMatchObject({ id: 'one', label: 'Group One' });
    // The container id resolves to a hidden endpoint node, not a user node.
    const container = layout.nodes.find(node => node.id === 'one');
    expect(container).toBeDefined();
    expect(container!.hidden).toBe(true);
    expect(layout.nodes.some(node => !node.hidden && node.id === 'one')).toBe(false);
  });

  it('supports hyphenated ids, entity codes, inline classes, and named colors', () => {
    const layout = layoutFor([
      'flowchart LR',
      '  my-node[Peak #9829;]:::important --> B',
      '  classDef important fill:firebrick, color: white',
      '  linkStyle 0 stroke:seagreen, stroke-width:3px',
    ].join('\n'));
    const node = layout.nodes.find(item => item.id === 'my-node')!;
    expect(node.label).toBe('Peak \u{2665}');
    expect(node.style).toMatchObject({ fill: 'firebrick', color: 'white' });
    expect(layout.edges[0]).toMatchObject({ from: 'my-node', to: 'B', stroke_color: 'seagreen', stroke_width: '3px' });
  });

  it('parses expanded shape declarations', () => {
    const layout = layoutFor('flowchart TD\n  A@{ shape: stadium, label: "Start" } --> B');
    expect(layout.nodes[0]).toMatchObject({ id: 'A', shape: 'Stadium', label: 'Start' });
  });

  it('renders sequence box groups, destroy markers, and bidirectional links', () => {
    const layout = layoutFor([
      'sequenceDiagram',
      '  box rgb(230, 240, 255) Frontend',
      '    participant UI',
      '    participant SDK',
      '  end',
      '  UI->>SDK: send',
      '  UI<->SDK: sync',
      '  destroy SDK',
      '  UI->>SDK: bye',
    ].join('\n'));
    expect(layout.sequence!.boxes).toHaveLength(1);
    expect(layout.sequence!.boxes![0]).toMatchObject({ label: 'Frontend', color: 'rgb(230, 240, 255)' });
    expect(layout.sequence!.messages[1].bidirectional).toBe(true);
    const sdkLifeline = layout.sequence!.lifelines.find(line => line.participant === 'SDK');
    expect(sdkLifeline?.destroy_y).toBeDefined();
  });

  it('flattens state concurrent regions without errors', () => {
    const layout = layoutFor([
      'stateDiagram-v2',
      '  state s2 {',
      '    [*] --> a',
      '    --',
      '    [*] --> b',
      '  }',
    ].join('\n'));
    expect(layout.nodes.some(node => node.id === 'a')).toBe(true);
    expect(layout.nodes.some(node => node.id === 'b')).toBe(true);
  });

  it('renders state choice, fork, join, and notes', () => {
    const layout = layoutFor([
      'stateDiagram-v2',
      '  state c <<choice>>',
      '  c --> A',
      '  A --> B : go',
      '  note right of B : checked',
    ].join('\n'));
    const choice = layout.nodes.find(node => node.id === 'c');
    expect(choice!.shape).toBe('Diamond');
    const note = layout.nodes.find(node => node.id === '__note__B');
    expect(note).toBeDefined();
    expect(note!.label).toBe('checked');
  });

  it('surfaces accessibility metadata through the layout payload', () => {
    const layout = layoutFor('pie\n  accTitle: Team shares\n  accDescr: Values by team\n  "A" : 1\n  "B" : 2');
    expect(layout.acc_title).toBe('Team shares');
    expect(layout.acc_descr).toBe('Values by team');
  });

  it('renders architecture groups, junctions, membership, and bidirectional arrows', () => {
    const layout = layoutFor([
      'architecture-beta',
      '  group public(cloud)[Public]',
      '  service api(server)[API] in public',
      '  service db(database)[Database]',
      '  junction j',
      '  api:R --> L:j',
      '  j:R --> L:db',
    ].join('\n'));
    expect(layout.subgraph_boxes).toHaveLength(1);
    expect(layout.subgraph_boxes![0]).toMatchObject({ id: 'public', label: 'Public' });
    const junction = layout.nodes.find(node => node.id === 'j');
    expect(junction).toBeDefined();
    expect(junction!.shape).toBe('Circle');
    expect(layout.edges).toHaveLength(2);
  });

  it('positions xychart series by numeric x-axis values', () => {
    const layout = layoutFor([
      'xychart-beta',
      '  x-axis "Seconds" 0 --> 10',
      '  y-axis "Y" 0 --> 10',
      '  line [1, 5, 9]',
    ].join('\n'));
    const chart = layout.xy_chart!;
    expect(chart.x_labels.length).toBeGreaterThan(2);
    const points = chart.series[0]!.points;
    expect(points).toHaveLength(3);
    // Values 1 and 9 sit near opposite ends of the plot.
    expect(points[0]!.x).toBeLessThan(points[1]!.x);
    expect(points[1]!.x).toBeLessThan(points[2]!.x);
    expect(points[2]!.x - points[0]!.x).toBeGreaterThan(chart.plot.width * 0.6);
  });

  it('renders class namespaces as containers with styled members', () => {
    const layout = layoutFor([
      'classDiagram',
      '  namespace Payments {',
      '    class Invoice',
      '    class Receipt',
      '    Invoice <|-- Receipt',
      '  }',
      '  style Invoice fill:teal',
    ].join('\n'));
    expect(layout.subgraph_boxes).toHaveLength(1);
    expect(layout.subgraph_boxes![0]).toMatchObject({ id: 'Payments' });
    const invoice = layout.nodes.find(node => node.id === 'Invoice');
    expect(invoice!.style).toMatchObject({ fill: 'teal' });
  });

  it('renders kanban tickets and pie showData tables', () => {
    const kanban = layoutFor([
      'kanban',
      '  Todo',
      '    task1@{ ticket: ENG-42 }',
    ].join('\n'));
    const board = kanban.kanban_board!;
    const labels = board.columns.flatMap(column => column.tasks.map(task => task.label));
    expect(labels.some(label => label.includes('ENG-42'))).toBe(true);

    const pie = layoutFor('pie showData\n  "A" : 70\n  "B" : 30');
    expect(pie.pie_show_data).toBe(true);
    expect(pie.dimensions.width).toBeGreaterThan(420);
  });

  it('renders mindmap icons as fontawesome labels', () => {
    const layout = layoutFor('mindmap\n  root\n    book[Book]\n    ::icon(fa fa-book)');
    const book = layout.nodes.find(node => node.label.includes('Book'));
    expect(book!.label).toContain('fa:fa-book');
  });

  it('expands gantt durations across excluded days', () => {
    // 2026-01-01 is a Thursday; a 5-working-day task with weekends excluded
    // spans 7 calendar days (Jan 1-2 work, 3-4 excluded, 5-7 work).
    const plain = layoutFor('gantt\n  dateFormat YYYY-MM-DD\n  T : 2026-01-01, 5d');
    const excluded = layoutFor('gantt\n  dateFormat YYYY-MM-DD\n  excludes weekends\n  T : 2026-01-01, 5d');
    const plainWidth = plain.nodes[0]!.bounds.width;
    const excludedWidth = excluded.nodes[0]!.bounds.width;
    expect(excludedWidth).toBeGreaterThan(plainWidth * 1.3);
  });

  it('renders pie titles through the layout payload', () => {
    const layout = layoutFor('pie title Deployment\n  "Pass" : 80\n  "Fail" : 20');
    expect(layout.pie_title).toBe('Deployment');
  });
});
