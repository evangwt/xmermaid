import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';
import {
  analyzeFlowchartForVisualEdit,
  applyVisualEdit,
  flowchartAstToGraph,
  serializeFlowchart,
  validateVisualEditResult,
} from '../src/editor/flowchart';
import type { DiagramAst, FlowchartAst } from '../src/types/ast';

beforeAll(async () => {
  await initWasmPackage({
    module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm'),
  });
});

describe('visual flowchart real WASM roundtrip contract', () => {
  it('preserves supported shapes, edge styles, and labels after a visual rename', async () => {
    const source = [
      'flowchart TD',
      '  A(Start) ==>|yes| B{End}',
      '  B -.-> C((Done))',
    ].join('\n');

    const originalAst = parseFlowchartWithRealWasm(source);
    const nextModel = applyVisualEdit(flowchartAstToGraph(originalAst), {
      type: 'rename-node',
      nodeId: 'A',
      label: 'Begin',
    });
    const nextSource = serializeFlowchart(nextModel);
    const validation = await validateVisualEditResult(nextSource, realWasmVisualOptions);
    const nextAst = parseFlowchartWithRealWasm(nextSource);
    const layout = renderWithRealWasm(nextSource);

    expect(validation.status).toBe('applied');
    expect(findNode(nextAst, 'A')).toMatchObject({ label: 'Begin', shape: 'rounded' });
    expect(findNode(nextAst, 'B')).toMatchObject({ label: 'End', shape: 'diamond' });
    expect(findNode(nextAst, 'C')).toMatchObject({ label: 'Done', shape: 'circle' });
    expect(findEdge(nextAst, 'A', 'B')).toMatchObject({ style: 'thick', label: 'yes' });
    expect(findEdge(nextAst, 'B', 'C')).toMatchObject({ style: 'dotted', label: null });
    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(layout.edges.length).toBeGreaterThan(0);
  });

  it('blocks visual validation when real WASM parsing changes intended label semantics', async () => {
    const cases = [
      { source: 'flowchart TD\n  A(Start) --> B', label: 'Bad)' },
      { source: 'flowchart TD\n  A{Start} --> B', label: 'Bad}' },
      { source: 'flowchart TD\n  A((Start)) --> B', label: 'Bad))' },
      { source: 'flowchart TD\n  A[Start] --> B', label: 'Bad]' },
    ];
    for (const testCase of cases) {
      const originalAst = parseFlowchartWithRealWasm(testCase.source);
      const nextModel = applyVisualEdit(flowchartAstToGraph(originalAst), {
        type: 'rename-node',
        nodeId: 'A',
        label: testCase.label,
      });
      const nextSource = serializeFlowchart(nextModel);
      const validation = await validateVisualEditResult(nextSource, realWasmVisualOptions, nextModel);
      const parsedAst = parseFlowchartWithRealWasm(nextSource);

      expect(findNode(parsedAst, 'A').label).not.toBe(testCase.label);
      expect(validation).toEqual(expect.objectContaining({
        status: 'blocked',
        source: nextSource,
        model: null,
        diagnostics: [
          expect.objectContaining({
            code: 'visual_roundtrip_failed',
          }),
        ],
      }));
    }
  });

  it('keeps subgraph syntax roundtrippable after a visual rename', async () => {
    const source = [
      'flowchart TD',
      '  subgraph DecisionPath',
      '    A(Start) ==>|yes| B{End}',
      '  end',
    ].join('\n');

    const originalAst = parseFlowchartWithRealWasm(source);
    const nextModel = applyVisualEdit(flowchartAstToGraph(originalAst), {
      type: 'rename-node',
      nodeId: 'B',
      label: 'Done',
    });
    const nextSource = serializeFlowchart(nextModel);
    const validation = await validateVisualEditResult(nextSource, realWasmVisualOptions);
    const nextAst = parseFlowchartWithRealWasm(nextSource);
    const layout = renderWithRealWasm(nextSource);

    expect(validation.status).toBe('applied');
    expect(nextAst.subgraphs).toEqual([
      expect.objectContaining({ title: 'DecisionPath' }),
    ]);
    expect(findNode(nextAst, 'B')).toMatchObject({ label: 'Done', shape: 'diamond' });
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  it('roundtrips explicit source direction edits through real WASM parse and render', async () => {
    const source = 'flowchart TD\n  A --> B';
    const originalAst = parseFlowchartWithRealWasm(source);
    const nextModel = applyVisualEdit(flowchartAstToGraph(originalAst), {
      type: 'set-direction',
      direction: 'LR',
    });
    const nextSource = serializeFlowchart(nextModel);
    const validation = await validateVisualEditResult(nextSource, realWasmVisualOptions);
    const nextAst = parseFlowchartWithRealWasm(nextSource);
    const layout = renderWithRealWasm(nextSource);

    expect(validation.status).toBe('applied');
    expect(nextAst.direction).toBe('LR');
    expect(layout.nodes.length).toBeGreaterThan(0);
  });

  it('blocks unsupported classDef syntax before producing a visual rewrite', async () => {
    const analysis = await analyzeFlowchartForVisualEdit([
      'flowchart TD',
      '  A --> B',
      '  classDef hot fill:#fff',
    ].join('\n'), { parseDsl: parseWithRealWasm });

    expect(analysis.capability).toBe('read-only');
    expect(analysis.model).toBeNull();
    expect(analysis.diagnostics).toEqual([
      expect.objectContaining({
        code: 'visual_unsupported_syntax',
        range: expect.objectContaining({ startLine: 3 }),
      }),
    ]);
  });

  it('does not add a generic class read-only diagnostic to a specific class syntax error', async () => {
    const analysis = await analyzeFlowchartForVisualEdit([
      'flowchart TD',
      '  A --> B',
      '  classDef hot fill:red',
      '  class A hot',
    ].join('\n'));

    expect(analysis).toMatchObject({
      capability: 'read-only',
      model: null,
    });
    expect(analysis.diagnostics).toEqual([
      expect.objectContaining({
        code: 'visual_unsupported_syntax',
        message: expect.stringContaining('three- or six-digit hexadecimal values'),
      }),
    ]);
  });

  it('keeps class keywords inside labels editable', async () => {
    const analysis = await analyzeFlowchartForVisualEdit('flowchart TD\n  A[hello; class A hot]', {
      parseDsl: parseWithRealWasm,
    });

    expect(analysis).toEqual(expect.objectContaining({
      capability: 'editable',
      diagnostics: [],
    }));
  });

  it('keeps class keywords inside asymmetric labels editable', async () => {
    const analysis = await analyzeFlowchartForVisualEdit('flowchart TD\n  A>hello; classDef hot fill:#f00]', {
      parseDsl: parseWithRealWasm,
    });

    expect(analysis).toEqual(expect.objectContaining({
      capability: 'editable',
      diagnostics: [],
    }));
  });

  it('keeps class keywords inside pipe edge labels editable', async () => {
    const analysis = await analyzeFlowchartForVisualEdit('flowchart TD\n  A-->|Issue; classDef hot fill:#f00|B', {
      parseDsl: parseWithRealWasm,
    });

    expect(analysis).toEqual(expect.objectContaining({
      capability: 'editable',
      diagnostics: [],
    }));
  });

  it('blocks visual edits when multi-character arrows precede class styles', async () => {
    const analysis = await analyzeFlowchartForVisualEdit('flowchart TD\n  A-->>B\n  classDef hot fill:#f00\n  class A hot', {
      parseDsl: parseWithRealWasm,
    });

    expect(analysis).toEqual(expect.objectContaining({
      capability: 'read-only',
      model: null,
      diagnostics: [expect.objectContaining({ code: 'visual_unsupported_syntax' })],
    }));
  });

  it('blocks visual edits when class styles follow labels with unmatched literal openers', async () => {
    const analysis = await analyzeFlowchartForVisualEdit('flowchart TD\n  A[Review (draft] --> B\n  classDef hot fill:#f00\n  class A hot', {
      parseDsl: parseWithRealWasm,
    });

    expect(analysis).toEqual(expect.objectContaining({
      capability: 'read-only',
      model: null,
      diagnostics: [expect.objectContaining({ code: 'visual_unsupported_syntax' })],
    }));
  });

  it('fails closed for unterminated labels before producing a partial visual model', async () => {
    for (const statement of [
      'A[unterminated',
      'A(unterminated',
      'A{unterminated',
      'A>unterminated',
      '>unterminated',
      'A-->|unterminated',
    ]) {
      const analysis = await analyzeFlowchartForVisualEdit([
        'flowchart TD',
        `  ${statement}`,
        '  classDef hot fill:#f00',
        '  class A hot',
      ].join('\n'), { parseDsl: parseWithRealWasm });

      expect(analysis).toEqual(expect.objectContaining({
        capability: 'read-only',
        model: null,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'visual_unsupported_syntax',
            message: expect.stringContaining('unterminated'),
          }),
        ]),
      }));
    }
  });

  it('keeps Unicode class keyword prefixes editable as node ids', async () => {
    for (const source of [
      'flowchart TD\n  classé --> B',
      'flowchart TD\n  classDef中 --> B',
      'flowchart TD\n  class\u0345 --> B',
      'flowchart TD\n  classDef\u0345 --> B',
    ]) {
      await expect(analyzeFlowchartForVisualEdit(source, realWasmVisualOptions))
        .resolves.toEqual(expect.objectContaining({
          capability: 'editable',
          diagnostics: [],
        }));
    }
  });

  it('blocks inline class declarations that the visual model cannot preserve', async () => {
    const source = 'flowchart TD\n  A[Styled] classDef hot fill:#f00\n  B class A hot';

    await expect(analyzeFlowchartForVisualEdit(source, realWasmVisualOptions))
      .resolves.toEqual(expect.objectContaining({
        capability: 'read-only',
        model: null,
      }));
  });

  it('fails closed when the parsed AST contains class styling', async () => {
    const styledSource = 'flowchart TD\n  A\n  classDef hot fill:#f00\n  class A hot';
    const options = {
      ...realWasmVisualOptions,
      parseDsl: () => parseWithRealWasm(styledSource),
    };

    await expect(analyzeFlowchartForVisualEdit('flowchart TD\n  A', options))
      .resolves.toEqual(expect.objectContaining({
        capability: 'read-only',
        model: null,
      }));
    await expect(validateVisualEditResult('flowchart TD\n  A', options))
      .resolves.toEqual(expect.objectContaining({
        status: 'blocked',
        model: null,
      }));
  });

  it('reports non-flowchart class syntax as unsupported instead of flowchart read-only', async () => {
    const analysis = await analyzeFlowchartForVisualEdit('classDiagram\n  class Account', {
      parseDsl: parseWithRealWasm,
    });

    expect(analysis).toEqual(expect.objectContaining({
      capability: 'unsupported',
      diagnostics: [expect.objectContaining({
        message: 'Visual editing only supports flowchart sources, received class.',
      })],
    }));
  });

  it('blocks parser-unsupported visual shape syntax before accepting a lossy roundtrip', async () => {
    for (const [shape, expectedSyntax] of [
      ['stadium', 'A([Start])'],
      ['cylinder', 'A[(Start)]'],
    ] as const) {
      const source = serializeFlowchart({
        direction: 'TD',
        nodes: [
          { id: 'A', label: 'Start', shape },
        ],
        edges: [],
        subgraphs: [],
      });

      expect(source).toContain(expectedSyntax);

      await expect(validateVisualEditResult(source, realWasmVisualOptions))
        .resolves.toEqual(expect.objectContaining({
          status: 'blocked',
          diagnostics: [
            expect.objectContaining({
              code: 'visual_unsupported_syntax',
              range: expect.objectContaining({ startLine: 2 }),
            }),
          ],
        }));
    }
  });
});

function parseWithRealWasm(source: string): string {
  return parseDsl(source);
}

const realWasmVisualOptions = {
  parseDsl: parseWithRealWasm,
  renderDsl: renderWithRealWasm,
};

function parseFlowchartWithRealWasm(source: string): FlowchartAst {
  const ast = JSON.parse(parseWithRealWasm(source)) as DiagramAst;
  expect(ast.type).toBe('flowchart');
  return ast as FlowchartAst;
}

function renderWithRealWasm(source: string): { nodes: unknown[]; edges: unknown[] } {
  return renderWithConfig(source, null) as { nodes: unknown[]; edges: unknown[] };
}

function findNode(ast: FlowchartAst, id: string): FlowchartAst['nodes'][number] {
  const node = ast.nodes.find(item => item.id === id);
  expect(node, `expected node ${id}`).toBeDefined();
  return node!;
}

function findEdge(ast: FlowchartAst, from: string, to: string): FlowchartAst['edges'][number] {
  const edge = ast.edges.find(item => item.from === from && item.to === to);
  expect(edge, `expected edge ${from}->${to}`).toBeDefined();
  return edge!;
}
