import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  analyzeSupport,
  detectUnsupportedFeatures,
  getDiagramSupport,
  getSupportMatrix,
} from '../src/index';

describe('support matrix production contract', () => {
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
      'flowchart.class',
      'flowchart.classDef',
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
    expect(matrix.entries.filter(item => !['flowchart', 'sequence', 'class'].includes(item.diagramType)).every(item => item.status === 'planned')).toBe(true);
  });

  it('reports flowchart and sequence sources as partial while planned diagrams stay explicit', () => {
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

    expect(analyzeSupport('architecture-beta\nservice api(server)')).toMatchObject({
      diagramType: 'architecture',
      status: 'planned',
    });
  });

  it('surfaces unsupported sequence control syntax before the WASM render path', () => {
    expect(analyzeSupport('sequenceDiagram\n  activate Alice\n  Alice->>Bob: Hi')).toMatchObject({
      diagramType: 'sequence',
      status: 'partial',
      unsupportedFeatures: [
        expect.objectContaining({
          id: 'sequence.advanced',
          severity: 'error',
          range: expect.objectContaining({ startLine: 2, startColumn: 3 }),
        }),
      ],
    });
  });

  it('reports the initial class subset as partial instead of planned', () => {
    expect(analyzeSupport('classDiagram\n  class Animal\n  class Duck\n  Animal <|-- Duck')).toMatchObject({
      diagramType: 'class',
      status: 'partial',
      unsupportedFeatures: [],
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
      '  class A important',
      '  classDef important fill:#fff',
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
      severity: 'warning',
      range: {
        startLine: 3,
        startColumn: 3,
        endLine: 3,
        endColumn: 20,
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
