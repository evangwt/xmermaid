import {
  DIAGRAM_CATALOG,
  MERMAID_COMPATIBILITY_VERSION,
  detectDiagramType,
  type DetectedDiagramType,
  type DiagramType,
} from './diagram-catalog';
import { getFontAwesomeIcon } from './renderer/fontawesome';

declare const __XMERMAID_VERSION__: string;

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
  | 'flowchart.unterminatedLabel'
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
  | 'class.advanced'
  | 'zenuml.advanced'
  | 'xychart.numericXAxis'
  | 'xychart.horizontal'
  | 'xychart.advanced'
  | 'sankey.invalidCsv'
  | 'sankey.invalidValue'
  | 'sankey.cycle'
  | 'sankey.advanced'
  | 'quadrant.advanced'
  | 'architecture.advanced'
  | 'block.advanced'
  | 'kanban.advanced'
  | 'treemap.advanced'
  | 'radar.advanced'
  | 'packet.advanced'
  | 'venn.advanced'
  | 'swimlanes.advanced'
  | 'treeview.advanced'
  | 'wardley.advanced'
  | 'cynefin.advanced';

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
  version: __XMERMAID_VERSION__,
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
        { id: 'flowchart.classDef', label: 'safe hexadecimal fill, stroke, and color class definitions', status: 'supported' },
        { id: 'flowchart.class', label: 'class assignments to declared nodes', status: 'supported' },
        { id: 'flowchart.fontAwesomeLabel', label: 'FontAwesome 4 icon labels embedded as SVG', status: 'supported' },
      ],
      unsupportedSyntax: [
        { id: 'flowchart.style', label: 'inline style statements', status: 'unsupported' },
        { id: 'flowchart.click', label: 'click callbacks and links', status: 'unsupported' },
        { id: 'flowchart.htmlLabel', label: 'HTML labels', status: 'unsupported' },
        { id: 'flowchart.markdownLabel', label: 'Markdown labels', status: 'unsupported' },
        { id: 'flowchart.quotedLabel', label: 'quoted labels', status: 'unsupported' },
        { id: 'flowchart.entityCodeLabel', label: 'HTML entity code labels', status: 'unsupported' },
        { id: 'flowchart.invalidDirection', label: 'invalid graph/flowchart directions', status: 'unsupported' },
        { id: 'flowchart.unterminatedLabel', label: 'unterminated node or edge labels', status: 'unsupported' },
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
                          : diagramType === 'zenuml'
                            ? partialZenUml()
                            : diagramType === 'sankey'
                              ? partialSankey()
                            : diagramType === 'quadrant'
                              ? partialQuadrant()
                            : diagramType === 'xychart'
                              ? partialXyChart()
                              : diagramType === 'architecture'
                                ? partialArchitecture()
                              : diagramType === 'block'
                                ? partialBlock()
                              : diagramType === 'kanban'
                                ? partialKanban()
                                : diagramType === 'treemap'
                                  ? partialTreemap()
                                : diagramType === 'radar'
                                  ? partialRadar()
                                  : diagramType === 'packet'
                                    ? partialPacket()
                                    : diagramType === 'venn'
                                      ? partialVenn()
                                      : diagramType === 'swimlanes'
                                        ? partialSwimlanes()
                                      : diagramType === 'treeview'
                                        ? partialTreeview()
                                        : diagramType === 'ishikawa'
                                          ? partialIshikawa()
                                          : diagramType === 'event-modeling'
                                            ? partialEventModeling()
                                            : diagramType === 'wardley'
                                              ? partialWardley()
                                              : diagramType === 'cynefin'
                                                ? partialCynefin()
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
      ? 'Mermaid rendering has partial support. Check the support matrix for unsupported syntax.'
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
  if (diagramType === 'zenuml') {
    return detectUnsupportedZenUmlFeatures(source);
  }
  if (diagramType === 'xychart') {
    return detectUnsupportedXyChartFeatures(source);
  }
  if (diagramType === 'sankey') {
    return detectUnsupportedSankeyFeatures(source);
  }
  if (diagramType === 'quadrant') {
    return detectUnsupportedQuadrantFeatures(source);
  }
  if (diagramType === 'architecture') {
    return detectUnsupportedArchitectureFeatures(source);
  }
  if (diagramType === 'block') {
    return detectUnsupportedBlockFeatures(source);
  }
  if (diagramType === 'kanban') {
    return detectUnsupportedKanbanFeatures(source);
  }
  if (diagramType === 'treemap') {
    return detectUnsupportedTreemapFeatures(source);
  }
  if (diagramType === 'radar') {
    return detectUnsupportedRadarFeatures(source);
  }
  if (diagramType === 'packet') {
    return detectUnsupportedPacketFeatures(source);
  }
  if (diagramType === 'venn') return detectUnsupportedVennFeatures(source);
  if (diagramType === 'swimlanes') return detectUnsupportedSwimlaneFeatures(source);
  if (diagramType === 'treeview') return [];
  if (diagramType === 'ishikawa') return [];
  if (diagramType === 'event-modeling') return [];
  if (diagramType === 'wardley') return detectUnsupportedWardleyFeatures(source);
  if (diagramType === 'cynefin') return detectUnsupportedCynefinFeatures(source);
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
  const statementScan = scanFlowchartStatements(source);
  const statements = statementScan.statements;
  if (statementScan.unterminatedLabel) {
    features.push({
      id: 'flowchart.unterminatedLabel',
      range: statementScan.unterminatedLabel,
      severity: 'error',
      message: 'Flowchart labels cannot be unterminated; add the matching closing delimiter.',
    });
  }
  const statementsByLine = new Map<number, SourceLine[]>();
  for (const statement of statements) {
    const lineStatements = statementsByLine.get(statement.lineNumber) ?? [];
    lineStatements.push(statement);
    statementsByLine.set(statement.lineNumber, lineStatements);
  }
  const subgraphIds = collectSubgraphIds(lines);
  let previousWasClassDefinition: SourceLine | null = null;
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
    const fontAwesomeMatch = /\[[^\]\r\n]*\bfa:fa-([A-Za-z0-9-]+)[^\]\r\n]*\]/.exec(line.text);
    if (fontAwesomeMatch && !getFontAwesomeIcon(fontAwesomeMatch[1]!)) {
      features.push(unsupportedSyntax('flowchart.fontAwesomeLabel', line, 'Flowchart FontAwesome icon labels are not supported yet.'));
    }

    for (const statement of statementsByLine.get(line.lineNumber) ?? []) {
      const statementTrimmed = trimFlowchartWhitespace(statement.text);
      const classKeyword = flowchartClassStyleKeyword(statementTrimmed);
      if (classKeyword === 'classDef') {
        if (!isSafeFlowchartClassDefinition(statementTrimmed)) {
          features.push(unsupportedSyntax('flowchart.classDef', statement, 'Flowchart classDef statements only support named fill, stroke, and color properties with three- or six-digit hexadecimal values.', 'error'));
        }
        previousWasClassDefinition = statement;
        continue;
      }
      if (previousWasClassDefinition && isFlowchartClassPropertyStatement(statementTrimmed)) {
        features.push(unsupportedSyntax('flowchart.classDef', previousWasClassDefinition, 'Flowchart class definitions require comma-separated properties.', 'error'));
      }
      previousWasClassDefinition = null;

      if (classKeyword === 'class') {
        if (!isSafeFlowchartClassAssignment(statementTrimmed)) {
          features.push(unsupportedSyntax('flowchart.class', statement, 'Flowchart class assignments require comma-separated node ids and a declared class name.', 'error'));
        }
      } else if (/^style\b/.test(statementTrimmed)) {
        features.push(unsupportedSyntax('flowchart.style', statement, 'Flowchart style statements are not supported yet.', 'error'));
      } else if (/^click\b/.test(statementTrimmed)) {
        features.push(unsupportedSyntax('flowchart.click', statement, 'Flowchart click callbacks and links are not supported yet.', 'warning'));
      } else if (/^linkStyle\b/.test(statementTrimmed)) {
        features.push(unsupportedSyntax('flowchart.linkStyle', statement, 'Flowchart linkStyle statements are not supported yet.', 'error'));
      }
    }
  }

  return features;
}

