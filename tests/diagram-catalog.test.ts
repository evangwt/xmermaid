import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_CATALOG,
  MERMAID_COMPATIBILITY_VERSION,
  detectDiagramType,
} from '../src/diagram-catalog';

describe('Mermaid 11.16.0 diagram catalog', () => {
  it('contains the complete documented compatibility baseline', () => {
    expect(MERMAID_COMPATIBILITY_VERSION).toBe('11.16.0');
    expect(DIAGRAM_CATALOG.map(([id]) => id)).toEqual([
      'flowchart', 'swimlanes', 'sequence', 'class', 'state', 'er',
      'user-journey', 'gantt', 'pie', 'quadrant', 'requirement', 'gitgraph',
      'c4', 'mindmap', 'timeline', 'zenuml', 'sankey', 'xychart', 'block',
      'packet', 'kanban', 'architecture', 'radar', 'event-modeling', 'treemap',
      'venn', 'ishikawa', 'wardley', 'cynefin', 'treeview',
    ]);
  });

  it.each([
    ['Pie\n  "a": 1', 'unknown'],
    ['Gantt\n  section S\n  T : 2024-01-01, 1d', 'unknown'],
    ['gitgraph\n  commit', 'unknown'],
    ['pie\n  "a": 1', 'pie'],
    ['\n\npie\n  "a": 1', 'pie'],
    ['%%{init: {}}%%\npie\n  "a": 1', 'pie'],
    ['---\ntitle: T\n---\npie\n  "a": 1', 'pie'],
    ['eventModeling\n  tf 01 ui Cart', 'event-modeling'],
  ])('detects %s as %s', (source, type) => {
    expect(detectDiagramType(source)).toBe(type);
  });

  it.each([
    ['sequenceDiagram\nAlice->>Bob: ping', 'sequence'],
    ['classDiagram\nAnimal <|-- Duck', 'class'],
    ['stateDiagram-v2\n[*] --> Ready', 'state'],
    ['erDiagram\nUSER ||--o{ ORDER : places', 'er'],
    ['architecture-beta\nservice api(server)', 'architecture'],
    ['packet\n+16: "Source Port"', 'packet'],
    ['treemap-beta\nroot', 'treemap'],
  ])('detects %s as %s', (source, type) => {
    expect(detectDiagramType(source)).toBe(type);
  });
});
