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
  | 'state.advanced'
  | 'mindmap.advanced'
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
        { id: 'flowchart.basic-edges', label: 'directed, dotted, thick, invisible, and plain line edges', status: 'supported' },
        { id: 'flowchart.basic-labels', label: 'square-bracket node labels and pipe edge labels', status: 'supported' },
        { id: 'flowchart.basic-shapes', label: 'rectangle, rounded, stadium, cylinder/database, circle, double-circle, diamond, hexagon, parallelogram, trapezoid, subroutine, and asymmetric shapes', status: 'supported' },
        { id: 'flowchart.subgraph-parse', label: 'subgraph parsing', status: 'partial' },
        { id: 'flowchart.classDef', label: 'safe hexadecimal fill, stroke, and color class definitions', status: 'supported' },
        { id: 'flowchart.class', label: 'class assignments to declared nodes', status: 'supported' },
        { id: 'flowchart.style', label: 'inline style statements with safe hexadecimal fill, stroke, and color values', status: 'supported' },
        { id: 'flowchart.fontAwesomeLabel', label: 'FontAwesome 4 icon labels embedded as SVG', status: 'supported' },
        { id: 'flowchart.edge-endings', label: 'circle (o), cross (x), and bidirectional edge endings on both endpoints', status: 'supported' },
        { id: 'flowchart.inline-edge-labels', label: 'inline edge labels such as A -- text --> B and A -. text .-> B', status: 'supported' },
        { id: 'flowchart.extended-length', label: 'extended edge lengths via extra dashes or equals signs', status: 'supported' },
        { id: 'flowchart.chained-ampersand', label: 'A & B --> C & D multi-source and multi-target edges', status: 'supported' },
        { id: 'flowchart.subgraph-containers', label: 'subgraph containers rendered as labeled boxes, including edges to container ids', status: 'supported' },
        { id: 'flowchart.hyphenatedNodeId', label: 'hyphenated node ids', status: 'supported' },
        { id: 'flowchart.entityCodeLabel', label: 'HTML entity code labels decoded to characters', status: 'supported' },
        { id: 'flowchart.inlineClass', label: 'inline ::: class assignments', status: 'supported' },
        { id: 'flowchart.linkStyle', label: 'linkStyle statements with safe color, stroke-width, and stroke-dasharray values', status: 'supported' },
        { id: 'flowchart.expandedShape', label: 'A@{ shape: ..., label: ... } expanded shape declarations', status: 'supported' },
        { id: 'flowchart.namedColors', label: 'CSS named colors, transparent, none, and currentColor in styles', status: 'supported' },
      ],
      unsupportedSyntax: [
        { id: 'flowchart.style', label: 'style or linkStyle statements with unsafe or unsupported property values', status: 'unsupported' },
        { id: 'flowchart.click', label: 'click callbacks and links', status: 'unsupported' },
        { id: 'flowchart.htmlLabel', label: 'HTML labels', status: 'unsupported' },
        { id: 'flowchart.markdownLabel', label: 'Markdown labels', status: 'unsupported' },
        { id: 'flowchart.invalidDirection', label: 'invalid graph/flowchart directions', status: 'unsupported' },
        { id: 'flowchart.unterminatedLabel', label: 'unterminated node or edge labels', status: 'unsupported' },
        { id: 'flowchart.expandedShapeUnsupported', label: 'expanded shape declarations with unsupported shape names or properties', status: 'unsupported' },
        { id: 'flowchart.edgeId', label: 'edge IDs', status: 'unsupported' },
        { id: 'flowchart.subgraph-direction', label: 'direction statements inside subgraphs (parsed, layout ignores them)', status: 'unsupported' },
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
                  ? fullySupported('user-journey', [
                      { id: 'user-journey.scored-task', label: 'sectioned tasks with 1–5 scores and actors', status: 'supported' },
                      { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' },
                      { id: 'theme.init-directive', label: '%%{init}%% theme directive selecting the default, dark, light, neutral, forest, or minimal theme', status: 'supported' },
                    ])
                  : diagramType === 'timeline'
                    ? partialTimeline()
                  : diagramType === 'gantt'
                ? fullySupported('gantt', [
                    { id: 'gantt.dated-task', label: 'sectioned tasks with ISO start dates and Nd/Nw/Nh durations', status: 'supported' },
                    { id: 'gantt.states', label: 'done, active, and crit task states rendered with colors', status: 'supported' },
                    { id: 'gantt.milestones', label: 'milestone tasks rendered as diamonds', status: 'supported' },
                    { id: 'gantt.dependencies', label: 'after <task> start dependencies', status: 'supported' },
                    { id: 'gantt.date-format', label: 'dateFormat directives built from YYYY, MM, and DD tokens', status: 'supported' },
                    { id: 'gantt.unix-date-format', label: 'dateFormat X, x, and unix unix-timestamp task dates', status: 'supported' },
                    { id: 'gantt.multi-dependency', label: 'multiple after anchors (after t1 t2 starts after all finish)', status: 'supported' },
                    { id: 'gantt.excludes', label: 'excludes weekends, weekdays, and dates with working-day duration expansion', status: 'supported' },
                    { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' },
                    { id: 'theme.init-directive', label: '%%{init}%% theme directive selecting the default, dark, light, neutral, forest, or minimal theme', status: 'supported' },
                  ])
                : diagramType === 'pie'
                  ? fullySupported('pie', [
                      { id: 'pie.value', label: 'numeric labeled slices', status: 'supported' },
                      { id: 'pie.title', label: 'pie titles rendered above the chart, standalone or in the header', status: 'supported' },
                      { id: 'pie.showData', label: 'showData directive rendering the slice value table', status: 'supported' },
                      { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' },
                      { id: 'theme.init-directive', label: '%%{init}%% theme directive selecting the default, dark, light, neutral, forest, or minimal theme', status: 'supported' },
                    ])
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
      : support.status === 'supported'
        ? 'Mermaid rendering is fully supported for this diagram type.'
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
  if (diagramType === 'state') {
    const features: UnsupportedFeature[] = [];
    for (const line of linesWithRanges(source)) {
      if (/^\s*--\s*$/.test(line.text)) {
        features.push(unsupportedSyntax(
          'state.advanced',
          line,
          'State concurrent regions are flattened into a single combined graph; parallel region lanes are not drawn separately.',
          'warning',
        ));
      }
    }
    return features;
  }
  if (diagramType === 'er') return [];
  if (diagramType === 'gantt') return [];
  if (diagramType === 'pie') return [];
  if (diagramType === 'user-journey') return [];
  if (diagramType === 'timeline') return [];
  if (diagramType === 'mindmap') {
    const features: UnsupportedFeature[] = [];
    for (const line of linesWithRanges(source)) {
      const match = /^\s*::icon\(([^)\r\n]+)\)/.exec(line.text);
      if (match) {
        const raw = match[1]!.trim();
        const name = raw.replace(/^fa[\s:]/, '');
        if (!getFontAwesomeIcon(name)) {
          features.push(unsupportedSyntax(
            'mindmap.advanced',
            line,
            `Mindmap icon "${raw}" is not in the supported FontAwesome 4 set.`,
            'error',
          ));
        }
      }
    }
    return features;
  }
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

    // Expanded shape declarations (A@{ shape: ... }) are parsed and validated
    // by the Rust parser itself; unsupported shape names or properties fail
    // there with a precise parse diagnostic instead of a blanket flag here.

    if (/\b[A-Za-z0-9_]+@\s*(?:--|==|-\.)[->=.~]*/.test(line.text)) {
      features.push(unsupportedSyntax(
        'flowchart.edgeId',
        line,
        'Flowchart edge IDs are not supported yet.',
        'error',
      ));
    }
    if (/<\/?[A-Za-z][^>]*>/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.htmlLabel', line, 'Flowchart HTML labels are not supported yet.'));
    }
    if (/`[^`]+`/.test(line.text)) {
      features.push(unsupportedSyntax('flowchart.markdownLabel', line, 'Flowchart Markdown labels are not supported yet.'));
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
          features.push(unsupportedSyntax('flowchart.classDef', statement, 'Flowchart classDef statements only support fill, stroke, color, stroke-width, and stroke-dasharray properties with safe color values.', 'error'));
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
        if (!isSafeFlowchartStyleStatement(statementTrimmed)) {
          features.push(unsupportedSyntax('flowchart.style', statement, 'Flowchart style statements only support fill, stroke, and color properties with three- or six-digit hexadecimal values.', 'error'));
        }
      } else if (/^click\b/.test(statementTrimmed)) {
        features.push(unsupportedSyntax('flowchart.click', statement, 'Flowchart click callbacks and links are not supported yet.', 'warning'));
      } else if (/^linkStyle\b/.test(statementTrimmed)) {
        if (!isSafeFlowchartLinkStyleStatement(statementTrimmed)) {
          features.push(unsupportedSyntax('flowchart.style', statement, 'Flowchart linkStyle statements only support fill, stroke, and color properties with safe color values plus numeric stroke-width and stroke-dasharray.', 'error'));
        }
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
const CSS_NAMED_COLORS = [
  'aliceblue','antiquewhite','aqua','aquamarine','azure','beige','bisque','black',
  'blanchedalmond','blue','blueviolet','brown','burlywood','cadetblue','chartreuse',
  'chocolate','coral','cornflowerblue','cornsilk','crimson','cyan','darkblue',
  'darkcyan','darkgoldenrod','darkgray','darkgreen','darkgrey','darkkhaki',
  'darkmagenta','darkolivegreen','darkorange','darkorchid','darkred','darksalmon',
  'darkseagreen','darkslateblue','darkslategray','darkslategrey','darkturquoise',
  'darkviolet','deeppink','deepskyblue','dimgray','dimgrey','dodgerblue',
  'firebrick','floralwhite','forestgreen','fuchsia','gainsboro','ghostwhite',
  'gold','goldenrod','gray','green','greenyellow','grey','honeydew','hotpink',
  'indianred','indigo','ivory','khaki','lavender','lavenderblush','lawngreen',
  'lemonchiffon','lightblue','lightcoral','lightcyan','lightgoldenrodyellow',
  'lightgray','lightgreen','lightgrey','lightpink','lightsalmon','lightseagreen',
  'lightskyblue','lightslategray','lightslategrey','lightsteelblue','lightyellow',
  'lime','limegreen','linen','magenta','maroon','mediumaquamarine','mediumblue',
  'mediumorchid','mediumpurple','mediumseagreen','mediumslateblue',
  'mediumspringgreen','mediumturquoise','mediumvioletred','midnightblue',
  'mintcream','mistyrose','moccasin','navajowhite','navy','oldlace','olive',
  'olivedrab','orange','orangered','orchid','palegoldenrod','palegreen',
  'paleturquoise','palevioletred','papayawhip','peachpuff','peru','pink','plum',
  'powderblue','purple','rebeccapurple','red','rosybrown','royalblue',
  'saddlebrown','salmon','sandybrown','seagreen','seashell','sienna','silver',
  'skyblue','slateblue','slategray','slategrey','snow','springgreen','steelblue',
  'tan','teal','thistle','tomato','turquoise','violet','wheat','white',
  'whitesmoke','yellow','yellowgreen',
];
const SAFE_FLOWCHART_COLOR = `(?:${HEX_COLOR}|transparent|none|currentColor|${CSS_NAMED_COLORS.join('|')})`;
const FLOWCHART_CLASS_RESERVED_WORDS = new Set([
  'graph', 'flowchart', 'subgraph', 'end', 'classDef', 'class', 'style', 'click', 'direction',
]);

function isSafeFlowchartClassDefinition(source: string): boolean {
  const match = new RegExp(`^classDef${FLOWCHART_SPACE}+(${FLOWCHART_IDENTIFIER})${FLOWCHART_SPACE}+(.+?)${FLOWCHART_SPACE}*$`, 'u').exec(source);
  if (!match || !isFlowchartClassIdentifier(match[1])) return false;

  const seen = new Set<string>();
  const propertyPattern = new RegExp(`^(fill|stroke|color)${FLOWCHART_SPACE}*:${FLOWCHART_SPACE}*${SAFE_FLOWCHART_COLOR}$`, 'iu');
  const lengthPattern = /^(?:stroke-width|stroke-dasharray)[ \t]*:[ \t]*[0-9.]+(?:[ ,]+[0-9.]+)*px?$/;
  const properties = match[2].split(',').map(trimFlowchartWhitespace);
  return properties.length > 0 && properties.every(property => {
    const propertyMatch = propertyPattern.exec(property);
    if (propertyMatch) {
      if (seen.has(propertyMatch[1])) return false;
      seen.add(propertyMatch[1]);
      return true;
    }
    const lengthMatch = lengthPattern.exec(property);
    if (lengthMatch) {
      const name = property.split(':')[0].trim();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    }
    return false;
  });
}

function isSafeFlowchartStyleStatement(source: string): boolean {
  const match = new RegExp(`^style${FLOWCHART_SPACE}+(${FLOWCHART_IDENTIFIER})${FLOWCHART_SPACE}+(.+?)${FLOWCHART_SPACE}*$`, 'u').exec(source);
  if (!match) return false;

  const seen = new Set<string>();
  const propertyPattern = new RegExp(`^(fill|stroke|color)${FLOWCHART_SPACE}*:${FLOWCHART_SPACE}*${SAFE_FLOWCHART_COLOR}$`, 'iu');
  const lengthPattern = /^(?:stroke-width|stroke-dasharray)[ \t]*:[ \t]*[0-9.]+(?:[ ,]+[0-9.]+)*px?$/;
  const properties = match[2].split(',').map(trimFlowchartWhitespace);
  return properties.length > 0 && properties.every(property => {
    const propertyMatch = propertyPattern.exec(property);
    if (propertyMatch) {
      if (seen.has(propertyMatch[1])) return false;
      seen.add(propertyMatch[1]);
      return true;
    }
    const lengthMatch = lengthPattern.exec(property);
    if (lengthMatch) {
      const name = property.split(':')[0].trim();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    }
    return false;
  });
}

function isSafeFlowchartLinkStyleStatement(source: string): boolean {
  const match = new RegExp(`^linkStyle${FLOWCHART_SPACE}+(?:default|(?:\d+${FLOWCHART_SPACE}*,${FLOWCHART_SPACE}*)*\d+)${FLOWCHART_SPACE}+(.+?)${FLOWCHART_SPACE}*$`, 'iu').exec(source);
  if (!match) return false;
  const seen = new Set<string>();
  const colorPattern = new RegExp(`^(fill|stroke|color)${FLOWCHART_SPACE}*:${FLOWCHART_SPACE}*${SAFE_FLOWCHART_COLOR}$`);
  const lengthPattern = /^(?:stroke-width|stroke-dasharray)[ \t]*:[ \t]*[0-9.]+(?:[ ,]+[0-9.]+)*px?$/;
  const properties = match[1].split(',').map(trimFlowchartWhitespace);
  return properties.length > 0 && properties.every(property => {
    const colorMatch = colorPattern.exec(property);
    if (colorMatch) {
      if (seen.has(colorMatch[1])) return false;
      seen.add(colorMatch[1]);
      return true;
    }
    if (lengthPattern.test(property)) {
      const name = property.split(':')[0].trim();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    }
    return false;
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
    if (/^\s*rect\b/i.test(line.text) && !isSupportedSequenceRect(line.text)) {
      features.push(unsupportedSyntax(
        'sequence.advanced',
        line,
        'Sequence rect frames require rgb() or hexadecimal colors.',
        'error',
      ));
    }
  }
  return features;
}

function isSupportedSequenceRect(source: string): boolean {
  const rgb = /^\s*rect\s+rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$/i.exec(source);
  if (rgb !== null) return rgb.slice(1).every(channel => Number(channel) <= 255);
  // rgba() is shape-checked here; the parser performs the authoritative
  // channel and alpha validation with a precise parse diagnostic.
  const rgba = /^\s*rect\s+rgba\(\s*[+-]?[\d.]+\s*,\s*[+-]?[\d.]+\s*,\s*[+-]?[\d.]+\s*,\s*[+-]?[\d.]+\s*\)\s*$/i.exec(source);
  if (rgba !== null) return true;
  const hex = /^\s*rect\s+#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\s*$/i.exec(source);
  return hex !== null;
}

function detectUnsupportedClassFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*classDef\b|^\s*(?:cssClass|click)\b/i.test(line.text)) {
      features.push(unsupportedSyntax(
        'class.advanced',
        line,
        'Class classDef, cssClass, and click directives are not supported yet.',
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

function detectUnsupportedXyChartFeatures(_source: string): UnsupportedFeature[] {
  // Numeric x-axis ranges, horizontal orientation, axis titles, auto ranges,
  // and accTitle/accDescr are all supported; unsupported configuration only
  // appears via front-matter, which fails parsing with a precise diagnostic.
  return [];
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
    // Point styling (radius/color/stroke), :::class, and classDef are
    // supported; only front-matter configuration remains unsupported.
    if (/^(?:---|config:|themeVariables:)/i.test(trimmed)) {
      features.push(unsupportedSyntax('quadrant.advanced', line, 'Quadrant configuration and theme variables are not supported yet.', 'error'));
    }
  }
  return features;
}

function detectUnsupportedArchitectureFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trim();
    if (!trimmed || trimmed.startsWith('%%') || /^(?:architecture(?:-beta)?)$/.test(trimmed)) continue;
    const container = /^(?:service|group)\s+[A-Za-z0-9_]+\([A-Za-z0-9_]+\)\[[^\]\r\n]+\](?:\s+in\s+[A-Za-z0-9_]+)?$/.test(trimmed);
    const junction = /^junction\s+[A-Za-z0-9_]+$/.test(trimmed);
    const relationship = /^[A-Za-z0-9_]+:[TBLR]\s*(?:--|-->|<-->|<--)\s*[TBLR]:[A-Za-z0-9_]+$/.test(trimmed);
    if (!container && !junction && !relationship) {
      features.push(unsupportedSyntax(
        'architecture.advanced',
        line,
        'Architecture alignment directives, configuration, icon glyphs, and junctions inside groups are not supported yet.',
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
    if (/^(?:---|config:|ticketBaseUrl:)/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'kanban.advanced',
        line,
        'Kanban YAML configuration, ticketBaseUrl, and custom styles are not supported yet.',
        'error',
      ));
      continue;
    }
    const metadata = /@\{([^}\r\n]*)\}/.exec(trimmed);
    if (metadata) {
      // Only `@{ ticket: ... }` metadata is rendered on cards today.
      const keys = metadata[1]!.split(',').map(pair => pair.split(':')[0]!.trim().toLowerCase()).filter(Boolean);
      const base = trimmed.replace(/@\{[^}\r\n]*\}/, '').trim();
      const item = /^(?:[A-Za-z_][A-Za-z0-9_]*\[[^\]\r\n]+\]|\[[^\]\r\n]+\]|[^@\[\]\r\n]+)$/.test(base);
      if (!item || keys.some(key => key !== 'ticket')) {
        features.push(unsupportedSyntax(
          'kanban.advanced',
          line,
          'Kanban task metadata beyond `ticket` is not supported yet.',
          'error',
        ));
      }
      continue;
    }
    const item = /^(?:[A-Za-z_][A-Za-z0-9_]*\[[^\]\r\n]+\]|\[[^\]\r\n]+\]|[^@\[\]\r\n]+)$/.test(trimmed);
    if (!item) {
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
        'Treemap classes and styles are not supported yet.',
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
    // `graticule circle|polygon` and `ticks N` are supported; configuration
    // blocks, classes, and styles remain unsupported.
    if (/^(?:---|config:|themeVariables:|classDef\b|class\b|style\b|showLegend\b|accTitle:|accDescr:)/i.test(trimmed) || /:::[A-Za-z0-9_-]+/.test(trimmed)) {
      features.push(unsupportedSyntax(
        'radar.advanced',
        line,
        'Radar YAML configuration, classes, styles, and showLegend legends are not supported yet.',
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
        'Packet YAML configuration, classes, and styles are not supported yet.',
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
      ? [unsupportedSyntax('venn.advanced', line, 'Venn styles and text annotations are not supported yet.', 'error')]
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

function fullySupported(diagramType: DiagramType, capabilities: SyntaxCapability[]): DiagramSupportEntry {
  return {
    diagramType,
    status: 'supported',
    supportedSyntax: capabilities,
    unsupportedSyntax: [],
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
      { id: 'sequence.autonumber', label: 'autonumber labels with optional start and increment', status: 'supported' },
      { id: 'sequence.rect', label: 'rgb(), rgba(), and hex-framed sequence regions', status: 'supported' },
      { id: 'sequence.cross-ending', label: 'dashed cross-ended messages', status: 'supported' },
      { id: 'sequence.async-ending', label: 'async open-arrow messages (-) and --))', status: 'supported' },
      { id: 'sequence.lifecycle', label: 'create/destroy participant lifecycle with lifeline termination', status: 'supported' },
      { id: 'sequence.box', label: 'box participant groups with colors and labels', status: 'supported' },
      { id: 'sequence.links', label: 'bidirectional <-> links', status: 'supported' },
    ],
    unsupportedSyntax: [
      { id: 'sequence.advanced', label: 'multi-line note line breaks and invalid rect colors', status: 'unsupported' },
    ],
  };
}

function partialClass(): DiagramSupportEntry {
  return {
    diagramType: 'class',
    status: 'partial',
    supportedSyntax: [
      { id: 'class.definition', label: 'named class declarations', status: 'supported' },
      { id: 'class.members', label: 'member blocks, member shorthand lines, and classifier annotations rendered inside class boxes', status: 'supported' },
      { id: 'class.relations', label: 'inheritance, composition, aggregation, association, link, dependency, and realization relations with labels and quoted cardinalities', status: 'supported' },
      { id: 'class.namespaces', label: 'namespace containers rendered as labeled boxes', status: 'supported' },
      { id: 'class.style', label: 'style directives with safe hexadecimal or CSS named colors, stroke-width, and stroke-dasharray', status: 'supported' },
    ],
    unsupportedSyntax: [
      { id: 'class.advanced', label: 'classDef, cssClass, and click directives', status: 'unsupported' },
    ],
  };
}

function partialState(): DiagramSupportEntry {
  return { diagramType: 'state', status: 'partial', supportedSyntax: [
    { id: 'state.transition', label: 'named states, directed transitions, and labeled transitions', status: 'supported' },
    { id: 'state.pseudostates', label: 'start ([*]) and end ([*]) pseudostates', status: 'supported' },
    { id: 'state.composites', label: 'composite state blocks with flattened inner transitions and state aliases', status: 'supported' },
    { id: 'state.pseudostate-glyphs', label: 'choice diamonds and fork/join bars', status: 'supported' },
    { id: 'state.notes', label: 'left/right notes rendered as attached note boxes', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'state.advanced', label: 'concurrent regions render flattened into one graph (warned) and custom state styling', status: 'unsupported' },
  ] };
}

function partialEr(): DiagramSupportEntry {
  return { diagramType: 'er', status: 'partial', supportedSyntax: [
    { id: 'er.relationship', label: 'full crow’s-foot cardinality grammar (|o, ||, }o, }| -- .. o|, ||, o{, |{) with labels', status: 'supported' },
    { id: 'er.attributes', label: 'entity attribute blocks with key markers and comments rendered inside entity boxes', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'er.advanced', label: 'custom entity styling and relationship color directives', status: 'unsupported' },
  ] };
}

function partialTimeline(): DiagramSupportEntry {
  return { diagramType: 'timeline', status: 'partial', supportedSyntax: [
    { id: 'timeline.period-event', label: 'ordered period and event entries', status: 'supported' },
    { id: 'timeline.sections', label: 'section groupings rendered as period prefixes', status: 'supported' },
    { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' },
  ], unsupportedSyntax: [
    { id: 'timeline.advanced', label: 'advanced styling and event metadata', status: 'unsupported' },
  ] };
}

function partialMindmap(): DiagramSupportEntry { return { diagramType: 'mindmap', status: 'partial', supportedSyntax: [{ id: 'mindmap.indent', label: 'space-indented hierarchy', status: 'supported' }, { id: 'mindmap.shapes', label: 'square, rounded, circle, stadium, cylinder, hexagon, and asymmetric node shapes', status: 'supported' }, { id: 'mindmap.icons', label: 'FontAwesome 4 icons rendered from ::icon() declarations', status: 'supported' }], unsupportedSyntax: [{ id: 'mindmap.advanced', label: 'markdown strings and icon packs outside FontAwesome 4', status: 'unsupported' }] }; }
function partialRequirement(): DiagramSupportEntry { return { diagramType: 'requirement', status: 'partial', supportedSyntax: [{ id: 'requirement.block', label: 'typed requirement blocks with id, text, risk, and verification method', status: 'supported' }, { id: 'requirement.relationship', label: 'labeled semantic relationships', status: 'supported' }], unsupportedSyntax: [{ id: 'requirement.advanced', label: 'custom requirement styling and advanced relation syntax', status: 'unsupported' }] }; }
function partialGitGraph(): DiagramSupportEntry { return { diagramType: 'gitgraph', status: 'partial', supportedSyntax: [{ id: 'gitgraph.commit', label: 'commits with ids, tags, and types including HIGHLIGHT coloring', status: 'supported' }, { id: 'gitgraph.branch-merge', label: 'branch, checkout, and merge history', status: 'supported' }, { id: 'gitgraph.cherry-pick', label: 'cherry-pick commits across branches', status: 'supported' }], unsupportedSyntax: [{ id: 'gitgraph.advanced', label: 'custom branch ordering and reverse commit rendering', status: 'unsupported' }] }; }
function partialC4(): DiagramSupportEntry { return { diagramType: 'c4', status: 'partial', supportedSyntax: [{ id: 'c4.element', label: 'people, systems, containers, components, and external elements', status: 'supported' }, { id: 'c4.relationship', label: 'labeled directional relationships', status: 'supported' }, { id: 'c4.relationship-directions', label: 'Rel_Left/Right/Up/Down/Neighbor and BiRel', status: 'supported' }, { id: 'c4.boundaries', label: 'system, container, and enterprise boundaries plus deployment nodes rendered as containers', status: 'supported' }], unsupportedSyntax: [{ id: 'c4.advanced', label: 'custom element styling and relationship index macros', status: 'unsupported' }] }; }
function partialZenUml(): DiagramSupportEntry { return { diagramType: 'zenuml', status: 'partial', supportedSyntax: [{ id: 'zenuml.call', label: 'labeled direct calls', status: 'supported' }, { id: 'zenuml.return', label: 'labeled returns', status: 'supported' }, { id: 'zenuml.declarations', label: 'participant and actor declarations', status: 'supported' }], unsupportedSyntax: [{ id: 'zenuml.advanced', label: 'control blocks and async message forms', status: 'unsupported' }] }; }
function partialSankey(): DiagramSupportEntry { return { diagramType: 'sankey', status: 'partial', supportedSyntax: [{ id: 'sankey.csv', label: 'three-column weighted CSV records', status: 'supported' }, { id: 'sankey.dag', label: 'acyclic weighted flows', status: 'supported' }], unsupportedSyntax: [{ id: 'sankey.invalidCsv', label: 'malformed CSV and non-three-column records', status: 'unsupported' }, { id: 'sankey.invalidValue', label: 'zero, negative, and non-finite weights', status: 'unsupported' }, { id: 'sankey.cycle', label: 'cyclic flow graphs', status: 'unsupported' }, { id: 'sankey.advanced', label: 'diagram configuration and custom node styling', status: 'unsupported' }] }; }
function partialQuadrant(): DiagramSupportEntry { return { diagramType: 'quadrant', status: 'partial', supportedSyntax: [{ id: 'quadrant.axes', label: 'title, axis labels, and quadrant captions', status: 'supported' }, { id: 'quadrant.points', label: 'normalized [0, 1] coordinate points', status: 'supported' }, { id: 'quadrant.point-styling', label: 'direct radius, color, stroke-color, and stroke-width point styles', status: 'supported' }, { id: 'quadrant.classes', label: 'classDef definitions and :::class point references', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'quadrant.advanced', label: 'front-matter configuration and theme variables', status: 'unsupported' }] }; }
function partialXyChart(): DiagramSupportEntry { return { diagramType: 'xychart', status: 'partial', supportedSyntax: [{ id: 'xychart.categorical-axis', label: 'categorical x-axis labels (with optional titles) and numeric y-axis ranges', status: 'supported' }, { id: 'xychart.numeric-axis', label: 'numeric x-axis ranges and auto y-axis ranges from data', status: 'supported' }, { id: 'xychart.horizontal', label: 'horizontal XY chart orientation', status: 'supported' }, { id: 'xychart.axis-titles', label: 'quoted or unquoted x/y-axis titles', status: 'supported' }, { id: 'xychart.bar-line-series', label: 'ordered bar and line series', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'xychart.advanced', label: 'front-matter configuration, data labels, named series legends, and theme variables', status: 'unsupported' }] }; }
function partialArchitecture(): DiagramSupportEntry { return { diagramType: 'architecture', status: 'partial', supportedSyntax: [{ id: 'architecture.service', label: 'labeled services with validated icon identifiers, including `in <group>` membership', status: 'supported' }, { id: 'architecture.relationship', label: 'direct port-to-port lines, target arrows, and bidirectional arrows', status: 'supported' }, { id: 'architecture.groups', label: 'group containers rendered as labeled boxes', status: 'supported' }, { id: 'architecture.junctions', label: 'junction nodes', status: 'supported' }], unsupportedSyntax: [{ id: 'architecture.advanced', label: 'align directives, configuration, icon glyphs, and junctions inside groups', status: 'unsupported' }] }; }
function partialBlock(): DiagramSupportEntry { return { diagramType: 'block', status: 'partial', supportedSyntax: [{ id: 'block.grid', label: 'flat rows, columns, and span declarations', status: 'supported' }, { id: 'block.relationship', label: 'direct -- and --> relationships between declared blocks', status: 'supported' }], unsupportedSyntax: [{ id: 'block.advanced', label: 'nested blocks, block arrows, custom shapes, classes, styles, configuration, and edge labels', status: 'unsupported' }] }; }
function partialKanban(): DiagramSupportEntry { return { diagramType: 'kanban', status: 'partial', supportedSyntax: [{ id: 'kanban.columns', label: 'ordered columns with bracketed or bare labels', status: 'supported' }, { id: 'kanban.tasks', label: 'space-indented tasks within columns', status: 'supported' }, { id: 'kanban.tickets', label: 'task `@{ ticket }` metadata rendered on cards', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'kanban.advanced', label: 'YAML configuration, ticketBaseUrl, custom styles, and metadata keys beyond `ticket`', status: 'unsupported' }] }; }
function partialTreemap(): DiagramSupportEntry { return { diagramType: 'treemap', status: 'partial', supportedSyntax: [{ id: 'treemap.hierarchy', label: 'quoted, space-indented category hierarchy', status: 'supported' }, { id: 'treemap.leaf-value', label: 'positive numeric leaf values', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'treemap.advanced', label: 'YAML configuration, classes, and styles', status: 'unsupported' }] }; }
function partialRadar(): DiagramSupportEntry { return { diagramType: 'radar', status: 'partial', supportedSyntax: [{ id: 'radar.axes', label: 'three or more named axes', status: 'supported' }, { id: 'radar.curves', label: 'finite numeric curves with matching axis values', status: 'supported' }, { id: 'radar.range', label: 'title and min/max numeric range', status: 'supported' }, { id: 'radar.graticule', label: 'graticule circle or polygon ring shape with ticks count', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'radar.advanced', label: 'YAML configuration, classes, styles, and showLegend legends', status: 'unsupported' }] }; }
function partialPacket(): DiagramSupportEntry { return { diagramType: 'packet', status: 'partial', supportedSyntax: [{ id: 'packet.bit-range', label: 'ordered absolute start-end bit ranges', status: 'supported' }, { id: 'packet.sequential-width', label: 'ordered +width bit fields', status: 'supported' }, { id: 'packet.title', label: 'optional packet title', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'packet.advanced', label: 'YAML configuration, classes, and styles', status: 'unsupported' }] }; }
function partialVenn(): DiagramSupportEntry { return { diagramType: 'venn', status: 'partial', supportedSyntax: [{ id: 'venn.set', label: 'two or more named sets with optional display labels', status: 'supported' }, { id: 'venn.union', label: 'labeled unions of declared sets', status: 'supported' }, { id: 'venn.title', label: 'optional title', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'venn.advanced', label: 'sizes, text annotations, and custom configuration', status: 'unsupported' }] }; }
function partialSwimlanes(): DiagramSupportEntry { return { diagramType: 'swimlanes', status: 'partial', supportedSyntax: [{ id: 'swimlanes.basic-lanes', label: 'top-level subgraph lanes with optional labels', status: 'supported' }, { id: 'swimlanes.nodes', label: 'square-bracket lane nodes', status: 'supported' }, { id: 'swimlanes.edges', label: 'directed edges with optional pipe labels', status: 'supported' }], unsupportedSyntax: [{ id: 'swimlanes.advanced', label: 'configuration, nested lanes, classes, styles, and advanced shapes', status: 'unsupported' }] }; }
function partialTreeview(): DiagramSupportEntry { return { diagramType: 'treeview', status: 'partial', supportedSyntax: [{ id: 'treeview.indent', label: 'space-indented hierarchy beneath tree', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'treeview.advanced', label: 'configuration, styles, icons, and custom shapes', status: 'unsupported' }] }; }
function partialIshikawa(): DiagramSupportEntry { return { diagramType: 'ishikawa', status: 'partial', supportedSyntax: [{ id: 'ishikawa.indent', label: 'indented effect, categories, and nested causes', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'ishikawa.advanced', label: 'custom styling', status: 'unsupported' }] }; }
function partialEventModeling(): DiagramSupportEntry { return { diagramType: 'event-modeling', status: 'partial', supportedSyntax: [{ id: 'event-modeling.timeframe', label: 'ordered tf/timeframe and rf/resetframe entity frames', status: 'supported' }, { id: 'event-modeling.entities', label: 'ui, processor, command, readmodel, and event entity types', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'event-modeling.advanced', label: 'data-block rendering, configuration, classes, and styles', status: 'unsupported' }] }; }
function partialWardley(): DiagramSupportEntry { return { diagramType: 'wardley', status: 'partial', supportedSyntax: [{ id: 'wardley.components', label: 'coordinate-based anchor and component declarations', status: 'supported' }, { id: 'wardley.dependencies', label: 'direct dependencies between declared components', status: 'supported' }, { id: 'wardley.title', label: 'optional map title', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'wardley.advanced', label: 'evolution, pipelines, notes, annotations, strategies, decorators, custom stages, configuration, classes, and styles', status: 'unsupported' }] }; }
function partialCynefin(): DiagramSupportEntry { return { diagramType: 'cynefin', status: 'partial', supportedSyntax: [{ id: 'cynefin.domains', label: 'the five fixed domains with quoted items', status: 'supported' }, { id: 'cynefin.transitions', label: 'directed transitions with optional quoted labels', status: 'supported' }, { id: 'cynefin.title', label: 'optional framework title', status: 'supported' }, { id: 'acc.accessibility', label: 'accTitle and accDescr directives surfaced as the SVG accessible name and description', status: 'supported' }], unsupportedSyntax: [{ id: 'cynefin.advanced', label: 'custom appearance, classes, and styles', status: 'unsupported' }] }; }

function detectUnsupportedSwimlaneFeatures(source: string): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  for (const line of linesWithRanges(source)) {
    if (/^\s*(?:%%\{init|classDef|class|style|linkStyle|click|accTitle|accDescr|---|config:)\b/i.test(line.text) || /@\{\s*shape\s*:|:::/i.test(line.text)) {
      features.push(unsupportedSyntax('swimlanes.advanced', line, 'Swimlane configuration, styles, classes, nested lanes, and advanced shapes are not supported yet.', 'error'));
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
      features.push(unsupportedSyntax('cynefin.advanced', line, 'Cynefin configuration, classes, styles, and custom appearance are not supported yet.', 'error'));
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
