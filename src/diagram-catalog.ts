export const MERMAID_COMPATIBILITY_VERSION = '11.16.0' as const;

export const DIAGRAM_CATALOG = [
  ['flowchart', /^(?:graph|flowchart)\b/i],
  ['swimlanes', /^swimlanes\b/i],
  ['sequence', /^sequenceDiagram\b/i],
  ['class', /^classDiagram\b/i],
  ['state', /^stateDiagram(?:-v2)?\b/i],
  ['er', /^erDiagram\b/i],
  ['user-journey', /^journey\b/i],
  ['gantt', /^gantt\b/i],
  ['pie', /^pie\b/i],
  ['quadrant', /^quadrantChart\b/i],
  ['requirement', /^requirementDiagram\b/i],
  ['gitgraph', /^gitGraph\b/i],
  ['c4', /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i],
  ['mindmap', /^mindmap\b/i],
  ['timeline', /^timeline\b/i],
  ['zenuml', /^zenuml\b/i],
  ['sankey', /^sankey(?:-beta)?\b/i],
  ['xychart', /^xychart(?:-beta)?\b/i],
  ['block', /^block-beta\b/i],
  ['packet', /^packet\b/i],
  ['kanban', /^kanban\b/i],
  ['architecture', /^architecture-beta\b/i],
  ['radar', /^radar-beta\b/i],
  ['event-modeling', /^eventModeling\b/i],
  ['treemap', /^treemap-beta\b/i],
  ['venn', /^venn-beta\b/i],
  ['ishikawa', /^ishikawa-beta\b/i],
  ['wardley', /^wardley\b/i],
  ['cynefin', /^cynefin\b/i],
  ['treeview', /^tree\b/i],
] as const satisfies readonly (readonly [string, RegExp])[];

export type DiagramType = typeof DIAGRAM_CATALOG[number][0];
export type DetectedDiagramType = DiagramType | 'unknown';

export function detectDiagramType(source: string): DetectedDiagramType {
  const firstLine = source.trimStart().split(/\r?\n/, 1)[0]?.trim() ?? '';
  return DIAGRAM_CATALOG.find(([, pattern]) => pattern.test(firstLine))?.[0] ?? 'unknown';
}
