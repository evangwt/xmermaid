import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

const SOURCE = `kanban
  todo[To do]
    write[Write documentation]
  doing[In progress]
    ship[Ship native renderer]
  done[Done]`;

describe('Kanban Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses, identifies, and lays out ordered columns with their tasks', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      columns: { id: string; label: string; tasks: { id: string; label: string }[] }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      kanban_board: { columns: { id: string; header: { x: number }; tasks: { id: string }[] }[] };
      nodes: unknown[];
      edges: unknown[];
    };

    expect(ast).toMatchObject({ type: 'kanban' });
    expect(ast.columns).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'todo', label: 'To do', tasks: [expect.objectContaining({ id: 'write' })] }),
      expect.objectContaining({ id: 'doing', label: 'In progress', tasks: [expect.objectContaining({ id: 'ship' })] }),
    ]));
    expect(getDiagramType(astJson)).toBe('kanban');
    expect(layout.kanban_board.columns).toHaveLength(3);
    expect(layout.kanban_board.columns[0]!.header.x).toBeLessThan(layout.kanban_board.columns[1]!.header.x);
    expect(layout.kanban_board.columns[1]!.tasks).toEqual([expect.objectContaining({ id: 'ship' })]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });
});
