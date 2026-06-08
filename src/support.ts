export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'pie'
  | 'mindmap'
  | 'unknown';

export type SupportStatus = 'supported' | 'partial' | 'unsupported';

export type UnsupportedFeatureId =
  | 'diagram.sequence'
  | 'diagram.class'
  | 'diagram.state'
  | 'diagram.er'
  | 'diagram.gantt'
  | 'diagram.pie'
  | 'diagram.mindmap'
  | 'diagram.unknown'
  | 'flowchart.class'
  | 'flowchart.classDef'
  | 'flowchart.style'
  | 'flowchart.click'
  | 'flowchart.htmlLabel'
  | 'flowchart.markdownLabel'
  | 'flowchart.invalidDirection'
  | 'flowchart.stadiumShape'
  | 'flowchart.cylinderShape'
  | 'flowchart.bidirectionalEdge'
  | 'flowchart.circleEdge'
  | 'flowchart.crossEdge'
  | 'flowchart.inlineEdgeLabel'
  | 'flowchart.edgeId';

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
  status: SupportStatus;
  supportedSyntax: SyntaxCapability[];
  unsupportedSyntax: SyntaxCapability[];
}

export interface SupportMatrix {
  version: string;
  entries: DiagramSupportEntry[];
}

export interface SupportReport {
  diagramType: DiagramType;
  status: SupportStatus;
  message: string;
  unsupportedFeatures: UnsupportedFeature[];
}

const SUPPORT_MATRIX: SupportMatrix = {
  version: '0.1.0',
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
        { id: 'flowchart.invalidDirection', label: 'invalid graph/flowchart directions', status: 'unsupported' },
        { id: 'flowchart.stadiumShape', label: 'stadium shape syntax', status: 'unsupported' },
        { id: 'flowchart.cylinderShape', label: 'cylinder/database shape syntax', status: 'unsupported' },
        { id: 'flowchart.bidirectionalEdge', label: 'bidirectional edge arrows', status: 'unsupported' },
        { id: 'flowchart.circleEdge', label: 'circle edge endings', status: 'unsupported' },
        { id: 'flowchart.crossEdge', label: 'cross edge endings', status: 'unsupported' },
        { id: 'flowchart.inlineEdgeLabel', label: 'inline edge labels', status: 'unsupported' },
        { id: 'flowchart.edgeId', label: 'edge IDs', status: 'unsupported' },
      ],
    },
    unsupported('sequence', 'sequenceDiagram'),
    unsupported('class', 'classDiagram'),
    unsupported('state', 'stateDiagram'),
    unsupported('er', 'erDiagram'),
    unsupported('gantt', 'gantt'),
    unsupported('pie', 'pie'),
    unsupported('mindmap', 'mindmap'),
    unsupported('unknown', 'unknown diagram type'),
  ],
};

export function getSupportMatrix(): SupportMatrix {
  return {
    version: SUPPORT_MATRIX.version,
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
  const support = getDiagramSupport(diagramType);
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
  if (diagramType !== 'flowchart') {
    return [unsupportedDiagramFeature(source, diagramType)];
  }

  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
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

    if (/^classDef\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.classDef', line, 'Flowchart classDef statements are not supported yet.'));
    } else if (/^class\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.class', line, 'Flowchart class assignments are not supported yet.'));
    } else if (/^style\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.style', line, 'Flowchart style statements are not supported yet.'));
    } else if (/^click\b/.test(trimmed)) {
      features.push(unsupportedSyntax('flowchart.click', line, 'Flowchart click callbacks and links are not supported yet.'));
    }

    if (/<\/?[A-Za-z][^>]*>/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.htmlLabel', line, 'Flowchart HTML labels are not supported yet.'));
    }
    if (/`[^`]+`/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.markdownLabel', line, 'Flowchart Markdown labels are not supported yet.'));
    }
  }

  return features;
}

function unsupported(diagramType: DiagramType, label: string): DiagramSupportEntry {
  return {
    diagramType,
    status: 'unsupported',
    supportedSyntax: [],
    unsupportedSyntax: [
      {
        id: `diagram.${diagramType}`,
        label,
        status: 'unsupported',
        notes: 'Planned for a future compatibility roadmap.',
      },
    ],
  };
}

function cloneEntry(entry: DiagramSupportEntry): DiagramSupportEntry {
  return {
    diagramType: entry.diagramType,
    status: entry.status,
    supportedSyntax: entry.supportedSyntax.map(item => ({ ...item })),
    unsupportedSyntax: entry.unsupportedSyntax.map(item => ({ ...item })),
  };
}

function detectDiagramType(source: string): DiagramType {
  const firstLine = source.trimStart().split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (/^(graph|flowchart)\b/i.test(firstLine)) return 'flowchart';
  if (/^sequenceDiagram\b/i.test(firstLine)) return 'sequence';
  if (/^classDiagram\b/i.test(firstLine)) return 'class';
  if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) return 'state';
  if (/^erDiagram\b/i.test(firstLine)) return 'er';
  if (/^gantt\b/i.test(firstLine)) return 'gantt';
  if (/^pie\b/i.test(firstLine)) return 'pie';
  if (/^mindmap\b/i.test(firstLine)) return 'mindmap';
  return 'unknown';
}

interface SourceLine {
  text: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
}

function unsupportedDiagramFeature(source: string, diagramType: DiagramType): UnsupportedFeature {
  return {
    id: `diagram.${diagramType}` as UnsupportedFeatureId,
    range: firstLineRange(source),
    severity: 'error',
    message: unsupportedDiagramMessage(diagramType),
  };
}

function unsupportedDiagramMessage(diagramType: DiagramType): string {
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