const FLOWCHART_IDENTIFIER_CHARACTERS = '\\p{Alphabetic}\\p{Number}_';
const FLOWCHART_IDENTIFIER = `[${FLOWCHART_IDENTIFIER_CHARACTERS}]+`;
const FLOWCHART_IDENTIFIER_CHARACTER = new RegExp(`[${FLOWCHART_IDENTIFIER_CHARACTERS}]`, 'u');
const FLOWCHART_SPACE = '[ \\t]';
const HEX_COLOR = `#${FLOWCHART_SPACE}*(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})`;
const FLOWCHART_CLASS_RESERVED_WORDS = new Set([
  'graph', 'flowchart', 'subgraph', 'end', 'classDef', 'class', 'style', 'click', 'direction',
]);

function isSafeFlowchartClassDefinition(source: string): boolean {
  const match = new RegExp(`^classDef${FLOWCHART_SPACE}+(${FLOWCHART_IDENTIFIER})${FLOWCHART_SPACE}+(.+?)${FLOWCHART_SPACE}*$`, 'u').exec(source);
  if (!match || !isFlowchartClassIdentifier(match[1])) return false;

  const seen = new Set<string>();
  const propertyPattern = new RegExp(`^(fill|stroke|color)${FLOWCHART_SPACE}*:${FLOWCHART_SPACE}*${HEX_COLOR}$`);
  const properties = match[2].split(',').map(trimFlowchartWhitespace);
  return properties.length > 0 && properties.every(property => {
    const propertyMatch = propertyPattern.exec(property);
    if (!propertyMatch || seen.has(propertyMatch[1])) return false;
    seen.add(propertyMatch[1]);
    return true;
  });
}

