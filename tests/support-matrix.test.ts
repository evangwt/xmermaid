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
    ]));
  });

  it('reports flowchart sources as partial and sequence diagrams as unsupported', () => {
    expect(analyzeSupport('graph TD\n  A-->B')).toMatchObject({
      diagramType: 'flowchart',
      status: 'partial',
      unsupportedFeatures: [],
    });

    expect(analyzeSupport('sequenceDiagram\n  A->>B: Hi')).toMatchObject({
      diagramType: 'sequence',
      status: 'unsupported',
      unsupportedFeatures: [
        expect.objectContaining({
          id: 'diagram.sequence',
          severity: 'error',
          range: expect.objectContaining({
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 16,
          }),
        }),
      ],
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
