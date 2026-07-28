import {
  DIAGRAM_CATALOG,
  MERMAID_COMPATIBILITY_VERSION,
  detectDiagramType,
  type DetectedDiagramType,
  type DiagramType,
} from './diagram-catalog';

export type { DetectedDiagramType, DiagramType } from './diagram-catalog';

export type SupportStatus = 'supported' | 'partial' | 'unsupported';
export type DiagramSupportStatus = 'supported' | 'partial' | 'planned';

export type UnsupportedFeatureId =
  | `diagram.${DetectedDiagramType}`
  | 'flowchart.class'
  | 'flowchart.classDef'
  | 'flowchart.style'
  | 'flowchart.click'
  | 'flowchart.htmlLabel'
  | 'flowchart.markdownLabel'
  | 'flowchart.quotedLabel'
  | 'flowchart.entityCodeLabel'
  | 'flowchart.fontAwesomeLabel'
  | 'flowchart.invalidDirection'
  | 'flowchart.expandedShape'
  | 'flowchart.stadiumShape'
  | 'flowchart.cylinderShape'
  | 'flowchart.thickLineEdge'
  | 'flowchart.extendedLineEdge'
  | 'flowchart.extendedThickEdge'
  | 'flowchart.bidirectionalEdge'
  | 'flowchart.circleEdge'
  | 'flowchart.crossEdge'
  | 'flowchart.inlineEdgeLabel'
  | 'flowchart.edgeId'
  | 'flowchart.edgeToSubgraph'
  | 'flowchart.hyphenatedNodeId'
  | 'flowchart.inlineClass'
  | 'flowchart.linkStyle'
  | 'sequence.advanced'
  | 'class.advanced';

export interface SupportSourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface UnsupportedFeature {
  id: UnsupportedFeatureId;
  range: SupportSourceRange | null;
  severity: 'warning' | 'error';
  message: string;
}

export interface SyntaxCapability {
  id: string;
  label: string;
  status: SupportStatus;
  notes?: string;
}

export interface DiagramSupportEntry {
  diagramType: DiagramType;
  status: DiagramSupportStatus;
  supportedSyntax: SyntaxCapability[];
  unsupportedSyntax: SyntaxCapability[];
}

export interface SupportMatrix {
  version: string;
  mermaidVersion: typeof MERMAID_COMPATIBILITY_VERSION;
  entries: DiagramSupportEntry[];
}

export interface SupportReport {
  diagramType: DetectedDiagramType;
  status: DiagramSupportStatus | 'unsupported';
  message: string;
  unsupportedFeatures: UnsupportedFeature[];
}

