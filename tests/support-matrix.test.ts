import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, * as wasmPkg from '../pkg/xmermaid_wasm.js';
import {
  analyzeSupport,
  detectUnsupportedFeatures,
  getDiagramSupport,
  getSupportMatrix,
} from '../src/index';
import { XMermaid } from '../src/xmermaid';
import { LIGHT_THEME } from '../src/types/theme';
import { __setWasmModuleLoaderForTests } from '../src/wasm';
import { XMermaidError } from '../src/types/error';

beforeAll(async () => {
  await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  __setWasmModuleLoaderForTests(async () => wasmPkg as never);
});

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

    expect(analyzeSupport('graph TD; A[Start]; classDef hot fill:url(#gradient); class A hot').unsupportedFeatures).toEqual(expect.arrayContaining([
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
    ]));
    expect(flowchart?.supportedSyntax.map(item => item.id)).toEqual(expect.arrayContaining([
      'flowchart.subgraph-containers',
      'flowchart.inlineClass',
      'flowchart.linkStyle',
      'flowchart.expandedShape',
      'flowchart.htmlLabel',
      'flowchart.markdownLabel',
      'flowchart.edgeId',
    ]));
    expect(flowchart?.supportedSyntax.map(item => item.id)).toContain('flowchart.fontAwesomeLabel');
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

  it('renders sequence create/destroy lifecycle without unsupported diagnostics', () => {
    expect(analyzeSupport('sequenceDiagram\n  create participant Worker\n  Worker->>Boss: hello\n  destroy Worker')).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: [],
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

  it('reports sectioned user journey tasks as fully supported', () => {
    expect(analyzeSupport('journey\n  section Explore\n    Find product: 5: Buyer')).toMatchObject({
      diagramType: 'user-journey', status: 'supported', unsupportedFeatures: [],
    });
  });

  it('reports period/event timelines as partial instead of planned', () => {
    expect(analyzeSupport('timeline\n  2025 : Global launch')).toMatchObject({ diagramType: 'timeline', status: 'partial', unsupportedFeatures: [] });
  });

  it('reports dated Gantt tasks as fully supported', () => {
    expect(analyzeSupport('gantt\n  section Build\n  Compile : 2026-07-28, 2d')).toMatchObject({
      diagramType: 'gantt', status: 'supported', unsupportedFeatures: [],
    });
  });

  it('reports numeric Pie slices as fully supported', () => {
    expect(analyzeSupport('pie title Deployment\n  "Passed" : 80\n  "Failed" : 20')).toMatchObject({
      diagramType: 'pie', status: 'supported', unsupportedFeatures: [],
    });
  });
  it('renders categorical XY chart series without support warnings', () => {
    expect(analyzeSupport('xychart-beta\n  title "Revenue"\n  x-axis [Q1, Q2]\n  y-axis "USD" 0 --> 100\n  bar [20, 40]\n  line [30, 50]')).toMatchObject({
      diagramType: 'xychart', status: 'partial', unsupportedFeatures: [],
    });
  });
  it('accepts numeric XY x-axes without support warnings', () => {
    expect(analyzeSupport('xychart-beta\n  x-axis 0 --> 100\n  y-axis 0 --> 100\n  line [20, 40]')).toMatchObject({
      diagramType: 'xychart',
      status: 'partial',
      unsupportedFeatures: [],
    });
  });
  it('reports indented Mindmap nodes as partial instead of planned', () => {
    expect(analyzeSupport('mindmap\n  Root\n    Child')).toMatchObject({ diagramType: 'mindmap', status: 'partial', unsupportedFeatures: [] });
  });

  it('accepts the documented mindmap icon spellings without flagging them', () => {
    for (const spelling of ['fa fa-book', 'fa:fa-book', 'fa-book', 'book']) {
      const source = `mindmap\n  Root\n    ::icon(${spelling})\n    Child`;
      expect(analyzeSupport(source).unsupportedFeatures, `icon spelling ${spelling}`).toEqual([]);
    }
    expect(analyzeSupport('mindmap\n  Root\n    ::icon(fa fa-unknown-icon)\n    Child').unsupportedFeatures).toEqual([
      expect.objectContaining({ id: 'mindmap.advanced', severity: 'warning' }),
    ]);
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

  it('supports Radar graticule shapes while blocking configuration', () => {
    expect(analyzeSupport('radar-beta\n  axis A, B, C\n  curve c{1, 2, 3}\n  graticule polygon\n---\nconfig:\n  radar:\n    curveTension: 0.1')).toMatchObject({
      diagramType: 'radar',
      status: 'partial',
      unsupportedFeatures: expect.arrayContaining([
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
      '  classDef important fill:url(#x)',
      '  style A stroke-width:big',
      '  style B fill:#fff',
      '  click A callback',
      '  C[<b>HTML</b>]',
      '  D["`Markdown`"]',
    ].join('\n'));

    // HTML and Markdown labels sanitize to plain text and are no longer
    // flagged; unsafe styling and click callbacks still are.
    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.class',
      'flowchart.classDef',
      'flowchart.style',
      'flowchart.click',
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
    expect(features[3]).toMatchObject({
      id: 'flowchart.click',
      severity: 'warning',
      range: {
        startLine: 7,
        startColumn: 3,
      },
    });
  });

  it('renders stadium and cylinder shapes without unsupported diagnostics', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A([Stadium])',
      '  B[(Database)]',
    ].join('\n'));

    expect(features).toEqual([]);
  });

  it('renders edge endings and inline labels while accepting edge IDs', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A<-->B',
      '  C--oD',
      '  E--xF',
      '  G-- inline label -->H',
      '  I e1@-->J',
    ].join('\n'));

    // Edge IDs parse and are dropped; the whole source is now flag-free.
    expect(features).toEqual([]);
  });

  it('renders thick and extended edges while flagging unsafe style directives', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A@{ shape: cloud }',
      '  B===C',
      '  D----E',
      '  F===>G',
      '  H:::hot-->I',
      '  linkStyle 0 stroke:url(#evil)',
    ].join('\n'));

    // Expanded shapes are validated by the parser itself; only the unsafe
    // linkStyle value is flagged by the support analyzer.
    expect(features.map(feature => feature.id)).toEqual([
      'flowchart.style',
    ]);
    expect(features).toEqual(features.map(() => expect.objectContaining({
      severity: 'error',
      range: expect.objectContaining({ startLine: 7 }),
    })));
  });

  it('accepts every safe linkStyle index and stroke-width / dasharray form', () => {
    // Regression: the linkStyle index regex was built from a template literal
    // where a bare `\d` collapsed to the letter `d`, so every numeric index
    // was rejected as an unsafe `flowchart.style` error and blocked the whole
    // diagram. Safe values must render clean; the parser already applies them.
    const safeSources = [
      '  linkStyle 0 stroke:#ff0000',
      '  linkStyle 0 stroke:#ff3',
      '  linkStyle 0 stroke-width:2',
      '  linkStyle 0 stroke-width:2px',
      '  linkStyle 0 stroke-dasharray:5 5',
      '  linkStyle default stroke:#00f',
      '  linkStyle 0,1 stroke:#000',
    ];
    for (const statement of safeSources) {
      const features = detectUnsupportedFeatures(['flowchart TD', '  A --> B', statement].join('\n'));
      expect(features, statement).toEqual([]);
    }
  });

  it('still rejects unsafe stroke-width and dasharray values', () => {
    const unsafeSources = [
      '  style A stroke-width:abc',
      '  style A stroke-width:2p',
      '  classDef c stroke-dasharray:calc(1)',
      '  linkStyle 0 stroke-width:auto',
    ];
    for (const statement of unsafeSources) {
      const features = detectUnsupportedFeatures(['flowchart TD', '  A --> B', statement].join('\n'));
      expect(features.length, statement).toBeGreaterThan(0);
      expect(features[0]!.severity, statement).toBe('error');
    }
  });

  it('renders quoted labels and entity codes while allowing FontAwesome labels', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  A["Quoted"]',
      '  A[#35;]',
      '  B[fa:fa-car Text]',
    ].join('\n'));

    expect(features).toEqual([]);
  });

  it('renders edges that target subgraph ids as container connections', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  subgraph one [One]',
      '    A[Start]',
      '  end',
      '  A --> one',
    ].join('\n'));

    expect(features).toEqual([]);
  });

  it('renders hyphenated node ids as single nodes', () => {
    const features = detectUnsupportedFeatures([
      'flowchart TD',
      '  my-node-->B',
    ].join('\n'));

    expect(features).toEqual([]);
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

/**
 * Render contract: every capability the support matrix advertises as
 * `supported` must actually render through the real WASM pipeline. A
 * representative source per capability is fed to `XMermaid.renderToSVGElement`;
 * a throw or a blocking diagnostic is a "claims support but throws"
 * regression, which is exactly what the matrix/behaviour audit is meant to
 * eliminate (see docs/ai-syntax-support-plan.md §4 / T04).
 */
const SUPPORT_RENDER_SAMPLES: Record<string, string> = {
  // flowchart
  'flowchart::flowchart.basic-graph': 'flowchart TD\n  A --> B',
  'flowchart::flowchart.basic-edges': 'flowchart TD\n  A --> B\n  B -.-> C\n  C ==> D',
  'flowchart::flowchart.basic-labels': 'flowchart TD\n  A[Start] -->|go| B[End]',
  'flowchart::flowchart.basic-shapes': 'flowchart TD\n  A[rect]\n  B(rounded)\n  C([stadium])\n  D[(db)]\n  E((circle))\n  F{{hex}}',
  'flowchart::flowchart.classDef': 'flowchart TD\n  A --> B\n  classDef hot fill:#ff0000,stroke:#990000,color:#ffffff\n  class A hot',
  'flowchart::flowchart.class': 'flowchart TD\n  A --> B\n  classDef hot fill:#f00\n  class A hot',
  'flowchart::flowchart.style': 'flowchart TD\n  A --> B\n  style A fill:#f9f,stroke:#333',
  'flowchart::flowchart.fontAwesomeLabel': 'flowchart TD\n  A[fa:fa-rocket Launch] --> B',
  'flowchart::flowchart.htmlLabel': 'flowchart TD\n  A["<b>bold</b>"] --> B',
  'flowchart::flowchart.markdownLabel': 'flowchart TD\n  A[`code`] --> B',
  'flowchart::flowchart.edgeId': 'flowchart TD\n  A e1@--> B',
  'flowchart::flowchart.quoted-edge-labels': 'flowchart TD\n  A -- "text" --> B',
  'flowchart::flowchart.edge-endings': 'flowchart TD\n  A o--o B\n  C x--x D',
  'flowchart::flowchart.inline-edge-labels': 'flowchart TD\n  A -- text --> B',
  'flowchart::flowchart.extended-length': 'flowchart TD\n  A ----> B',
  'flowchart::flowchart.chained-ampersand': 'flowchart TD\n  A & B --> C & D',
  'flowchart::flowchart.subgraph-containers': 'flowchart TD\n  subgraph one [One]\n    A[Start]\n  end\n  A --> one',
  'flowchart::flowchart.hyphenatedNodeId': 'flowchart TD\n  my-node --> B',
  'flowchart::flowchart.entityCodeLabel': 'flowchart TD\n  A[&#9829;] --> B',
  'flowchart::flowchart.inlineClass': 'flowchart TD\n  A:::cls --> B\n  classDef cls fill:#f00',
  'flowchart::flowchart.linkStyle': 'flowchart TD\n  A-->B\n  linkStyle 0 stroke:#f00',
  'flowchart::flowchart.expandedShape': 'flowchart TD\n  A@{ shape: stadium, label: "Start" }',
  'flowchart::flowchart.namedColors': 'flowchart TD\n  A --> B\n  style A fill:red,stroke:none',

  // sequence
  'sequence::sequence.participants': 'sequenceDiagram\n  participant A\n  actor B\n  A->>B: x',
  'sequence::sequence.message': 'sequenceDiagram\n  A->>B: hello',
  'sequence::sequence.activation': 'sequenceDiagram\n  A->>+B: req\n  B-->>-A: resp',
  'sequence::sequence.note': 'sequenceDiagram\n  A->>B: x\n  Note right of B: hi',
  'sequence::sequence.control': 'sequenceDiagram\n  loop every minute\n    A->>B: ping\n  end',
  'sequence::sequence.autonumber': 'sequenceDiagram\n  autonumber\n  A->>B: x',
  'sequence::sequence.rect': 'sequenceDiagram\n  rect rgb(235, 244, 255)\n    A->>B: x\n  end',
  'sequence::sequence.cross-ending': 'sequenceDiagram\n  A-xB: x',
  'sequence::sequence.async-ending': 'sequenceDiagram\n  A-)B: x',
  'sequence::sequence.lifecycle': 'sequenceDiagram\n  create participant W\n  W->>B: hello\n  destroy W',
  'sequence::sequence.box': 'sequenceDiagram\n  box Purple Team\n    participant A\n    participant B\n  end\n  A->>B: x',
  'sequence::sequence.bare-line': 'sequenceDiagram\n  A->B: x',
  'sequence::sequence.links': 'sequenceDiagram\n  A<<->>B: x',

  // class
  'class::class.definition': 'classDiagram\n  class Animal\n  class Duck',
  'class::class.members': 'classDiagram\n  class A {\n    +method()\n    +String name$\n  }',
  'class::class.relations': 'classDiagram\n  A <|-- B : extends',
  'class::class.namespaces': 'classDiagram\n  namespace ns {\n    class A\n  }\n  A --> B',
  'class::class.style': 'classDiagram\n  A --> B\n  style A fill:#f00,stroke:#333',
  'class::class.direction': 'classDiagram\n  direction TB\n  A --> B',

  // state
  'state::state.transition': 'stateDiagram-v2\n  Idle --> Running : start',
  'state::state.pseudostates': 'stateDiagram-v2\n  [*] --> A\n  A --> [*]',
  'state::state.composites': 'stateDiagram-v2\n  state Composite {\n    [*] --> X\n    X --> [*]\n  }',
  'state::state.pseudostate-glyphs': 'stateDiagram-v2\n  state c <<choice>>\n  A --> c\n  c --> B',
  'state::state.notes': 'stateDiagram-v2\n  A --> B\n  note right of A : hi',

  // er
  'er::er.relationship': 'erDiagram\n  A ||--o{ B : has',
  'er::er.attributes': 'erDiagram\n  A {\n    string id PK\n  }\n  A ||--|| B : r',

  // user-journey
  'user-journey::user-journey.scored-task': 'journey\n  section S\n    Task: 5: Actor',
  'user-journey::acc.accessibility': 'journey\n  accTitle: J\n  accDescr: D\n  section S\n    Task: 5: Actor',
  'user-journey::theme.init-directive': '%%{init: {\'theme\':\'dark\'}}%%\njourney\n  section S\n    Task: 5: Actor',

  // timeline
  'timeline::timeline.period-event': 'timeline\n  title T\n  2020 : Event',
  'timeline::timeline.sections': 'timeline\n  section S\n    2020 : A',
  'timeline::acc.accessibility': 'timeline\n  accTitle: T\n  accDescr: D\n  2020 : Event',

  // gantt
  'gantt::gantt.dated-task': 'gantt\n  section S\n    Task :done, 2024-01-01, 30d',
  'gantt::gantt.states': 'gantt\n  section S\n    A :done, 2024-01-01, 3d\n    B :active, 2024-01-05, 3d\n    C :crit, 2024-01-10, 3d',
  'gantt::gantt.milestones': 'gantt\n  section S\n    Release :milestone, 2024-02-01, 0d',
  'gantt::gantt.dependencies': 'gantt\n  section S\n    A :2024-01-01, 3d\n    B :after A, 2d',
  'gantt::gantt.date-format': 'gantt\n  dateFormat YYYY-MM-DD\n  section S\n    Task :2024-01-01, 3d',
  'gantt::gantt.unix-date-format': 'gantt\n  dateFormat X\n  section S\n    Task :1700000000, 3d',
  'gantt::gantt.multi-dependency': 'gantt\n  section S\n    A :2024-01-01, 3d\n    B :2024-01-01, 3d\n    C :after A B, 2d',
  'gantt::gantt.excludes': 'gantt\n  excludes weekends\n  section S\n    Task :2024-01-01, 10d',
  'gantt::acc.accessibility': 'gantt\n  accTitle: T\n  accDescr: D\n  section S\n    Task :2024-01-01, 3d',
  'gantt::theme.init-directive': '%%{init: {\'theme\':\'dark\'}}%%\ngantt\n  section S\n    Task :2024-01-01, 3d',

  // pie
  'pie::pie.value': 'pie\n  "a" : 1\n  "b" : 2',
  'pie::pie.title': 'pie title Chart\n  "a" : 1',
  'pie::pie.showData': 'pie showData title C\n  "a" : 1',
  'pie::acc.accessibility': 'pie\n  accTitle: T\n  accDescr: D\n  "a" : 1',
  'pie::theme.init-directive': '%%{init: {\'theme\':\'dark\'}}%%\npie\n  "a" : 1',

  // mindmap
  'mindmap::mindmap.indent': 'mindmap\n  root((M))\n    A\n      A1',
  'mindmap::mindmap.shapes': 'mindmap\n  root((M))\n    A[Square]\n    B(Rounded)\n    C((Circle))',
  'mindmap::mindmap.icons': 'mindmap\n  root((M))\n    ::icon(fa fa-book) Docs',

  // requirement
  'requirement::requirement.block': 'requirementDiagram\n  requirement R {\n    id: 1\n    text: hi\n  }',
  'requirement::requirement.relationship': 'requirementDiagram\n  requirement A {\n    id: 1\n    text: a\n  }\n  requirement B {\n    id: 2\n    text: b\n  }\n  A - contains -> B',

  // gitgraph
  'gitgraph::gitgraph.commit': 'gitGraph\n  commit id: "v1" tag: "v1.0"',
  'gitgraph::gitgraph.branch-merge': 'gitGraph\n  commit id: "v1"\n  branch dev\n  checkout dev\n  commit id: "w"\n  checkout main\n  merge dev',
  'gitgraph::gitgraph.cherry-pick': 'gitGraph\n  commit id: "a"\n  branch d\n  checkout d\n  commit id: "b"\n  checkout main\n  cherry-pick id: "b"',

  // c4
  'c4::c4.element': 'C4Context\n  Person(u, "User")\n  System(s, "Sys")',
  'c4::c4.relationship': 'C4Context\n  Person(u, "User")\n  System(s, "Sys")\n  Rel(u, s, "uses")',
  'c4::c4.relationship-directions': 'C4Context\n  Person(u, "User")\n  System(s, "Sys")\n  Rel_Right(u, s, "uses")',
  'c4::c4.boundaries': 'C4Context\n  Enterprise_Boundary(b, "B") {\n    System(s, "S")\n  }',

  // zenuml
  'zenuml::zenuml.call': 'zenuml\n  A->B: hello',
  'zenuml::zenuml.return': 'zenuml\n  A->B: x\n  B-->A: y',
  'zenuml::zenuml.declarations': 'zenuml\n  participant A\n  A->B: x',

  // sankey
  'sankey::sankey.csv': 'sankey\nA,B,10\nB,C,5',
  'sankey::sankey.dag': 'sankey\nA,B,10\nB,C,5',
  'sankey::acc.accessibility': 'sankey\n  accTitle: T\n  accDescr: D\nA,B,10\nB,C,5',

  // quadrant
  'quadrant::quadrant.axes': 'quadrantChart\n  title T\n  x-axis a --> b\n  y-axis c --> d\n  quadrant-1 Q1\n  A: [0.3, 0.6]',
  'quadrant::quadrant.points': 'quadrantChart\n  A: [0.3, 0.6]',
  'quadrant::quadrant.point-styling': 'quadrantChart\n  A: [0.3, 0.6] radius: 10, color: #f00',
  'quadrant::quadrant.point-links': 'quadrantChart\n  A: [0.3, 0.6]\n  B: [0.7, 0.2]\n  A --> B',
  'quadrant::quadrant.classes': 'quadrantChart\n  classDef x fill:#f00\n  A: [0.3, 0.6]:::x',
  'quadrant::acc.accessibility': 'quadrantChart\n  accTitle: T\n  accDescr: D\n  A: [0.3, 0.6]',

  // xychart
  'xychart::xychart.categorical-axis': 'xychart-beta\n  x-axis [a, b]\n  y-axis 0 --> 10\n  bar [1, 2]',
  'xychart::xychart.numeric-axis': 'xychart-beta\n  x-axis [1, 2]\n  y-axis 0 --> 10\n  line [1, 2]',
  'xychart::xychart.horizontal': 'xychart-beta horizontal\n  x-axis [a, b]\n  y-axis 0 --> 10\n  bar [1, 2]',
  'xychart::xychart.axis-titles': 'xychart-beta\n  title "Latency"\n  x-axis [100, 200]\n  y-axis "ms" 0 --> 100\n  bar [1, 2]',
  'xychart::xychart.bar-line-series': 'xychart-beta\n  x-axis [a, b]\n  y-axis 0 --> 10\n  bar [1, 2]\n  line [2, 1]',
  'xychart::acc.accessibility': 'xychart-beta\n  accTitle: T\n  accDescr: D\n  x-axis [a]\n  y-axis 0 --> 10\n  bar [1]',

  // architecture
  'architecture::architecture.service': 'architecture-beta\n  service a(server)[A]',
  'architecture::architecture.relationship': 'architecture-beta\n  service a(server)[A]\n  service b(database)[B]\n  a:R --> L:b',
  'architecture::architecture.groups': 'architecture-beta\n  group g(system)[G]\n  service a(server)[A] in g',
  'architecture::architecture.junctions': 'architecture-beta\n  junction j\n  service a(server)[A]\n  a:R --> L:j',

  // block
  'block::block.grid': 'block-beta\n  columns 3\n  A B C',
  'block::block.relationship': 'block-beta\n  A\n  B\n  A --> B',

  // kanban
  'kanban::kanban.columns': 'kanban\n  done[A]\n    t1[Task]',
  'kanban::kanban.tasks': 'kanban\n  done[A]\n    t1[Task]',
  'kanban::kanban.tickets': 'kanban\n  todo[T]\n    task[X]@{ ticket: XM-1 }',
  'kanban::acc.accessibility': 'kanban\n  accTitle: T\n  accDescr: D\n  done[A]\n    t1[Task]',

  // treemap
  'treemap::treemap.hierarchy': 'treemap-beta\n"Root"\n    "Child": 10',
  'treemap::treemap.leaf-value': 'treemap-beta\n"Root"\n    "Child": 10',
  'treemap::acc.accessibility': 'treemap-beta\n  accTitle: T\n  accDescr: D\n"Root"\n    "Child": 10',

  // radar
  'radar::radar.axes': 'radar-beta\n  axis a, b, c\n  curve x{1, 2, 3}',
  'radar::radar.curves': 'radar-beta\n  axis a, b, c\n  curve x{1, 2, 3}',
  'radar::radar.range': 'radar-beta\n  axis a, b, c\n  curve x{1, 2, 3}\n  min 0\n  max 5',
  'radar::radar.graticule': 'radar-beta\n  axis a, b, c\n  curve x{1, 2, 3}\n  graticule circle\n  ticks 4',
  'radar::acc.accessibility': 'radar-beta\n  accTitle: T\n  accDescr: D\n  axis a, b, c\n  curve x{1, 2, 3}',

  // packet
  'packet::packet.bit-range': 'packet\n  64-127: "Payload"',
  'packet::packet.sequential-width': 'packet\n  +8: "A"',
  'packet::packet.title': 'packet\n  title T\n  +8: "A"',
  'packet::acc.accessibility': 'packet\n  accTitle: T\n  accDescr: D\n  +8: "A"',

  // venn
  'venn::venn.set': 'venn-beta\n  set A\n  set B',
  'venn::venn.union': 'venn-beta\n  set A\n  set B\n  union A,B["AB"]',
  'venn::venn.title': 'venn-beta\n  title "T"\n  set A\n  set B',
  'venn::acc.accessibility': 'venn-beta\n  accTitle: T\n  accDescr: D\n  set A\n  set B',

  // swimlanes
  'swimlanes::swimlanes.basic-lanes': 'swimlane-beta LR\n  subgraph A\n    x[X]\n  end\n  subgraph B\n    y[Y]\n  end\n  x --> y',
  'swimlanes::swimlanes.nodes': 'swimlane-beta LR\n  subgraph A\n    x[X]\n  end\n  subgraph B\n    y[Y]\n  end\n  x --> y',
  'swimlanes::swimlanes.edges': 'swimlane-beta LR\n  subgraph A\n    x[X]\n  end\n  subgraph B\n    y[Y]\n  end\n  x -->|go| y',
  'swimlanes::acc.accessibility': 'swimlane-beta LR\n  accTitle: T\n  accDescr: D\n  subgraph A\n    x[X]\n  end\n  subgraph B\n    y[Y]\n  end\n  x --> y',

  // treeview
  'treeview::treeview.indent': 'tree\n  Root\n    Child',
  'treeview::acc.accessibility': 'tree\n  accTitle: T\n  accDescr: D\n  Root\n    Child',

  // ishikawa
  'ishikawa::ishikawa.indent': 'ishikawa-beta\n  Effect\n  Category\n    Cause',
  'ishikawa::acc.accessibility': 'ishikawa-beta\n  accTitle: T\n  accDescr: D\n  Effect\n  Category\n    Cause',

  // event-modeling
  'event-modeling::event-modeling.timeframe': 'eventmodeling\n  tf 01 ui A\n  tf 02 cmd B',
  'event-modeling::event-modeling.entities': 'eventmodeling\n  tf 01 ui A\n  tf 02 cmd B\n  tf 03 evt C',
  'event-modeling::acc.accessibility': 'eventmodeling\n  accTitle: T\n  accDescr: D\n  tf 01 ui A',

  // wardley
  'wardley::wardley.components': 'wardley-beta\nanchor A [0.9, 0.8]\ncomponent B [0.5, 0.5]',
  'wardley::wardley.dependencies': 'wardley-beta\nanchor A [0.9, 0.8]\ncomponent B [0.5, 0.5]\nA -> B',
  'wardley::wardley.title': 'wardley-beta\ntitle T\nanchor A [0.9, 0.8]',
  'wardley::acc.accessibility': 'wardley-beta\n  accTitle: T\n  accDescr: D\nanchor A [0.9, 0.8]',

  // cynefin
  'cynefin::cynefin.domains': 'cynefin-beta\nclear\n"a"',
  'cynefin::cynefin.transitions': 'cynefin-beta\nclear\n"a"\ncomplex\n"b"\nclear --> complex : "x"',
  'cynefin::cynefin.title': 'cynefin-beta\ntitle T\nclear\n"a"',
  'cynefin::acc.accessibility': 'cynefin-beta\n  accTitle: T\n  accDescr: D\nclear\n"a"',
};

describe('support matrix render contract', () => {
  const renderer = new XMermaid({ container: document.createElement('div') });

  async function renderOutcome(source: string): Promise<{ ok: boolean; errorCode: string | null; message: string }> {
    try {
      await renderer.renderToSVGElement(source, { theme: LIGHT_THEME });
      return { ok: true, errorCode: null, message: '' };
    } catch (error) {
      return {
        ok: false,
        errorCode: error instanceof XMermaidError ? error.code : null,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  it('provides a representative render sample for every advertised supported capability', () => {
    const missing: string[] = [];
    for (const entry of getSupportMatrix().entries) {
      if (entry.status === 'planned') continue;
      for (const capability of entry.supportedSyntax) {
        if (capability.status !== 'supported') continue;
        const key = `${entry.diagramType}::${capability.id}`;
        if (SUPPORT_RENDER_SAMPLES[key] === undefined) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  const cases = Object.entries(SUPPORT_RENDER_SAMPLES).map(([key, source]) => ({ key, source }));

  it.each(cases)('$key renders through the real pipeline', async ({ key, source }) => {
    const outcome = await renderOutcome(source);
    expect(outcome.ok, `${key}: ${outcome.errorCode ?? ''} ${outcome.message}`.trim()).toBe(true);
  });
});
