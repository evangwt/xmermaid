export const MERMAID_COMPATIBILITY_VERSION = '11.16.0' as const;

export const DIAGRAM_CATALOG = [
  ['flowchart', /^(?:graph|flowchart)\b/],
  ['swimlanes', /^swimlane(?:-beta)?\b/],
  ['sequence', /^sequenceDiagram\b/],
  ['class', /^classDiagram\b/],
  ['state', /^stateDiagram(?:-v2)?\b/],
  ['er', /^erDiagram\b/],
  ['user-journey', /^journey\b/],
  ['gantt', /^gantt\b/],
  ['pie', /^pie\b/],
  ['quadrant', /^quadrantChart\b/],
  ['requirement', /^requirementDiagram\b/],
  ['gitgraph', /^gitGraph\b/],
  ['c4', /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/],
  ['mindmap', /^mindmap\b/],
  ['timeline', /^timeline\b/],
  ['zenuml', /^zenuml\b/],
  ['sankey', /^sankey(?:-beta)?\b/],
  ['xychart', /^xychart(?:-beta)?\b/],
  ['block', /^block(?:-beta)?\b/],
  ['packet', /^packet\b/],
  ['kanban', /^kanban\b/],
  ['architecture', /^architecture(?:-beta)?\b/],
  ['radar', /^radar(?:-beta)?\b/],
  ['event-modeling', /^eventModeling\b/i],
  ['treemap', /^treemap(?:-beta)?\b/],
  ['venn', /^venn(?:-beta)?\b/],
  ['ishikawa', /^ishikawa(?:-beta)?\b/],
  ['wardley', /^wardley\b/],
  ['cynefin', /^cynefin\b/],
  ['treeview', /^tree\b/],
] as const satisfies readonly (readonly [string, RegExp])[];

export type DiagramType = typeof DIAGRAM_CATALOG[number][0];
export type DetectedDiagramType = DiagramType | 'unknown';

export function detectDiagramType(source: string): DetectedDiagramType {
  // Leading blank lines, `%%` comment/init-directive lines, and one leading
  // front-matter block are all consumed before the diagram header; none of
  // them change the diagram type. Header keywords are case-sensitive,
  // matching the Rust parser dispatch exactly.
  const lines = source.trimStart().split(/\r?\n/).map(line => line.trim());
  const skipIgnorable = (index: number): number => {
    while (index < lines.length && (lines[index] === '' || lines[index]!.startsWith('%%'))) index += 1;
    return index;
  };
  let index = skipIgnorable(0);
  if (lines[index] === '---') {
    let closing = index + 1;
    while (closing < lines.length && lines[closing] !== '---') closing += 1;
    if (closing < lines.length) {
      index = skipIgnorable(closing + 1);
    }
  }
  const firstLine = lines[index] ?? '';
  return DIAGRAM_CATALOG.find(([, pattern]) => pattern.test(firstLine))?.[0] ?? 'unknown';
}