const SUPPORT_MATRIX: SupportMatrix = {
  version: '0.1.0',
  mermaidVersion: MERMAID_COMPATIBILITY_VERSION,
  entries: [
    {
      diagramType: 'flowchart',
      status: 'partial',
      supportedSyntax: [
        { id: 'flowchart.basic-graph', label: 'graph/flowchart declarations', status: 'supported' },
        { id: 'flowchart.basic-edges', label: 'basic nodes and directed edges', status: 'supported' },
        { id: 'flowchart.basic-labels', label: 'square-bracket node labels and pipe edge labels', status: 'supported' },
        { id: 'flowchart.basic-shapes', label: 'core node shapes', status: 'partial' },
        { id: 'flowchart.subgraph-parse', label: 'subgraph parsing', status: 'partial' },
      ],
      unsupportedSyntax: [
        { id: 'flowchart.class', label: 'class assignments', status: 'unsupported' },
        { id: 'flowchart.classDef', label: 'class definitions', status: 'unsupported' },
        { id: 'flowchart.style', label: 'inline style statements', status: 'unsupported' },
        { id: 'flowchart.click', label: 'click callbacks and links', status: 'unsupported' },
        { id: 'flowchart.htmlLabel', label: 'HTML labels', status: 'unsupported' },
        { id: 'flowchart.markdownLabel', label: 'Markdown labels', status: 'unsupported' },
        { id: 'flowchart.quotedLabel', label: 'quoted labels', status: 'unsupported' },
        { id: 'flowchart.entityCodeLabel', label: 'HTML entity code labels', status: 'unsupported' },
        { id: 'flowchart.fontAwesomeLabel', label: 'FontAwesome icon labels', status: 'unsupported' },
        { id: 'flowchart.invalidDirection', label: 'invalid graph/flowchart directions', status: 'unsupported' },
        { id: 'flowchart.expandedShape', label: 'expanded shape syntax', status: 'unsupported' },
        { id: 'flowchart.stadiumShape', label: 'stadium shape syntax', status: 'unsupported' },
        { id: 'flowchart.cylinderShape', label: 'cylinder/database shape syntax', status: 'unsupported' },
        { id: 'flowchart.thickLineEdge', label: 'thick line edges without arrowheads', status: 'unsupported' },
        { id: 'flowchart.extendedLineEdge', label: 'extended line edges without arrowheads', status: 'unsupported' },
        { id: 'flowchart.extendedThickEdge', label: 'extended thick edge arrows', status: 'unsupported' },
        { id: 'flowchart.bidirectionalEdge', label: 'bidirectional edge arrows', status: 'unsupported' },
        { id: 'flowchart.circleEdge', label: 'circle edge endings', status: 'unsupported' },
        { id: 'flowchart.crossEdge', label: 'cross edge endings', status: 'unsupported' },
        { id: 'flowchart.inlineEdgeLabel', label: 'inline edge labels', status: 'unsupported' },
        { id: 'flowchart.edgeId', label: 'edge IDs', status: 'unsupported' },
        { id: 'flowchart.edgeToSubgraph', label: 'edges to subgraph ids', status: 'unsupported' },
        { id: 'flowchart.hyphenatedNodeId', label: 'hyphenated node ids', status: 'unsupported' },
        { id: 'flowchart.inlineClass', label: 'inline class assignments', status: 'unsupported' },
        { id: 'flowchart.linkStyle', label: 'linkStyle statements', status: 'unsupported' },
      ],
    },
    ...DIAGRAM_CATALOG
      .filter(([diagramType]) => diagramType !== 'flowchart')
      .map(([diagramType]) => diagramType === 'sequence'
        ? partialSequence()
        : diagramType === 'class'
          ? partialClass()
          : diagramType === 'state'
            ? partialState()
              : diagramType === 'er'
                ? partialEr()
                : diagramType === 'user-journey'
                  ? partialUserJourney()
                  : diagramType === 'timeline'
                    ? partialTimeline()
                  : diagramType === 'gantt'
                ? partialGantt()
                : diagramType === 'pie'
                  ? partialPie()
                  : diagramType === 'mindmap'
                    ? partialMindmap()
                    : diagramType === 'requirement'
                      ? partialRequirement()
                      : diagramType === 'gitgraph'
                        ? partialGitGraph()
                        : diagramType === 'c4'
                          ? partialC4()
          : planned(diagramType)),
  ],
};

export function getSupportMatrix(): SupportMatrix {
  return {
    version: SUPPORT_MATRIX.version,
    mermaidVersion: SUPPORT_MATRIX.mermaidVersion,
    entries: SUPPORT_MATRIX.entries.map(cloneEntry),
  };
}

export function getDiagramSupport(diagramType: DiagramType): DiagramSupportEntry | undefined {
  const entry = SUPPORT_MATRIX.entries.find(item => item.diagramType === diagramType);
  return entry ? cloneEntry(entry) : undefined;
}

