import type { SourceRange } from '../types/diagnostics';
import type { RenderDiagnostic } from './index';

export type RepairConfidence = 'high' | 'medium' | 'low';

export interface RepairSuggestion {
  id: string;
  title: string;
  confidence: RepairConfidence;
  range: SourceRange | null;
  before: string;
  after: string;
  reason: string;
}

const DIRECTION_FIXES: Record<string, string> = {
  TDD: 'TD',
  TDB: 'TB',
  LEFT: 'LR',
  RIGHT: 'RL',
};

export function suggestRepairs(source: string, diagnostics: RenderDiagnostic[]): RepairSuggestion[] {
  if (diagnostics.length === 0) return [];

  if (diagnostics.some(diagnostic => diagnostic.code === 'unsupported_diagram_type')) {
    return [{
      id: 'unsupported-diagram-type',
      title: 'Unsupported diagram type',
      confidence: 'low',
      range: diagnostics[0]?.range ?? null,
      before: '',
      after: '',
      reason: 'This diagram type is not supported by the current renderer.',
    }];
  }

  const suggestions: RepairSuggestion[] = [];
  const range = diagnostics[0]?.range ?? null;
  const trimmed = source.trim();

  if (hasEdgeSyntax(trimmed) && !hasDiagramHeader(trimmed)) {
    suggestions.push({
      id: 'add-flowchart-header',
      title: 'Add flowchart header',
      confidence: 'high',
      range,
      before: source,
      after: `flowchart TD\n${source.trimStart()}`,
      reason: 'Mermaid flowcharts need a graph or flowchart direction header.',
    });
  }

  const directionRepair = directionTypoRepair(source, range);
  if (directionRepair) suggestions.push(directionRepair);

  const arrowRepair = arrowTypoRepair(source, range);
  if (arrowRepair) suggestions.push(arrowRepair);

  const labelRepair = unclosedLabelRepair(source, range);
  if (labelRepair) suggestions.push(labelRepair);

  return suggestions;
}

export function applyRepair(source: string, suggestion: RepairSuggestion): string {
  if (!suggestion.before) return source;
  if (
    suggestion.range
    && suggestion.range.startOffset >= 0
    && suggestion.range.endOffset <= source.length
    && source.slice(suggestion.range.startOffset, suggestion.range.endOffset) === suggestion.before
  ) {
    return `${source.slice(0, suggestion.range.startOffset)}${suggestion.after}${source.slice(suggestion.range.endOffset)}`;
  }
  const index = source.indexOf(suggestion.before);
  if (index === -1) return source;
  return `${source.slice(0, index)}${suggestion.after}${source.slice(index + suggestion.before.length)}`;
}

function hasDiagramHeader(source: string): boolean {
  return /^(graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i.test(source);
}

function hasEdgeSyntax(source: string): boolean {
  return /(?:-->|==>|=>)/.test(source);
}

function directionTypoRepair(source: string, range: SourceRange | null): RepairSuggestion | null {
  const firstLine = source.split('\n')[0] ?? '';
  const match = firstLine.match(/^(\s*(?:graph|flowchart)\s+)([A-Za-z]+)(\b.*)$/i);
  if (!match) return null;

  const fixed = DIRECTION_FIXES[match[2].toUpperCase()];
  if (!fixed) return null;

  return {
    id: 'fix-direction-typo',
    title: 'Fix direction typo',
    confidence: 'high',
    range,
    before: firstLine.trim(),
    after: `${match[1]}${fixed}${match[3]}`.trim(),
    reason: 'The flowchart direction must be TD, TB, BT, LR, or RL.',
  };
}

function arrowTypoRepair(source: string, range: SourceRange | null): RepairSuggestion | null {
  const line = source.split('\n').find(item => /==>|=>/.test(item));
  if (!line) return null;

  const before = line.trim();
  return {
    id: 'fix-arrow-typo',
    title: 'Fix arrow typo',
    confidence: 'high',
    range,
    before,
    after: before.replace(/==>|=>/, '-->'),
    reason: 'Use --> for a standard flowchart edge.',
  };
}

function unclosedLabelRepair(source: string, range: SourceRange | null): RepairSuggestion | null {
  const line = source.split('\n').find(item => /\[[^\]]+\s+(?:-->|==>|=>)\s+/.test(item));
  if (!line) return null;

  const before = line.trim();
  const match = before.match(/^([A-Za-z0-9_-]+)\[([^\]]+?)\s+(-->|==>|=>)\s+(.+)$/);
  if (!match) return null;

  return {
    id: 'close-label-bracket',
    title: 'Close label bracket',
    confidence: 'high',
    range,
    before,
    after: `${match[1]}[${match[2]}] ${match[3]} ${match[4]}`,
    reason: 'The node label appears to be missing a closing bracket.',
  };
}
