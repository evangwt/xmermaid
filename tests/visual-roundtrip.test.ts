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