function isSafeFlowchartClassAssignment(source: string): boolean {
  const match = new RegExp(`^class${FLOWCHART_SPACE}+(.+?)${FLOWCHART_SPACE}+(${FLOWCHART_IDENTIFIER})${FLOWCHART_SPACE}*$`, 'u').exec(source);
  if (!match || !isFlowchartClassIdentifier(match[2])) return false;
  return match[1].split(',').map(trimFlowchartWhitespace).every(isFlowchartClassIdentifier);
}

function isFlowchartClassIdentifier(value: string): boolean {
  return new RegExp(`^${FLOWCHART_IDENTIFIER}$`, 'u').test(value)
    && !FLOWCHART_CLASS_RESERVED_WORDS.has(value);
}

function isFlowchartClassPropertyStatement(source: string): boolean {
  return /^(?:fill|stroke|color)[ \t]*:[ \t]*\S/.test(source);
}

function trimFlowchartWhitespace(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, '');
}

function flowchartClassStyleKeyword(source: string): 'classDef' | 'class' | null {
  if (startsWithFlowchartKeyword(source, 'classDef')) return 'classDef';
  if (startsWithFlowchartKeyword(source, 'class')) return 'class';
  return null;
}

function startsWithFlowchartKeyword(source: string, keyword: string): boolean {
  if (!source.startsWith(keyword)) return false;
  const next = source[keyword.length];
  return next === undefined || !FLOWCHART_IDENTIFIER_CHARACTER.test(next);
}

interface FlowchartStatementScan {
  statements: SourceLine[];
  unterminatedLabel: SupportSourceRange | null;
}

function scanFlowchartStatements(source: string): FlowchartStatementScan {
  const statements: SourceLine[] = [];
  let startOffset = 0;
  let lineStartOffset = 0;
  let lineNumber = 1;
  let statementLine = 1;
  let labelCloser: string | null = null;
  let labelRange: SupportSourceRange | null = null;
  let inComment = false;

  const push = (endOffset: number) => {
    const text = source.slice(startOffset, endOffset);
    if (!text.trim()) return;
    statements.push({ text, startOffset, endOffset, lineNumber: statementLine });
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inComment) {
      if (character === '\n' || character === '\r') {
        inComment = false;
        if (character === '\r' && source[index + 1] === '\n') index += 1;
        startOffset = index + 1;
        lineStartOffset = startOffset;
        lineNumber += 1;
        statementLine = lineNumber;
      }
      continue;
    }
    if (labelCloser === null && character === '%' && source[index + 1] === '%') {
      push(index);
      index += 1;
      inComment = true;
      continue;
    }
    let closer: string | null = null;
    if (labelCloser === null) {
      if (character === '[') closer = ']';
      else if (character === '(') closer = ')';
      else if (character === '{') closer = '}';
      else if (character === '>' && startsAsymmetricFlowchartLabel(source, index)) closer = ']';
      else if (character === '|') closer = '|';
    }
    if (closer !== null) {
      labelCloser = closer;
      const startColumn = index - lineStartOffset + 1;
      labelRange = {
        startOffset: index,
        endOffset: index + 1,
        startLine: lineNumber,
        startColumn,
        endLine: lineNumber,
        endColumn: startColumn + 1,
      };
    } else if (labelCloser === character) {
      labelCloser = null;
      labelRange = null;
    } else if (character === ';' && labelCloser === null) {
      push(index);
      startOffset = index + 1;
      statementLine = lineNumber;
    } else if (character === '\n' || character === '\r') {
      if (labelCloser === null) push(index);
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      lineNumber += 1;
      lineStartOffset = index + 1;
      if (labelCloser === null) {
        startOffset = lineStartOffset;
        statementLine = lineNumber;
      }
    }
  }
  if (!inComment) push(source.length);
  return { statements, unterminatedLabel: labelRange };
}

