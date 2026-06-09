import { getWasm, initWasm } from '../wasm';
import { detectUnsupportedFeatures as defaultDetectUnsupportedFeatures, type UnsupportedFeature } from '../support';
import type { SourceRange } from '../types/diagnostics';
import type { DiagramAst, EdgeStyle, FlowchartAst, NodeShape, Subgraph } from '../types/ast';

export type FlowchartGraphDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export interface FlowchartGraphNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface FlowchartGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
  min_length: number;
}

export interface FlowchartGraphModel {
  direction: FlowchartGraphDirection;
  nodes: FlowchartGraphNode[];
  edges: FlowchartGraphEdge[];
  subgraphs: Subgraph[];
}

export type VisualSourceCapability = 'editable' | 'read-only' | 'unsupported';

export interface VisualEditDiagnostic {
  code:
    | 'visual_unsupported_syntax'
    | 'visual_roundtrip_failed'
    | 'visual_parse_failed'
    | 'visual_render_failed';
  message: string;
  severity: 'warning' | 'error';
  range: SourceRange | null;
}

export interface VisualSourceAnalysis {
  capability: VisualSourceCapability;
  model: FlowchartGraphModel | null;
  diagnostics: VisualEditDiagnostic[];
}

export interface VisualEditApplyResult {
  status: 'applied' | 'blocked';
  source: string;
  model: FlowchartGraphModel | null;
  diagnostics: VisualEditDiagnostic[];
}

export type FlowchartDslParser = (source: string) => string | Promise<string>;
export type FlowchartDslRenderer = (source: string) => unknown | Promise<unknown>;
export type VisualUnsupportedFeatureDetector = (source: string) => UnsupportedFeature[];

export interface VisualFlowchartParseOptions {
  parseDsl?: FlowchartDslParser;
  renderDsl?: FlowchartDslRenderer;
  detectUnsupportedFeatures?: VisualUnsupportedFeatureDetector;
}

export type VisualEdit =
  | { type: 'rename-node'; nodeId: string; label: string }
  | { type: 'add-node'; nodeId: string; label: string }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'add-edge'; from: string; to: string; label?: string }
  | { type: 'remove-edge'; edgeId: string }
  | { type: 'set-direction'; direction: FlowchartGraphModel['direction'] };

