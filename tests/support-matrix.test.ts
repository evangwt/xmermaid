import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeSupport,
  detectUnsupportedFeatures,
  getDiagramSupport,
  getSupportMatrix,
} from '../src/index';

interface FlowchartClassContractCase {
  name: string;
  valid: boolean;
  diagnosticId?: 'flowchart.class' | 'flowchart.classDef';
  lines: string[];
}

const flowchartClassContract = JSON.parse(readFileSync(
  resolve(process.cwd(), 'tests/fixtures/flowchart-class-contract.json'),
  'utf8',
)) as FlowchartClassContractCase[];

describe('support matrix production contract', () => {
  it.each(flowchartClassContract)('matches the shared Flowchart class contract: $name', ({
    diagnosticId,
    lines,
    valid,
  }) => {
    const classDiagnostics = analyzeSupport(lines.join('\n')).unsupportedFeatures
      .filter(feature => feature.id === 'flowchart.class' || feature.id === 'flowchart.classDef');

    if (valid) {
      expect(classDiagnostics).toEqual([]);
      return;
    }

    expect(classDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: diagnosticId, severity: 'error' }),
    ]));
  });

  it('reports the package version from the build-time source of truth', () => {
    const packageVersion = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')).version;

    expect(getSupportMatrix().version).toBe(packageVersion);
  });

  it('allows the safe Flowchart classDef/class subset while rejecting unsafe declarations', () => {
    const valid = [
      'graph TD',
      '  A[Start] --> B[Finish]',
      '  classDef hot fill:#ff0000,stroke:#990000,color:#ffffff',
      '  class A,B hot',
    ].join('\n');
    const invalid = [
      'graph TD',
      '  A[Start]',
      '  classDef hot fill:url(javascript:alert(1))',
      '  class A hot',
    ].join('\n');

    expect(analyzeSupport(valid).unsupportedFeatures).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef' }),
      expect.objectContaining({ id: 'flowchart.class' }),
    ]));
    expect(getDiagramSupport('flowchart')?.supportedSyntax.map(item => item.id)).toEqual(expect.arrayContaining([
      'flowchart.classDef',
      'flowchart.class',
    ]));
    expect(analyzeSupport(invalid).unsupportedFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'flowchart.classDef',
        severity: 'error',
      }),
    ]));
    expect(analyzeSupport('graph TD\n  A[Start]\n  click A "https://example.com"').unsupportedFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.click', severity: 'warning' }),
    ]));

    const semicolonAndTab = 'graph TD; A-->B; classDef\thot\tfill:#ff0000; class\tA\thot';
    expect(analyzeSupport(semicolonAndTab).unsupportedFeatures).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef' }),
      expect.objectContaining({ id: 'flowchart.class' }),
    ]));

    const spacedClassList = analyzeSupport('graph TD\n  A --> B\n  classDef TD fill:#ff0000\n  class A , B TD').unsupportedFeatures;
    expect(spacedClassList).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef' }),
    ]));
    expect(spacedClassList).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.class' }),
    ]));

    const numericClassName = analyzeSupport('graph TD\n  A\n  classDef 1hot fill:#ff0000\n  class A 1hot').unsupportedFeatures;
    expect(numericClassName).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef' }),
      expect.objectContaining({ id: 'flowchart.class' }),
    ]));
    expect(analyzeSupport('graph TD\n  A\n  classDef class fill:#ff0000\n  class A class').unsupportedFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef', severity: 'error' }),
    ]));

    expect(analyzeSupport('graph TD; A[Start]; classDef hot fill:red; class A hot').unsupportedFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'flowchart.classDef',
        severity: 'error',
      }),
    ]));

    for (const source of [
      'graph TD\n  A[hello; classDef hot fill:#f00]',
      'graph TD\n  A[hello; class A hot]',
      'graph TD\n  A[hello]\n  %% classDef hot fill:#f00; class A hot',
      'graph TD\n  A[Review (draft] --> B\n  classDef hot fill:#f00\n  class A hot',
      'graph TD\n  A>hello; classDef hot fill:#f00]',
      'graph TD\n  A-->|Issue; classDef hot fill:#f00|B',
    ]) {
      const classFeatures = analyzeSupport(source).unsupportedFeatures;
      expect(classFeatures).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'flowchart.classDef' })]));
      expect(classFeatures).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'flowchart.class' })]));
    }

    expect(analyzeSupport('graph TD; A[Start]; classDef hot fill:#fff; stroke:#000; class A hot').unsupportedFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef', severity: 'error' }),
    ]));
  });

  it('treats Unicode keyword prefixes as node ids', () => {
    for (const source of [
      'flowchart TD\n  classé --> B',
      'flowchart TD\n  classDef中 --> B',
      'flowchart TD\n  class\u0345 --> B',
      'flowchart TD\n  classDef\u0345 --> B',
    ]) {
      const features = analyzeSupport(source).unsupportedFeatures;
      expect(features).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'flowchart.class' }),
      ]));
      expect(features).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'flowchart.classDef' }),
      ]));
    }
  });

  it('matches the parser ASCII whitespace contract for class styles', () => {
    const nonBreakingSpaces = analyzeSupport([
      'flowchart TD',
      '  A',
      '  classDef\u00a0hot\u00a0fill:#fff',
      '  class\u00a0A\u00a0hot',
    ].join('\n')).unsupportedFeatures;

    expect(nonBreakingSpaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef', severity: 'error' }),
      expect.objectContaining({ id: 'flowchart.class', severity: 'error' }),
    ]));

    expect(analyzeSupport([
      'flowchart TD',
      '  A',
      '  classDef hot fill:# fff',
      '  class A hot',
    ].join('\n')).unsupportedFeatures).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.classDef' }),
      expect.objectContaining({ id: 'flowchart.class' }),
    ]));
  });

  it('rejects unterminated Flowchart labels without hiding later statements', () => {
    for (const statement of [
      'A[unterminated',
      'A(unterminated',
      'A{unterminated',
      'A>unterminated',
      '>unterminated',
      'A-->|unterminated',
    ]) {
      const source = [
        'flowchart TD',
        `  ${statement}`,
        '  classDef hot fill:#f00',
        '  class A hot',
      ].join('\n');

      expect(analyzeSupport(source).unsupportedFeatures).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'flowchart.unterminatedLabel',
          severity: 'error',
        }),
      ]));
    }

    expect(analyzeSupport([
      'flowchart TD',
      '  A[First line',
      '  second line]',
      '  classDef hot fill:#f00',
      '  class A hot',
    ].join('\n')).unsupportedFeatures).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flowchart.unterminatedLabel' }),
    ]));
  });

  it('publishes flowchart as partial support instead of claiming full Mermaid compatibility', () => {
    const matrix = getSupportMatrix();
    const flowchart = getDiagramSupport('flowchart');

    expect(matrix.version).toBeTypeOf('string');
    expect(matrix.entries.length).toBeGreaterThan(0);
    expect(flowchart).toMatchObject({
      diagramType: 'flowchart',
      status: 'partial',
    });
    expect(flowchart?.unsupportedSyntax.map(item => item.id)).toEqual(expect.arrayContaining([
      'flowchart.click',
      'flowchart.htmlLabel',
      'flowchart.quotedLabel',
      'flowchart.entityCodeLabel',
      'flowchart.fontAwesomeLabel',
      'flowchart.edgeToSubgraph',
      'flowchart.hyphenatedNodeId',
    ]));
    expect(matrix.entries).toHaveLength(30);
    expect(matrix.entries.find(item => item.diagramType === 'sequence')?.status).toBe('partial');
    expect(matrix.entries.filter(item => !['flowchart', 'swimlanes', 'treeview', 'ishikawa', 'event-modeling', 'wardley', 'cynefin', 'sequence', 'class', 'state', 'er', 'user-journey', 'gantt', 'pie', 'quadrant', 'mindmap', 'timeline', 'requirement', 'gitgraph', 'c4', 'zenuml', 'sankey', 'xychart', 'architecture', 'block', 'packet', 'kanban', 'treemap', 'radar', 'venn'].includes(item.diagramType)).every(item => item.status === 'planned')).toBe(true);
  });

  it('reports flowchart, sequence, Sankey, and Quadrant sources as partial while planned diagrams stay explicit', () => {
    expect(getSupportMatrix().mermaidVersion).toBe('11.16.0');
    expect(analyzeSupport('graph TD\n  A-->B')).toMatchObject({
      diagramType: 'flowchart',
      status: 'partial',
      unsupportedFeatures: [],
    });

    expect(analyzeSupport('sequenceDiagram\n  A->>B: Hi')).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: [],
    });

    expect(analyzeSupport('zenuml\n  Alice->Bob: Authenticate\n  Bob-->Alice: Token')).toMatchObject({
      diagramType: 'zenuml',
      status: 'partial',
      unsupportedFeatures: [],
    });

    expect(analyzeSupport('xychart-beta\n  x-axis [Q1, Q2]\n  y-axis 0 --> 100\n  bar [20, 40]\n  line [30, 50]')).toMatchObject({
      diagramType: 'xychart',
      status: 'partial',
      unsupportedFeatures: [],
    });

    expect(analyzeSupport('sankey\nA,B,8\nB,C,8')).toMatchObject({
      diagramType: 'sankey',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(analyzeSupport('quadrantChart\n  Campaign A: [0.25, 0.75]')).toMatchObject({
      diagramType: 'quadrant', status: 'partial', unsupportedFeatures: [],
    });

    expect(analyzeSupport('architecture-beta\nservice db(database)[Database]\nservice api(server)[API]\ndb:R --> L:api')).toMatchObject({
      diagramType: 'architecture',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(analyzeSupport('block-beta\n  columns 3\n  A B C\n  Wide:2 D\n  A --> B')).toMatchObject({
      diagramType: 'block',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(analyzeSupport('kanban\n  todo[To do]\n    write[Write documentation]\n  done[Done]')).toMatchObject({
      diagramType: 'kanban',
      status: 'partial',
      unsupportedFeatures: [],
    });

    expect(analyzeSupport('treemap-beta\n"Category A"\n    "Item A1": 10\n    "Item A2": 20')).toMatchObject({
      diagramType: 'treemap',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(analyzeSupport('radar-beta\n  axis food["Food Quality"], service["Service"], price["Price"]\n  curve a["Restaurant A"]{4, 3, 2}\n  min 0\n  max 5')).toMatchObject({
      diagramType: 'radar',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(analyzeSupport('packet\n  +16: "Source Port"\n  16-31: "Destination Port"')).toMatchObject({
      diagramType: 'packet',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(analyzeSupport('swimlane-beta LR\n  subgraph Customer\n    request[Request]\n  end')).toMatchObject({
      diagramType: 'swimlanes',
      status: 'partial',
      unsupportedFeatures: [],
    });
  });

  it('allows implemented sequence activations, notes, and control blocks into the WASM render path', () => {
    expect(analyzeSupport('sequenceDiagram\n  Alice->>+Bob: Request\n  Note right of Bob: Validate\n  alt Accepted\n    Bob-->>-Alice: Response\n  else Rejected\n    Bob-->>Alice: Denied\n  end')).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: [],
    });
  });

  it('allows document sequence numbering, RGB frames, and cross-ended messages into the WASM render path', () => {
    const source = [
      'sequenceDiagram',
      '  autonumber',
      '  participant EventBus',
      '  participant CraneJob',
      '  rect rgb(255, 235, 235)',
      '    EventBus--xCraneJob: Drop Stop',
      '  end',
    ].join('\n');

    expect(analyzeSupport(source)).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: [],
    });
    expect(getDiagramSupport('sequence')?.supportedSyntax.map(item => item.id)).toEqual(expect.arrayContaining([
      'sequence.autonumber',
      'sequence.rect',
      'sequence.cross-ending',
    ]));
  });

  it('keeps invalid RGB sequence frames fail-closed before the parser', () => {
    expect(analyzeSupport('sequenceDiagram\n  rect rgb(256, 0, 0)\n    A->>B: Invalid')).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({
          id: 'sequence.advanced',
          severity: 'error',
        }),
      ]),
    });
  });

  it('keeps unimplemented sequence lifecycle statements fail-closed', () => {
    expect(analyzeSupport('sequenceDiagram\n  create participant Worker\n  destroy Worker')).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({
          id: 'sequence.advanced',
          severity: 'error',
          message: 'Sequence create/destroy, box, links, and advanced autonumber or rect syntax are not supported yet.',
        }),
      ]),
    });
  });

  it('accepts explicit sequence participants and actors while retaining other capability boundaries', () => {
    expect(analyzeSupport([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Payments as Payment service',
      '  actor User',
      '  User->>Payments: Sign in',
    ].join('\n'))).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: [],
    });
  });

  it('surfaces advanced ZenUML syntax before the WASM render path', () => {
    expect(analyzeSupport('zenuml\n  Alice->Bob: Authenticate {\n    return Token\n  }')).toMatchObject({
      diagramType: 'zenuml',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({
          id: 'zenuml.advanced',
          severity: 'error',
          range: expect.objectContaining({ startLine: 2, startColumn: 3 }),
        }),
      ]),
    });
  });

  it('reports the initial class subset as partial instead of planned', () => {
    expect(analyzeSupport('classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck')).toMatchObject({
      diagramType: 'class',
      status: 'partial',
      unsupportedFeatures: [],
    });
  });

  it('reports basic state transitions as partial instead of planned', () => {
    expect(analyzeSupport('stateDiagram-v2\n  Idle --> Running : start')).toMatchObject({
      diagramType: 'state',
      status: 'partial',
      unsupportedFeatures: [],
    });
  });

  it('reports basic ER relationships as partial instead of planned', () => {
    expect(analyzeSupport('erDiagram\n  CUSTOMER ||--o{ ORDER : places')).toMatchObject({
      diagramType: 'er', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports sectioned user journey tasks as partial instead of planned', () => {
    expect(analyzeSupport('journey\n  section Explore\n    Find product: 5: Buyer')).toMatchObject({
      diagramType: 'user-journey', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports period/event timelines as partial instead of planned', () => {
    expect(analyzeSupport('timeline\n  2025 : Global launch')).toMatchObject({ diagramType: 'timeline', status: 'partial', unsupportedFeatures: [] });
  });

  it('reports dated Gantt tasks as partial instead of planned', () => {
    expect(analyzeSupport('gantt\n  section Build\n  Compile : 2026-07-28, 2d')).toMatchObject({
      diagramType: 'gantt', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports numeric Pie slices as partial instead of planned', () => {
    expect(analyzeSupport('pie title Deployment\n  "Passed" : 80\n  "Failed" : 20')).toMatchObject({
      diagramType: 'pie', status: 'partial', unsupportedFeatures: [],
    });
  });
  it('reports categorical XY chart series as partial instead of planned', () => {
    expect(analyzeSupport('xychart-beta\n  title "Revenue"\n  x-axis [Q1, Q2]\n  y-axis "USD" 0 --> 100\n  bar [20, 40]\n  line [30, 50]')).toMatchObject({
      diagramType: 'xychart', status: 'partial', unsupportedFeatures: [],
    });
  });
  it('surfaces numeric XY x-axes before the WASM render path', () => {
    expect(analyzeSupport('xychart-beta\n  x-axis 0 --> 100\n  y-axis 0 --> 100\n  line [20, 40]')).toMatchObject({
      diagramType: 'xychart',
      status: 'partial',
      unsupportedFeatures: [expect.objectContaining({ id: 'xychart.numericXAxis', severity: 'error' })],
    });
  });
  it('reports indented Mindmap nodes as partial instead of planned', () => {
    expect(analyzeSupport('mindmap\n  Root\n    Child')).toMatchObject({ diagramType: 'mindmap', status: 'partial', unsupportedFeatures: [] });
  });

  it('reports indented Ishikawa causes as partial instead of planned', () => {
    expect(analyzeSupport('ishikawa-beta\n  Blurry photo\n  Process\n    Out of focus')).toMatchObject({
      diagramType: 'ishikawa', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports documented Event Modeling time frames as partial instead of planned', () => {
    expect(analyzeSupport('eventmodeling\n  tf 01 ui CartUI\n  tf 02 cmd AddItem')).toMatchObject({
      diagramType: 'event-modeling', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports coordinate-based Wardley maps as partial instead of planned', () => {
    expect(analyzeSupport('wardley-beta\n  title Tea shop value chain\n  anchor Business [0.95, 0.63]\n  component Tea [0.63, 0.81]\n  Business -> Tea')).toMatchObject({
      diagramType: 'wardley', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports core Cynefin domains and transitions as partial instead of planned', () => {
    expect(analyzeSupport('cynefin-beta\ntitle Incident Response\ncomplex\n"Investigate root cause"\nclear\n"Restart service"\ncomplex --> clear : "Pattern identified"')).toMatchObject({
      diagramType: 'cynefin', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('blocks Cynefin configuration and styles outside the native fixed-domain subset', () => {
    expect(analyzeSupport('cynefin-beta\ncomplex\n"Investigate"\n---\nconfig:\n  cynefin:\n    curve: 0.5\nclassDef accent fill:#7c3aed')).toMatchObject({
      diagramType: 'cynefin', status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'cynefin.advanced', severity: 'error', range: expect.objectContaining({ startLine: 4 }) }),
        expect.objectContaining({ id: 'cynefin.advanced', severity: 'error', range: expect.objectContaining({ startLine: 5 }) }),
        expect.objectContaining({ id: 'cynefin.advanced', severity: 'error', range: expect.objectContaining({ startLine: 7 }) }),
      ]),
    });
  });

  it('blocks advanced Wardley syntax before the WASM render path', () => {
    expect(analyzeSupport('wardley-beta\n  component Tea [0.63, 0.81]\n  evolve Tea 0.8')).toMatchObject({
      diagramType: 'wardley',
      status: 'partial',
      unsupportedFeatures: [expect.objectContaining({ id: 'wardley.advanced', severity: 'error', range: expect.objectContaining({ startLine: 3 }) })],
    });
  });

  it('reports requirement blocks and semantic relationships as partial instead of planned', () => {
    expect(analyzeSupport('requirementDiagram\n  requirement Login {\n    text: User must log in\n  }\n  functionalRequirement Authenticate {\n    text: Validate credentials\n  }\n  Login - satisfies -> Authenticate')).toMatchObject({
      diagramType: 'requirement', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports GitGraph commits, branches, and merges as partial instead of planned', () => {
    expect(analyzeSupport('gitGraph\n  commit id: "ZERO"\n  branch develop\n  checkout develop\n  commit id: "FEATURE"\n  checkout main\n  merge develop id: "RELEASE"')).toMatchObject({
      diagramType: 'gitgraph', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('reports basic C4 elements and relationships as partial instead of planned', () => {
    expect(analyzeSupport('C4Context\n  Person(customer, "Customer")\n  System(banking, "Internet Banking")\n  Rel(customer, banking, "Uses")')).toMatchObject({
      diagramType: 'c4', status: 'partial', unsupportedFeatures: [],
    });
  });

  it('keeps groups and alignment directives outside the Architecture subset', () => {
    expect(analyzeSupport('architecture-beta\n  group api(cloud)[API]\n  service db(database)[Database] in api\n  service server(server)[Server] in api\n  db:R --> L:server\n  align row db server')).toMatchObject({
      diagramType: 'architecture',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'architecture.advanced', severity: 'error' }),
      ]),
    });
  });

  it('keeps nested and styled block syntax outside the native grid subset', () => {
    expect(analyzeSupport('block-beta\n  columns 2\n  A["One"] B\n  block:group\n  class A important')).toMatchObject({
      diagramType: 'block',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'block.advanced', severity: 'error' }),
      ]),
    });
  });

  it('keeps Kanban task metadata and configuration outside the native subset', () => {
    expect(analyzeSupport('kanban\n  todo[To do]\n    task[Write docs]@{ priority: \'High\' }')).toMatchObject({
      diagramType: 'kanban',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'kanban.advanced', severity: 'error' }),
      ]),
    });
  });

  it('blocks Treemap styling and configuration that the native subset cannot render', () => {
    expect(analyzeSupport('treemap-beta\n---\nconfig:\n  padding: 8\n"Category A":::accent\n    "Item A1": 10\nclassDef accent fill:#7c3aed')).toMatchObject({
      diagramType: 'treemap',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'treemap.advanced', severity: 'error', range: expect.objectContaining({ startLine: 2 }) }),
        expect.objectContaining({ id: 'treemap.advanced', severity: 'error', range: expect.objectContaining({ startLine: 5 }) }),
        expect.objectContaining({ id: 'treemap.advanced', severity: 'error', range: expect.objectContaining({ startLine: 7 }) }),
      ]),
    });
  });

  it('blocks Radar graticules and configuration outside the native curve subset', () => {
    expect(analyzeSupport('radar-beta\n  axis A, B, C\n  curve c{1, 2, 3}\n  graticule polygon\n---\nconfig:\n  radar:\n    curveTension: 0.1')).toMatchObject({
      diagramType: 'radar',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'radar.advanced', severity: 'error', range: expect.objectContaining({ startLine: 4 }) }),
        expect.objectContaining({ id: 'radar.advanced', severity: 'error', range: expect.objectContaining({ startLine: 5 }) }),
      ]),
    });
  });

  it('blocks Packet styling and configuration outside the native bit-field subset', () => {
    expect(analyzeSupport('packet\n---\nconfig:\n  bitsPerRow: 16\n+16: "Source Port":::accent\nclassDef accent fill:#7c3aed')).toMatchObject({
      diagramType: 'packet',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
        expect.objectContaining({ id: 'packet.advanced', severity: 'error', range: expect.objectContaining({ startLine: 2 }) }),
        expect.objectContaining({ id: 'packet.advanced', severity: 'error', range: expect.objectContaining({ startLine: 5 }) }),
      ]),
    });
  });

  it('reports unknown sources as unsupported with a structured diagram feature', () => {
    expect(analyzeSupport('not a diagram')).toMatchObject({
      diagramType: 'unknown',
      status: 'unsupported',
      unsupportedFeatures: [
        expect.objectContaining({
          id: 'diagram.unknown',
          severity: 'error',
          range: expect.objectContaining({
            startLine: 1,
            startColumn: 1,
            endLine: 1,
          }),
        }),
      ],
    });
  });

  it('detects unsupported flowchart syntax with line and column ranges', () => {
    const features = detectUnsupportedFeatures([
      'graph TD',
      '  A[Start] --> B[End]',
      '  class A important extra',
      '  classDef important fill:red',
      '  style A fill:#fff',
      '  click A callback',
      '  C[<b>HTML</b>]',
      '  D["`Markdown`"]',
    ].join('\n'));

    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.class',
      'flowchart.classDef',
      'flowchart.style',
      'flowchart.click',
      'flowchart.htmlLabel',
      'flowchart.markdownLabel',
    ]);
    expect(features[0]).toMatchObject({
      id: 'flowchart.class',
      severity: 'error',
      range: {
        startLine: 3,
        startColumn: 3,
        endLine: 3,
        endColumn: 26,
      },
    });
    expect(features[4].range).toMatchObject({
      startLine: 7,
      startColumn: 3,
    });
  });

  it('detects flowchart shape syntaxes that the Rust parser cannot roundtrip', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A([Stadium])',
      '  B[(Database)]',
    ].join('\n'));

    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.stadiumShape',
      'flowchart.cylinderShape',
    ]);
    expect(features[0]).toMatchObject({
      severity: 'error',
      range: expect.objectContaining({ startLine: 2, startColumn: 3 }),
    });
    expect(features[1]).toMatchObject({
      severity: 'error',
      range: expect.objectContaining({ startLine: 3, startColumn: 3 }),
    });
  });

  it('detects unsupported flowchart edge syntaxes that the Rust parser misparses', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A<-->B',
      '  C--oD',
      '  E--xF',
      '  G-- inline label -->H',
      '  I e1@-->J',
    ].join('\n'));

    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.bidirectionalEdge',
      'flowchart.circleEdge',
      'flowchart.crossEdge',
      'flowchart.inlineEdgeLabel',
      'flowchart.edgeId',
    ]);
    expect(features).toEqual(features.map((feature, index) => expect.objectContaining({
      severity: 'error',
      range: expect.objectContaining({ startLine: index + 2 }),
    })));
  });

  it('detects additional lossy flowchart syntaxes documented by Rust parser coverage', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A@{ shape: cloud }',
      '  B===C',
      '  D----E',
      '  F===>G',
      '  H:::hot-->I',
      '  linkStyle 0 stroke:#ff3',
    ].join('\n'));

    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.expandedShape',
      'flowchart.thickLineEdge',
      'flowchart.extendedLineEdge',
      'flowchart.extendedThickEdge',
      'flowchart.inlineClass',
      'flowchart.linkStyle',
    ]);
    expect(features).toEqual(features.map((feature, index) => expect.objectContaining({
      severity: 'error',
      range: expect.objectContaining({ startLine: index + 2 }),
    })));
  });

  it('detects unsupported special label syntaxes that the Rust parser preserves literally', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A["Quoted"]',
      '  A[#35;]',
      '  B[fa:fa-car Text]',
    ].join('\n'));

    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.quotedLabel',
      'flowchart.entityCodeLabel',
      'flowchart.fontAwesomeLabel',
    ]);
    expect(features).toEqual(features.map((feature, index) => expect.objectContaining({
      severity: 'warning',
      range: expect.objectContaining({ startLine: index + 2 }),
    })));
  });

  it('detects unsupported edges that target a subgraph id as compound edges', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A-->sub1',
      '  subgraph sub1',
      '    B-->C',
      '  end',
    ].join('\n'));

    expect(features).toEqual([
      expect.objectContaining({
        id: 'flowchart.edgeToSubgraph',
        severity: 'error',
        range: expect.objectContaining({ startLine: 2 }),
      }),
    ]);
  });

  it('detects unsupported hyphenated node ids before they split into wrong nodes', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  my-node-->B',
      '  A-->next-node',
    ].join('\n'));

    expect(features).toEqual([
      expect.objectContaining({
        id: 'flowchart.hyphenatedNodeId',
        severity: 'error',
        range: expect.objectContaining({ startLine: 2 }),
      }),
      expect.objectContaining({
        id: 'flowchart.hyphenatedNodeId',
        severity: 'error',
        range: expect.objectContaining({ startLine: 3 }),
      }),
    ]);
  });

  it('returns no unsupported features for a basic supported flowchart', () => {
    expect(detectUnsupportedFeatures('flowchart LR\n  A[Start] --> B[End]')).toEqual([]);
  });

  it('reports flowchart declarations with invalid directions before the parser fails', () => {
    const report = analyzeSupport('graph XXX\n  A-->B');

    expect(report).toMatchObject({
      diagramType: 'flowchart',
      status: 'partial',
      unsupportedFeatures: [
        expect.objectContaining({
          id: 'flowchart.invalidDirection',
          severity: 'error',
          range: expect.objectContaining({
            startLine: 1,
            startColumn: 1,
            endLine: 1,
          }),
        }),
      ],
    });
  });

  it('keeps package metadata and README aligned with the support matrix', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { description: string };
    const readme = readFileSync('README.md', 'utf8');

    expect(packageJson.description).toMatch(/flowchart/i);
    expect(packageJson.description).toMatch(/partial/i);
    expect(packageJson.description).not.toMatch(/fully compatible|complete mermaid/i);

    expect(readme).toMatch(/flowchart/i);
    expect(readme).toMatch(/partial mermaid support/i);
    expect(readme).toMatch(/sequenceDiagram/i);
    expect(readme).toMatch(/unsupported/i);
  });
});