export function topLevelFlowchartClassStyleRange(source: string): number | null {
  for (const statement of scanFlowchartStatements(source).statements) {
    const leading = statement.text.search(/[^ \t]/);
    if (leading >= 0 && flowchartClassStyleKeyword(statement.text.slice(leading)) !== null) {
      return statement.startOffset + leading;
    }
  }
  return null;
}

function startsAsymmetricFlowchartLabel(source: string, index: number): boolean {
  return index === 0 || !/[-.=~>]/.test(source[index - 1]);
}

function detectUnsupportedSequenceFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:create|destroy|box|link)\b/i.test(line.text)
      || /^\s*autonumber\s+\S/i.test(line.text)
      || (/^\s*rect\b/i.test(line.text) && !isSupportedSequenceRect(line.text))) {
      features.push(unsupportedSyntax(
        'sequence.advanced',
        line,
        'Sequence create/destroy, box, links, and advanced autonumber or rect syntax are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function isSupportedSequenceRect(source: string): boolean {
  const match = /^\s*rect\s+rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/i.exec(source);
  return match !== null && match.slice(1).every(channel => Number(channel) <= 255);
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

function detectUnsupportedZenUmlFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:participant|actor|create|destroy|if|else|while|for|loop|opt|alt|par|end|return)\b/i.test(line.text)
      || /(?:--?>{2,}|\{|\})/.test(line.text)) {
      features.push(unsupportedSyntax(
        'zenuml.advanced',
        line,
        'ZenUML blocks, declarations, async messages, and advanced control syntax are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedXyChartFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (/^xychart-beta\s+horizontal\b/i.test(trimmed)) {
      features.push(unsupportedSyntax(
        'xychart.horizontal',
        line,
        'Horizontal XY charts are not supported yet.',
        'error',
      ));
    } else if (/^x-axis\s+(?:"[^"]*"\s+)?[-+]?\d+(?:\.\d+)?\s*-->/i.test(trimmed)) {
      features.push(unsupportedSyntax(
        'xychart.numericXAxis',
        line,
        'XY charts currently require categorical x-axis labels in brackets.',
        'error',
      ));
    } else if (/^(?:axis|theme|accTitle|accDescr)\b/i.test(trimmed)) {
      features.push(unsupportedSyntax(
        'xychart.advanced',
        line,
        'Advanced XY chart directives are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedSankeyFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  const records: { source: string; target: string; line: SourceLine }[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || /^sankey(?:-beta)?\b/i.test(trimmed)) continue;
    if (/^(?:---|config:|sankey:|accTitle:|accDescr:)/i.test(trimmed)) {
      features.push(unsupportedSyntax('sankey.advanced', line, 'Sankey configuration directives are not supported yet.', 'error'));
      continue;
    }
    const fields = parseSankeyCsvRecord(line.text);
    if (!fields || fields.length !== 3 || !fields[0] || !fields[1]) {
      features.push(unsupportedSyntax('sankey.invalidCsv', line, 'Sankey rows must be valid three-column source,target,value CSV records.', 'error'));
      continue;
    }
    const value = Number(fields[2]);
    if (!Number.isFinite(value) || value <= 0) {
      features.push(unsupportedSyntax('sankey.invalidValue', line, 'Sankey values must be finite positive numbers.', 'error'));
      continue;
    }
    records.push({ source: fields[0], target: fields[1], line });
  }
  if (!features.some(feature => feature.id === 'sankey.invalidCsv') && sankeyHasCycle(records)) {
    features.push(unsupportedSyntax('sankey.cycle', records[0]?.line ?? linesWithRanges(source)[0], 'Sankey diagrams cannot contain cycles.', 'error'));
  }
  return features;
}

function detectUnsupportedQuadrantFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || /^quadrantChart\b/i.test(trimmed)) continue;
    if (/^(?:---|config:|themeVariables:|classDef\b)|:::\w+|\]\s+(?:radius|color|stroke-)/i.test(trimmed)) {
      features.push(unsupportedSyntax('quadrant.advanced', line, 'Quadrant configuration and point styling are not supported yet.', 'error'));
    }
  }
  return features;
}

function detectUnsupportedArchitectureFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'architecture-beta') continue;
    const service = /^service\s+[A-Za-z0-9_]+\([A-Za-z0-9_]+\)\[[^\]\r\n]+\]$/.test(trimmed);
    const relationship = /^[A-Za-z0-9_]+:[TBLR]\s*(?:--|-->)\s*[TBLR]:[A-Za-z0-9_]+$/.test(trimmed);
    if (!service && !relationship) {
      features.push(unsupportedSyntax(
        'architecture.advanced',
        line,
        'Architecture groups, junctions, alignment, configuration, service membership, and bidirectional arrows are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedBlockFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'block-beta' || /^columns\s+[1-9]\d*$/.test(trimmed)) continue;
    const relationship = /^[A-Za-z_][A-Za-z0-9_]*\s*(?:--|-->)\s*[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed);
    const cell = /^(?:(?:space|[A-Za-z_][A-Za-z0-9_]*(?:\["[^"\r\n]+"\])?)(?::[1-9]\d*)?)(?:\s+(?:(?:space|[A-Za-z_][A-Za-z0-9_]*(?:\["[^"\r\n]+"\])?)(?::[1-9]\d*)?))*$/.test(trimmed);
    if (!relationship && !cell) {
      features.push(unsupportedSyntax(
        'block.advanced',
        line,
        'Block nesting, block arrows, custom shapes, classes, styles, configuration, and edge labels are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedKanbanFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'kanban') continue;
    const item = /^(?:[A-Za-z_][A-Za-z0-9_]*\[[^\]\r\n]+\]|\[[^\]\r\n]+\]|[^@\[\]\r\n]+)$/.test(trimmed);
    if (!item || trimmed.includes('@{') || /^(?:---|config:|ticketBaseUrl:)/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'kanban.advanced',
        line,
        'Kanban task metadata, ticket configuration, YAML, custom styles, and advanced syntax are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedTreemapFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'treemap-beta') continue;
    if (/^(?:---|config:|classDef\b|class\b|style\b|themeVariables:|accTitle:|accDescr:)/i.test(trimmed) || /:::[A-Za-z0-9_-]+/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'treemap.advanced',
        line,
        'Treemap configuration, classes, styles, and accessibility directives are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedRadarFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'radar-beta') continue;
    if (/^(?:graticule\b|---|config:|themeVariables:|classDef\b|class\b|style\b|accTitle:|accDescr:)/i.test(trimmed) || /:::[A-Za-z0-9_-]+/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'radar.advanced',
        line,
        'Radar graticules, configuration, classes, styles, and accessibility directives are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedPacketFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'packet') continue;
    if (/^(?:---|config:|themeVariables:|classDef\b|class\b|style\b|accTitle:|accDescr:)/i.test(trimmed) || /:::[A-Za-z0-9_-]+/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'packet.advanced',
        line,
        'Packet configuration, classes, styles, and accessibility directives are not supported yet.',
        'error',
      ));
    }
  }
  return features;
}

function detectUnsupportedVennFeatures(source: string): UnsupportedFeature[] {
  return linesWithRanges(source).flatMap(line => {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed === 'venn-beta') return [];
    return /^(?:---|config:|themeVariables:|classDef\b|class\b|style\b|text\b|accTitle:|accDescr:)/i.test(trimmed) || /:::[A-Za-z0-9_-]+/.test(trimmed)
      ? [unsupportedSyntax('venn.advanced', line, 'Venn configuration, styles, text annotations, and accessibility directives are not supported yet.', 'error')]
      : [];
  });
}

function parseSankeyCsvRecord(line: string): string[] | null {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.trim().length; index += 1) {
    const character = line.trim()[index];
    if (character === '"' && quoted && line.trim()[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      fields.push(field.trim());
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) return null;
  fields.push(field.trim());
  return fields;
}

function sankeyHasCycle(records: { source: string; target: string }[]): boolean {
  const graph = new Map<string, string[]>();
  for (const record of records) graph.set(record.source, [...(graph.get(record.source) ?? []), record.target]);
  const states = new Map<string, 0 | 1 | 2>();
  const visit = (node: string): boolean => {
    const state = states.get(node) ?? 0;
    if (state === 1) return true;
    if (state === 2) return false;
    states.set(node, 1);
    if ((graph.get(node) ?? []).some(visit)) return true;
    states.set(node, 2);
    return false;
  };
  return [...graph.keys()].some(visit);
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
      { id: 'sequence.participants', label: 'explicit or inferred participants and actors', status: 'supported' },
      { id: 'sequence.message', label: 'direct messages with labels', status: 'supported' },
      { id: 'sequence.activation', label: 'activation and deactivation bars', status: 'supported' },
      { id: 'sequence.note', label: 'left, right, and over notes', status: 'supported' },
      { id: 'sequence.control', label: 'loop, alternative, option, parallel, critical, and break blocks', status: 'supported' },
      { id: 'sequence.autonumber', label: 'basic autonumber message labels', status: 'supported' },
      { id: 'sequence.rect', label: 'rgb-framed sequence regions', status: 'supported' },
      { id: 'sequence.cross-ending', label: 'dashed cross-ended messages', status: 'supported' },
    ],
    unsupportedSyntax: [
      { id: 'sequence.advanced', label: 'create/destroy lifecycle, box framing, links, and advanced autonumber or rect forms', status: 'unsupported' },
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
function partialZenUml(): DiagramSupportEntry { return { diagramType: 'zenuml', status: 'partial', supportedSyntax: [{ id: 'zenuml.call', label: 'labeled direct calls', status: 'supported' }, { id: 'zenuml.return', label: 'labeled returns', status: 'supported' }], unsupportedSyntax: [{ id: 'zenuml.advanced', label: 'blocks, declarations, async messages, and advanced control syntax', status: 'unsupported' }] }; }
function partialSankey(): DiagramSupportEntry { return { diagramType: 'sankey', status: 'partial', supportedSyntax: [{ id: 'sankey.csv', label: 'three-column weighted CSV records', status: 'supported' }, { id: 'sankey.dag', label: 'acyclic weighted flows', status: 'supported' }], unsupportedSyntax: [{ id: 'sankey.invalidCsv', label: 'malformed CSV and non-three-column records', status: 'unsupported' }, { id: 'sankey.invalidValue', label: 'zero, negative, and non-finite weights', status: 'unsupported' }, { id: 'sankey.cycle', label: 'cyclic flow graphs', status: 'unsupported' }, { id: 'sankey.advanced', label: 'diagram configuration and custom node styling', status: 'unsupported' }] }; }
function partialQuadrant(): DiagramSupportEntry { return { diagramType: 'quadrant', status: 'partial', supportedSyntax: [{ id: 'quadrant.axes', label: 'title, axis labels, and quadrant captions', status: 'supported' }, { id: 'quadrant.points', label: 'normalized [0, 1] coordinate points', status: 'supported' }], unsupportedSyntax: [{ id: 'quadrant.advanced', label: 'configuration, classes, and direct point styling', status: 'unsupported' }] }; }
function partialXyChart(): DiagramSupportEntry { return { diagramType: 'xychart', status: 'partial', supportedSyntax: [{ id: 'xychart.categorical-axis', label: 'categorical x-axis labels and numeric y-axis ranges', status: 'supported' }, { id: 'xychart.bar-line-series', label: 'ordered bar and line series', status: 'supported' }], unsupportedSyntax: [{ id: 'xychart.numericXAxis', label: 'numeric x-axis ranges', status: 'unsupported' }, { id: 'xychart.horizontal', label: 'horizontal XY chart orientation', status: 'unsupported' }, { id: 'xychart.advanced', label: 'advanced directives and custom chart configuration', status: 'unsupported' }] }; }
function partialArchitecture(): DiagramSupportEntry { return { diagramType: 'architecture', status: 'partial', supportedSyntax: [{ id: 'architecture.service', label: 'top-level labeled services with validated icon identifiers', status: 'supported' }, { id: 'architecture.relationship', label: 'direct port-to-port lines and target arrows', status: 'supported' }], unsupportedSyntax: [{ id: 'architecture.advanced', label: 'groups, junctions, align directives, configuration, service membership, icon glyphs, and bidirectional arrows', status: 'unsupported' }] }; }
function partialBlock(): DiagramSupportEntry { return { diagramType: 'block', status: 'partial', supportedSyntax: [{ id: 'block.grid', label: 'flat rows, columns, and span declarations', status: 'supported' }, { id: 'block.relationship', label: 'direct -- and --> relationships between declared blocks', status: 'supported' }], unsupportedSyntax: [{ id: 'block.advanced', label: 'nested blocks, block arrows, custom shapes, classes, styles, configuration, and edge labels', status: 'unsupported' }] }; }
function partialKanban(): DiagramSupportEntry { return { diagramType: 'kanban', status: 'partial', supportedSyntax: [{ id: 'kanban.columns', label: 'ordered columns with bracketed or bare labels', status: 'supported' }, { id: 'kanban.tasks', label: 'space-indented tasks within columns', status: 'supported' }], unsupportedSyntax: [{ id: 'kanban.advanced', label: 'task metadata, ticket configuration, YAML, styles, and advanced syntax', status: 'unsupported' }] }; }
function partialTreemap(): DiagramSupportEntry { return { diagramType: 'treemap', status: 'partial', supportedSyntax: [{ id: 'treemap.hierarchy', label: 'quoted, space-indented category hierarchy', status: 'supported' }, { id: 'treemap.leaf-value', label: 'positive numeric leaf values', status: 'supported' }], unsupportedSyntax: [{ id: 'treemap.advanced', label: 'YAML configuration, classes, styles, and accessibility directives', status: 'unsupported' }] }; }
function partialRadar(): DiagramSupportEntry { return { diagramType: 'radar', status: 'partial', supportedSyntax: [{ id: 'radar.axes', label: 'three or more named axes', status: 'supported' }, { id: 'radar.curves', label: 'finite numeric curves with matching axis values', status: 'supported' }, { id: 'radar.range', label: 'title and min/max numeric range', status: 'supported' }], unsupportedSyntax: [{ id: 'radar.advanced', label: 'graticules, YAML configuration, classes, styles, and accessibility directives', status: 'unsupported' }] }; }
function partialPacket(): DiagramSupportEntry { return { diagramType: 'packet', status: 'partial', supportedSyntax: [{ id: 'packet.bit-range', label: 'ordered absolute start-end bit ranges', status: 'supported' }, { id: 'packet.sequential-width', label: 'ordered +width bit fields', status: 'supported' }, { id: 'packet.title', label: 'optional packet title', status: 'supported' }], unsupportedSyntax: [{ id: 'packet.advanced', label: 'YAML configuration, classes, styles, and accessibility directives', status: 'unsupported' }] }; }
function partialVenn(): DiagramSupportEntry { return { diagramType: 'venn', status: 'partial', supportedSyntax: [{ id: 'venn.set', label: 'two or more named sets with optional display labels', status: 'supported' }, { id: 'venn.union', label: 'labeled unions of declared sets', status: 'supported' }, { id: 'venn.title', label: 'optional title', status: 'supported' }], unsupportedSyntax: [{ id: 'venn.advanced', label: 'sizes, text annotations, configuration, classes, styles, and accessibility directives', status: 'unsupported' }] }; }
function partialSwimlanes(): DiagramSupportEntry { return { diagramType: 'swimlanes', status: 'partial', supportedSyntax: [{ id: 'swimlanes.basic-lanes', label: 'top-level subgraph lanes with optional labels', status: 'supported' }, { id: 'swimlanes.nodes', label: 'square-bracket lane nodes', status: 'supported' }, { id: 'swimlanes.edges', label: 'directed edges with optional pipe labels', status: 'supported' }], unsupportedSyntax: [{ id: 'swimlanes.advanced', label: 'configuration, nested lanes, classes, styles, advanced shapes, and accessibility directives', status: 'unsupported' }] }; }
function partialTreeview(): DiagramSupportEntry { return { diagramType: 'treeview', status: 'partial', supportedSyntax: [{ id: 'treeview.indent', label: 'space-indented hierarchy beneath tree', status: 'supported' }], unsupportedSyntax: [{ id: 'treeview.advanced', label: 'configuration, styles, icons, and custom shapes', status: 'unsupported' }] }; }
function partialIshikawa(): DiagramSupportEntry { return { diagramType: 'ishikawa', status: 'partial', supportedSyntax: [{ id: 'ishikawa.indent', label: 'indented effect, categories, and nested causes', status: 'supported' }], unsupportedSyntax: [{ id: 'ishikawa.advanced', label: 'configuration, custom styling, and accessibility directives', status: 'unsupported' }] }; }
function partialEventModeling(): DiagramSupportEntry { return { diagramType: 'event-modeling', status: 'partial', supportedSyntax: [{ id: 'event-modeling.timeframe', label: 'ordered tf/timeframe and rf/resetframe entity frames', status: 'supported' }, { id: 'event-modeling.entities', label: 'ui, processor, command, readmodel, and event entity types', status: 'supported' }], unsupportedSyntax: [{ id: 'event-modeling.advanced', label: 'data-block rendering, configuration, classes, styles, and accessibility directives', status: 'unsupported' }] }; }
function partialWardley(): DiagramSupportEntry { return { diagramType: 'wardley', status: 'partial', supportedSyntax: [{ id: 'wardley.components', label: 'coordinate-based anchor and component declarations', status: 'supported' }, { id: 'wardley.dependencies', label: 'direct dependencies between declared components', status: 'supported' }, { id: 'wardley.title', label: 'optional map title', status: 'supported' }], unsupportedSyntax: [{ id: 'wardley.advanced', label: 'evolution, pipelines, notes, annotations, strategies, decorators, custom stages, configuration, classes, styles, and accessibility directives', status: 'unsupported' }] }; }
function partialCynefin(): DiagramSupportEntry { return { diagramType: 'cynefin', status: 'partial', supportedSyntax: [{ id: 'cynefin.domains', label: 'the five fixed domains with quoted items', status: 'supported' }, { id: 'cynefin.transitions', label: 'directed transitions with optional quoted labels', status: 'supported' }, { id: 'cynefin.title', label: 'optional framework title', status: 'supported' }], unsupportedSyntax: [{ id: 'cynefin.advanced', label: 'configuration, accessibility directives, custom appearance, classes, and styles', status: 'unsupported' }] }; }

function detectUnsupportedSwimlaneFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:%%\{init|classDef|class|style|linkStyle|click|accTitle|accDescr|---|config:)\b/i.test(line.text) || /@\{\s*shape\s*:|:::/i.test(line.text)) {
      features.push(unsupportedSyntax('swimlanes.advanced', line, 'Swimlane configuration, styles, classes, and advanced shapes are not supported yet.', 'error'));
    }
  }
  return features;
}

function detectUnsupportedWardleyFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:evolve|pipeline|note|annotation|strategy|classDef|class|style|accTitle|accDescr|---|config:)\b/i.test(line.text) || /@\{|:::/i.test(line.text)) {
      features.push(unsupportedSyntax('wardley.advanced', line, 'Wardley evolution, pipelines, annotations, strategies, styles, and configuration are not supported yet.', 'error'));
    }
  }
  return features;
}

function detectUnsupportedCynefinFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  let configurationBlock = false;
  for (const line of linesWithRanges(source)) {
    if (/^\s*---(?:\s|$)/.test(line.text)) configurationBlock = true;
    if (configurationBlock || /^\s*(?:config:|accTitle\b|accDescr\b|classDef\b|class\b|style\b)/i.test(line.text) || /(?:@\{|:::)/i.test(line.text)) {
      features.push(unsupportedSyntax('cynefin.advanced', line, 'Cynefin configuration, accessibility directives, classes, styles, and custom appearance are not supported yet.', 'error'));
    }
  }
  return features;
}

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