export function analyzeSupport(source: string): SupportReport {
  const diagramType = detectDiagramType(source);
  const unsupportedFeatures = detectUnsupportedFeatures(source);
  const support = diagramType === 'unknown' ? undefined : getDiagramSupport(diagramType);
  if (!support) {
    return {
      diagramType,
      status: 'unsupported',
      message: 'Unknown diagram type is not supported yet.',
      unsupportedFeatures,
    };
  }

  return {
    diagramType,
    status: support.status,
    message: support.status === 'partial'
      ? 'Flowchart rendering has partial Mermaid support. Check the support matrix for unsupported syntax.'
      : unsupportedDiagramMessage(diagramType),
    unsupportedFeatures,
  };
}

export function detectUnsupportedFeatures(source: string): UnsupportedFeature[] {
  const diagramType = detectDiagramType(source);
  if (diagramType === 'sequence') {
    return detectUnsupportedSequenceFeatures(source);
  }
  if (diagramType === 'class') {
    return detectUnsupportedClassFeatures(source);
  }
  if (diagramType === 'state') return [];
  if (diagramType === 'er') return [];
  if (diagramType === 'gantt') return [];
  if (diagramType === 'pie') return [];
  if (diagramType === 'user-journey') return [];
  if (diagramType === 'timeline') return [];
  if (diagramType === 'mindmap') return [];
  if (diagramType === 'requirement') return [];
  if (diagramType === 'gitgraph') return [];
  if (diagramType === 'c4') return [];
  if (diagramType !== 'flowchart') {
    return [unsupportedDiagramFeature(source, diagramType)];
  }

  const features: UnsupportedFeature[] = [];
  const lines = linesWithRanges(source);
  const subgraphIds = collectSubgraphIds(lines);
  for (const line of lines) {
    const trimmed = line.text.trimStart();
    if (!trimmed) continue;

    if (/^(graph|flowchart)\b/i.test(trimmed) && !/^(graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i.test(trimmed)) {
      features.push(unsupportedSyntax(
        'flowchart.invalidDirection',
        line,
        'Flowchart declarations must use direction TD, TB, BT, LR, or RL.',
        'error',
      ));
      continue;
    }

    if (/\b[A-Za-z0-9_]+\(\[[^\]\r\n]*\]\)/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.stadiumShape',
        line,
        'Flowchart stadium shape syntax is not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\[\([^\)\r\n]*\)\]/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.cylinderShape',
        line,
        'Flowchart cylinder/database shape syntax is not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+@\{\s*shape\s*:/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.expandedShape',
        line,
        'Flowchart expanded shape syntax is not supported yet.',
        'error',
      ));
    }

    if (/\b[A-Za-z0-9_]+\s*={3,}\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.thickLineEdge',
        line,
        'Flowchart thick line edges without arrowheads are not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\s*-{4,}\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.extendedLineEdge',
        line,
        'Flowchart extended line edges without arrowheads are not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\s*={3,}>\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.extendedThickEdge',
        line,
        'Flowchart extended thick edge arrows are not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\s*<[-=.]+>\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.bidirectionalEdge',
        line,
        'Flowchart bidirectional edge arrows are not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\s*--o\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.circleEdge',
        line,
        'Flowchart circle edge endings are not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\s*--x\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.crossEdge',
        line,
        'Flowchart cross edge endings are not supported yet.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+\s*--\s+[^\s|<>\-\r\n][^-\r\n]*\s+--?>\s*[A-Za-z0-9_]+\b/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.inlineEdgeLabel',
        line,
        'Flowchart inline edge labels are not supported yet; use pipe-delimited edge labels.',
        'error',
      ));
    }
    if (/\b[A-Za-z0-9_]+@\s*(?:--|==|-\.)[->=.~]*/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.edgeId',
        line,
        'Flowchart edge IDs are not supported yet.',
        'error',
      ));
    }
    if (subgraphIds.size > 0 && edgeTouchesSubgraphId(line.text, subgraphIds)) {
      features.push(unsupportedSyntax(
        'flowchart.edgeToSubgraph',
        line,
        'Flowchart edges to subgraph ids are not supported yet.',
        'error',
      ));
    }
    if (edgeContainsHyphenatedNodeId(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.hyphenatedNodeId',
        line,
        'Flowchart hyphenated node ids are not supported yet.',
        'error',
      ));
    }

    if (/^classDef\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.classDef', line, 'Flowchart classDef statements are not supported yet.'));
    } else if (/^class\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.class', line, 'Flowchart class assignments are not supported yet.'));
    } else if (/^style\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.style', line, 'Flowchart style statements are not supported yet.'));
    } else if (/^click\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.click', line, 'Flowchart click callbacks and links are not supported yet.'));
    } else if (/^linkStyle\b/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'flowchart.linkStyle',
        line,
        'Flowchart linkStyle statements are not supported yet.',
        'error',
      ));
    }

    if (/\b[A-Za-z0-9_]+:::[A-Za-z0-9_-]+/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.inlineClass',
        line,
        'Flowchart inline class assignments are not supported yet.',
        'error',
      ));
    }

    if (/<\/?[A-Za-z][^>]*>/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.htmlLabel', line, 'Flowchart HTML labels are not supported yet.'));
    }
    if (/`[^`]+`/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.markdownLabel', line, 'Flowchart Markdown labels are not supported yet.'));
    }
    if (!/`[^`]+`/.test(line.text) && /\[[^\]\r\n]*"[^"\]\r\n]+"[^\]\r\n]*\]/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.quotedLabel', line, 'Flowchart quoted labels are not supported yet.'));
    }
    if (/\[[^\]\r\n]*#\d+;[^\]\r\n]*\]/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.entityCodeLabel', line, 'Flowchart entity-code labels are not supported yet.'));
    }
    if (/\[[^\]\r\n]*\bfa:fa-[A-Za-z0-9-]+[^\]\r\n]*\]/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.fontAwesomeLabel', line, 'Flowchart FontAwesome icon labels are not supported yet.'));
    }
  }

  return features;
}

function detectUnsupportedSequenceFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:participant|actor|create|destroy|activate|deactivate|note|rect|loop|alt|else|opt|par|and|critical|option|break|end)\b/i.test(line.text)) {
      features.push(unsupportedSyntax(
        'sequence.advanced',
        line,
        'Sequence activation, participant declarations, notes, and control blocks are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedClassFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:class|namespace)\s+[^\r\n]*\{|^\s*[+\-#~]/.test(line.text) || /(?:\*--|o--|<\.\.|\.\.>)/.test(line.text)) {
      features.push(unsupportedSyntax(
        'class.advanced',
        line,
        'Class members, namespaces, composition, aggregation, and dependency relations are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function collectSubgraphIds(lines: SourceLine[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    const match = line.text.trimStart().match(/^subgraph\s+([A-Za-z0-9_-]+)(?:\s|$)/i);
    if (match) ids.add(match[1]);
  }
  return ids;
}

function edgeTouchesSubgraphId(line: string, subgraphIds: Set<string>): boolean {
  const edgeMatch = line.match(/^\s*([A-Za-z0-9_-]+)(?:\[[^\]\r\n]*\])?\s*(?:--(?:\|[^|\r\n]*\|)?>|---|-.->|==>|~~~)\s*([A-Za-z0-9_-]+)/);
  if (!edgeMatch) return false;
  return subgraphIds.has(edgeMatch[1]) || subgraphIds.has(edgeMatch[2]);
}

function edgeContainsHyphenatedNodeId(line: string): boolean {
  const endpoint = '[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*';
  const edgeMatch = line.match(new RegExp(`^\\s*(${endpoint})(?:\\[[^\\]\\r\\n]*\\])?\\s*(?:--(?:\\|[^|\\r\\n]*\\|)?>|---|-.->|==>|~~~)\\s*(${endpoint})`));
  if (!edgeMatch) return false;
  return edgeMatch[1].includes('-') || edgeMatch[2].includes('-');
}

function planned(diagramType: DiagramType): DiagramSupportEntry {
  return {
    diagramType,
    status: 'planned',
    supportedSyntax: [],
    unsupportedSyntax: [
      {
        id: `diagram.${diagramType}`,
        label: `${diagramType} diagrams`,
        status: 'unsupported',
        notes: 'Planned for a future compatibility roadmap.',
      },
    ],
  };
}

function partialSequence(): DiagramSupportEntry {
  return {
    diagramType: 'sequence',
    status: 'partial',
    supportedSyntax: [
      { id: 'sequence.participants', label: 'participants inferred from messages', status: 'supported' },
      { id: 'sequence.message', label: 'direct messages with labels', status: 'supported' },
    ],
    unsupportedSyntax: [
      { id: 'sequence.advanced', label: 'activation, notes, loops, and alternate branches', status: 'unsupported' },
    ],
  };
}

function partialClass(): DiagramSupportEntry {
  return {
    diagramType: 'class',
    status: 'partial',
    supportedSyntax: [
      { id: 'class.definition', label: 'named class declarations', status: 'supported' },
      { id: 'class.inheritance', label: 'inheritance and directed relations', status: 'supported' },
    ],
    unsupportedSyntax: [
      { id: 'class.advanced', label: 'members, namespaces, and advanced relation styles', status: 'unsupported' },
    ],
  };
}

function partialState(): DiagramSupportEntry {
  return { diagramType: 'state', status: 'partial', supportedSyntax: [
    { id: 'state.transition', label: 'named states and directed transitions', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'state.advanced', label: 'start/end pseudostates, composites, and notes', status: 'unsupported' },
  ] };
}

function partialEr(): DiagramSupportEntry {
  return { diagramType: 'er', status: 'partial', supportedSyntax: [
    { id: 'er.relationship', label: 'basic crow’s-foot relationships with labels', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'er.attributes', label: 'entity attribute blocks and extended cardinalities', status: 'unsupported' },
  ] };
}

function partialUserJourney(): DiagramSupportEntry {
  return { diagramType: 'user-journey', status: 'partial', supportedSyntax: [
    { id: 'user-journey.scored-task', label: 'sectioned tasks with 1–5 scores and actors', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'user-journey.advanced', label: 'custom task styling and advanced accessibility configuration', status: 'unsupported' },
  ] };
}

function partialTimeline(): DiagramSupportEntry {
  return { diagramType: 'timeline', status: 'partial', supportedSyntax: [
    { id: 'timeline.period-event', label: 'ordered period and event entries', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'timeline.advanced', label: 'advanced styling and event metadata', status: 'unsupported' },
  ] };
}

function partialGantt(): DiagramSupportEntry {
  return { diagramType: 'gantt', status: 'partial', supportedSyntax: [
    { id: 'gantt.dated-task', label: 'sectioned tasks with ISO start dates and Nd durations', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'gantt.advanced', label: 'task states, dependencies, milestones, and custom date formats', status: 'unsupported' },
  ] };
}
function partialPie(): DiagramSupportEntry { return { diagramType: 'pie', status: 'partial', supportedSyntax: [{ id: 'pie.value', label: 'numeric labeled slices', status: 'supported' }], unsupportedSyntax: [{ id: 'pie.advanced', label: 'showData, custom theme, and advanced formatting', status: 'unsupported' }] }; }
function partialMindmap(): DiagramSupportEntry { return { diagramType: 'mindmap', status: 'partial', supportedSyntax: [{ id: 'mindmap.indent', label: 'space-indented hierarchy', status: 'supported' }], unsupportedSyntax: [{ id: 'mindmap.advanced', label: 'markdown, icons, and custom shapes', status: 'unsupported' }] }; }
function partialRequirement(): DiagramSupportEntry { return { diagramType: 'requirement', status: 'partial', supportedSyntax: [{ id: 'requirement.block', label: 'typed requirement blocks with id, text, risk, and verification method', status: 'supported' }, { id: 'requirement.relationship', label: 'labeled semantic relationships', status: 'supported' }], unsupportedSyntax: [{ id: 'requirement.advanced', label: 'custom requirement styling and advanced relation syntax', status: 'unsupported' }] }; }
function partialGitGraph(): DiagramSupportEntry { return { diagramType: 'gitgraph', status: 'partial', supportedSyntax: [{ id: 'gitgraph.commit', label: 'commits with ids, tags, and types', status: 'supported' }, { id: 'gitgraph.branch-merge', label: 'branch, checkout, and merge history', status: 'supported' }], unsupportedSyntax: [{ id: 'gitgraph.advanced', label: 'cherry-pick, custom branch ordering, and advanced commit options', status: 'unsupported' }] }; }
function partialC4(): DiagramSupportEntry { return { diagramType: 'c4', status: 'partial', supportedSyntax: [{ id: 'c4.element', label: 'people, systems, containers, components, and external elements', status: 'supported' }, { id: 'c4.relationship', label: 'labeled directional relationships', status: 'supported' }], unsupportedSyntax: [{ id: 'c4.advanced', label: 'boundaries, deployment nodes, styling, and advanced relationship macros', status: 'unsupported' }] }; }

function cloneEntry(entry: DiagramSupportEntry): DiagramSupportEntry {
  return {
    diagramType: entry.diagramType,
    status: entry.status,
    supportedSyntax: entry.supportedSyntax.map(item => ({ ...item })),
    unsupportedSyntax: entry.unsupportedSyntax.map(item => ({ ...item })),
  };
}

interface SourceLine {
  text: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
}

function unsupportedDiagramFeature(source: string, diagramType: DetectedDiagramType): UnsupportedFeature {
  return {
    id: `diagram.${diagramType}` as UnsupportedFeatureId,
    range: firstLineRange(source),
    severity: 'error',
    message: unsupportedDiagramMessage(diagramType),
  };
}

function unsupportedDiagramMessage(diagramType: DetectedDiagramType): string {
  return diagramType === 'unknown'
    ? 'Unknown diagram type is not supported yet.'
    : `${diagramType} diagrams are not supported yet.`;
}

function unsupportedSyntax(
  id: UnsupportedFeatureId,
  line: SourceLine,
  message: string,
  severity: UnsupportedFeature['severity'] = 'warning',
): UnsupportedFeature {
  return {
    id,
    range: lineContentRange(line),
    severity,
    message,
  };
}

function firstLineRange(source: string): SupportSourceRange | null {
  const first = linesWithRanges(source)[0];
  return first ? lineContentRange(first) : null;
}

function lineContentRange(line: SourceLine): SupportSourceRange {
  const leadingWhitespace = line.text.length - line.text.trimStart().length;
  const trailingWhitespace = line.text.length - line.text.trimEnd().length;
  const startColumn = leadingWhitespace + 1;
  const endColumn = line.text.length - trailingWhitespace + 1;
  const startOffset = line.startOffset + leadingWhitespace;
  const endOffset = line.endOffset - trailingWhitespace;

  return {
    startOffset,
    endOffset,
    startLine: line.lineNumber,
    startColumn,
    endLine: line.lineNumber,
    endColumn,
  };
}

function linesWithRanges(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const pattern = /.*(?:\r\n|\n|\r|$)/g;
  let match: RegExpExecArray | null;
  let lineNumber = 1;

  while ((match = pattern.exec(source)) !== null) {
    const raw = match[0];
    if (raw === '') break;
    const text = raw.replace(/\r?\n|\r$/, '');
    lines.push({
      text,
      startOffset: match.index,
      endOffset: match.index + text.length,
      lineNumber,
    });
    lineNumber += 1;
    if (pattern.lastIndex >= source.length) break;
  }

  if (source === '') {
    lines.push({ text: '', startOffset: 0, endOffset: 0, lineNumber: 1 });
  }

  return lines;
}