const HEADER_PATTERN = /^\s*(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i;
const EDGE_PATTERN = /^\s*([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?\s*--(?:\|([^|]*)\|)?[>-](?:\|([^|]*)\|)?\s*([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?\s*$/;
const NODE_PATTERN = /^\s*([A-Za-z0-9_-]+)(?:\[([^\]]*)\])?\s*$/;

export function parseFlowchartToGraph(source: string): FlowchartGraphModel {
  const lines = source.split(/\r?\n/);
  const header = lines.find(line => HEADER_PATTERN.test(line));
  const direction = (header?.match(HEADER_PATTERN)?.[1]?.toUpperCase() ?? 'TD') as FlowchartGraphDirection;
  const nodes = new Map<string, FlowchartGraphNode>();
  const edges: FlowchartGraphEdge[] = [];

  for (const line of lines) {
    if (!line.trim() || HEADER_PATTERN.test(line)) continue;

    const edgeMatch = line.match(EDGE_PATTERN);
    if (edgeMatch) {
      const [, from, fromLabel, labelBeforeArrow, labelAfterArrow, to, toLabel] = edgeMatch;
      const label = labelBeforeArrow ?? labelAfterArrow;
      upsertNode(nodes, from, fromLabel);
      upsertNode(nodes, to, toLabel);
      edges.push({
        id: edgeId(from, to, edges.length),
        from,
        to,
        ...(label ? { label } : {}),
        style: 'arrow',
        min_length: 1,
      });
      continue;
    }

    const nodeMatch = line.match(NODE_PATTERN);
    if (nodeMatch) {
      upsertNode(nodes, nodeMatch[1], nodeMatch[2]);
    }
  }

  return {
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs: [],
  };
}

export function flowchartAstToGraph(ast: FlowchartAst): FlowchartGraphModel {
  return {
    direction: ast.direction as FlowchartGraphDirection,
    nodes: ast.nodes.map(node => ({
      id: node.id,
      label: node.label ?? node.id,
      shape: node.shape,
    })),
    edges: ast.edges.map((edge, index) => ({
      id: edgeId(edge.from, edge.to, index),
      from: edge.from,
      to: edge.to,
      ...(edge.label ? { label: edge.label } : {}),
      style: edge.style,
      min_length: edge.min_length,
    })),
    subgraphs: cloneSubgraphs(ast.subgraphs),
  };
}

export async function analyzeFlowchartForVisualEdit(
  source: string,
  options: VisualFlowchartParseOptions = {},
): Promise<VisualSourceAnalysis> {
  const unsupportedDiagnostics = visualUnsupportedDiagnostics(source, options);
  if (unsupportedDiagnostics.length > 0) {
    return {
      capability: 'read-only',
      model: null,
      diagnostics: unsupportedDiagnostics,
    };
  }

  try {
    const ast = await parseDiagramAst(source, options);
    if (ast.type !== 'flowchart') {
      return {
        capability: 'unsupported',
        model: null,
        diagnostics: [visualDiagnostic(
          'visual_unsupported_syntax',
          `Visual editing only supports flowchart sources, received ${ast.type}.`,
        )],
      };
    }

    return {
      capability: 'editable',
      model: flowchartAstToGraph(ast),
      diagnostics: [],
    };
  } catch (error) {
    return {
      capability: 'read-only',
      model: null,
      diagnostics: [visualDiagnostic('visual_parse_failed', errorMessage(error))],
    };
  }
}

export async function validateVisualEditResult(
  nextSource: string,
  options: VisualFlowchartParseOptions = {},
  expectedModel?: FlowchartGraphModel,
): Promise<VisualEditApplyResult> {
  const unsupportedDiagnostics = visualUnsupportedDiagnostics(nextSource, options);
  if (unsupportedDiagnostics.length > 0) {
    return {
      status: 'blocked',
      source: nextSource,
      model: null,
      diagnostics: unsupportedDiagnostics,
    };
  }

  let ast: DiagramAst;
  try {
    ast = await parseDiagramAst(nextSource, options);
  } catch (error) {
    return {
      status: 'blocked',
      source: nextSource,
      model: null,
      diagnostics: [visualDiagnostic('visual_roundtrip_failed', errorMessage(error))],
    };
  }

  if (ast.type !== 'flowchart') {
    return {
      status: 'blocked',
      source: nextSource,
      model: null,
      diagnostics: [visualDiagnostic(
        'visual_unsupported_syntax',
        `Visual edit produced a non-flowchart source: ${ast.type}.`,
      )],
    };
  }

  const model = flowchartAstToGraph(ast);
  if (expectedModel && !flowchartModelsEqual(model, expectedModel)) {
    return {
      status: 'blocked',
      source: nextSource,
      model: null,
      diagnostics: [visualDiagnostic(
        'visual_roundtrip_failed',
        'Visual edit roundtrip changed parsed diagram semantics; source was not applied.',
      )],
    };
  }

  try {
    await renderDiagramLayout(nextSource, options);
  } catch (error) {
    return {
      status: 'blocked',
      source: nextSource,
      model: null,
      diagnostics: [visualDiagnostic('visual_render_failed', errorMessage(error))],
    };
  }

  return {
    status: 'applied',
    source: nextSource,
    model,
    diagnostics: [],
  };
}

export function applyVisualEdit(model: FlowchartGraphModel, edit: VisualEdit): FlowchartGraphModel {
  switch (edit.type) {
    case 'rename-node':
      return {
        ...model,
        nodes: model.nodes.map(node => node.id === edit.nodeId ? { ...node, label: edit.label } : node),
      };
    case 'add-node':
      if (model.nodes.some(node => node.id === edit.nodeId)) return cloneModel(model);
      return {
        ...model,
        nodes: [...model.nodes, { id: edit.nodeId, label: edit.label, shape: 'rect' }],
      };
    case 'remove-node':
      return {
        ...model,
        nodes: model.nodes.filter(node => node.id !== edit.nodeId),
        edges: model.edges.filter(edge => edge.from !== edit.nodeId && edge.to !== edit.nodeId),
        subgraphs: removeNodeFromSubgraphs(model.subgraphs, edit.nodeId),
      };
    case 'add-edge':
      return {
        ...model,
        edges: [...model.edges, {
          id: edgeId(edit.from, edit.to, model.edges.length),
          from: edit.from,
          to: edit.to,
          ...(edit.label ? { label: edit.label } : {}),
          style: 'arrow',
          min_length: 1,
        }],
      };
    case 'remove-edge':
      return {
        ...model,
        edges: model.edges.filter(edge => edge.id !== edit.edgeId),
      };
    case 'set-direction':
      return {
        ...model,
        direction: edit.direction,
      };
  }
}

export function serializeFlowchart(model: FlowchartGraphModel): string {
  const connected = new Set<string>();
  const declared = new Set<string>();
  const emittedEdges = new Set<string>();
  const lines = [`flowchart ${model.direction}`];

  for (const subgraph of model.subgraphs) {
    writeSubgraph(lines, model, subgraph, declared, connected, emittedEdges, '  ');
  }

  for (const edge of model.edges) {
    if (emittedEdges.has(edge.id)) continue;
    connected.add(edge.from);
    connected.add(edge.to);
    lines.push(`  ${formatEdge(model, edge, declared)}`);
  }

  const subgraphNodes = nodesInSubgraphs(model.subgraphs);
  for (const node of model.nodes) {
    if (!connected.has(node.id) && !subgraphNodes.has(node.id)) {
      lines.push(`  ${formatNodeRef(model, node.id, declared)}`);
    }
  }

  return lines.join('\n');
}

function upsertNode(nodes: Map<string, FlowchartGraphNode>, id: string, label?: string): void {
  const existing = nodes.get(id);
  if (existing) {
    if (label) existing.label = label;
    return;
  }
  nodes.set(id, { id, label: label ?? id, shape: 'rect' });
}

function formatNodeRef(model: FlowchartGraphModel, nodeId: string, declared: Set<string>): string {
  const node = model.nodes.find(item => item.id === nodeId);
  if (!node || declared.has(nodeId) || (node.label === node.id && node.shape === 'rect')) return nodeId;
  declared.add(nodeId);
  return formatNodeDeclaration(node);
}

function formatNodeDeclaration(node: FlowchartGraphNode): string {
  const label = escapeNodeLabel(node.label);
  if (node.shape === 'rect' && node.label === node.id) return node.id;

  switch (node.shape) {
    case 'rounded':
      return `${node.id}(${label})`;
    case 'circle':
      return `${node.id}((${label}))`;
    case 'double_circle':
      return `${node.id}(((${label})))`;
    case 'diamond':
      return `${node.id}{${label}}`;
    case 'hexagon':
      return `${node.id}{{${label}}}`;
    case 'stadium':
      return `${node.id}([${label}])`;
    case 'subroutine':
      return `${node.id}[[${label}]]`;
    case 'parallelogram':
      return `${node.id}[/${label}/]`;
    case 'trapezoid':
      return `${node.id}[\\${label}\\]`;
    case 'asymmetric':
      return `${node.id}>${label}]`;
    case 'cylinder':
      return `${node.id}[(${label})]`;
    case 'rect':
    default:
      return `${node.id}[${label.replace(/\]/g, '\\]')}]`;
  }
}

function formatEdge(model: FlowchartGraphModel, edge: FlowchartGraphEdge, declared: Set<string>): string {
  return `${formatNodeRef(model, edge.from, declared)} ${formatEdgeOperator(edge)} ${formatNodeRef(model, edge.to, declared)}`;
}

function formatEdgeOperator(edge: FlowchartGraphEdge): string {
  const operator = edgeOperator(edge.style);
  if (!edge.label) return operator;
  return `${operator}|${edge.label.replace(/\|/g, '\\|')}|`;
}

function edgeOperator(style: EdgeStyle): string {
  switch (style) {
    case 'line':
      return '---';
    case 'dotted':
      return '-.->';
    case 'thick':
      return '==>';
    case 'invisible':
      return '~~~';
    case 'arrow':
    default:
      return '-->';
  }
}

function writeSubgraph(
  lines: string[],
  model: FlowchartGraphModel,
  subgraph: Subgraph,
  declared: Set<string>,
  connected: Set<string>,
  emittedEdges: Set<string>,
  indent: string,
): void {
  lines.push(`${indent}subgraph ${subgraph.title}`);

  const subgraphNodeIds = nodesInSubgraphs([subgraph]);
  for (const edge of model.edges) {
    if (subgraphNodeIds.has(edge.from) && subgraphNodeIds.has(edge.to)) {
      connected.add(edge.from);
      connected.add(edge.to);
      emittedEdges.add(edge.id);
      lines.push(`${indent}  ${formatEdge(model, edge, declared)}`);
    }
  }

  for (const nodeId of subgraph.nodes) {
    if (!connected.has(nodeId)) {
      lines.push(`${indent}  ${formatNodeRef(model, nodeId, declared)}`);
    }
  }

  for (const child of subgraph.subgraphs) {
    writeSubgraph(lines, model, child, declared, connected, emittedEdges, `${indent}  `);
  }

  lines.push(`${indent}end`);
}

function nodesInSubgraphs(subgraphs: Subgraph[]): Set<string> {
  const nodes = new Set<string>();
  for (const subgraph of subgraphs) {
    for (const node of subgraph.nodes) {
      nodes.add(node);
    }
    for (const nested of nodesInSubgraphs(subgraph.subgraphs)) {
      nodes.add(nested);
    }
  }
  return nodes;
}

function escapeNodeLabel(label: string): string {
  return label.replace(/\\/g, '\\\\');
}

function edgeId(from: string, to: string, index: number): string {
  return `${from}-${to}-${index + 1}`;
}

function cloneModel(model: FlowchartGraphModel): FlowchartGraphModel {
  return {
    direction: model.direction,
    nodes: model.nodes.map(node => ({ ...node })),
    edges: model.edges.map(edge => ({ ...edge })),
    subgraphs: cloneSubgraphs(model.subgraphs),
  };
}

function cloneSubgraphs(subgraphs: Subgraph[]): Subgraph[] {
  return subgraphs.map(subgraph => ({
    title: subgraph.title,
    nodes: [...subgraph.nodes],
    subgraphs: cloneSubgraphs(subgraph.subgraphs),
  }));
}

function removeNodeFromSubgraphs(subgraphs: Subgraph[], nodeId: string): Subgraph[] {
  return subgraphs.map(subgraph => ({
    ...subgraph,
    nodes: subgraph.nodes.filter(node => node !== nodeId),
    subgraphs: removeNodeFromSubgraphs(subgraph.subgraphs, nodeId),
  }));
}

function flowchartModelsEqual(actual: FlowchartGraphModel, expected: FlowchartGraphModel): boolean {
  return JSON.stringify(normalizeModel(actual)) === JSON.stringify(normalizeModel(expected));
}

function normalizeModel(model: FlowchartGraphModel): FlowchartGraphModel {
  return {
    direction: model.direction,
    nodes: model.nodes
      .map(node => ({ id: node.id, label: node.label, shape: node.shape }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: model.edges.map(edge => ({
      id: '',
      from: edge.from,
      to: edge.to,
      ...(edge.label ? { label: edge.label } : {}),
      style: edge.style,
      min_length: edge.min_length,
    })),
    subgraphs: normalizeSubgraphs(model.subgraphs),
  };
}

function normalizeSubgraphs(subgraphs: Subgraph[]): Subgraph[] {
  return subgraphs.map(subgraph => ({
    title: subgraph.title,
    nodes: [...subgraph.nodes],
    subgraphs: normalizeSubgraphs(subgraph.subgraphs),
  }));
}

async function parseDiagramAst(
  source: string,
  options: VisualFlowchartParseOptions,
): Promise<DiagramAst> {
  const parseDsl = options.parseDsl ?? defaultParseDsl;
  const astJson = await parseDsl(source);
  return JSON.parse(astJson) as DiagramAst;
}

async function defaultParseDsl(source: string): Promise<string> {
  await initWasm();
  return getWasm().parse_dsl(source);
}

async function renderDiagramLayout(
  source: string,
  options: VisualFlowchartParseOptions,
): Promise<void> {
  const renderDsl = options.renderDsl ?? defaultRenderDsl;
  await renderDsl(source);
}

async function defaultRenderDsl(source: string): Promise<void> {
  await initWasm();
  getWasm().render_with_config(source, null);
}

function visualDiagnostic(code: VisualEditDiagnostic['code'], message: string): VisualEditDiagnostic {
  return {
    code,
    message,
    severity: 'error',
    range: null,
  };
}

function visualUnsupportedDiagnostics(
  source: string,
  options: VisualFlowchartParseOptions,
): VisualEditDiagnostic[] {
  const detectUnsupportedFeatures = options.detectUnsupportedFeatures ?? defaultDetectUnsupportedFeatures;
  return detectUnsupportedFeatures(source).map(feature => ({
    code: 'visual_unsupported_syntax',
    message: feature.message,
    severity: feature.severity,
    range: feature.range,
  }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
