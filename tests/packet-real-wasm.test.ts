import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

// Mermaid 11.16.0: https://mermaid.js.org/syntax/packet.html
const SOURCE = `packet
title UDP Packet
+16: "Source Port"
+16: "Destination Port"
32-47: "Length"
48-63: "Checksum"
64-95: "Data (variable length)"`;

describe('Packet Diagram real WASM contract', () => {
  beforeAll(async () => {
    await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  });

  it('parses sequential and absolute bit fields into a native table layout', () => {
    const astJson = parseDsl(SOURCE);
    const ast = JSON.parse(astJson) as {
      type: string;
      title: string;
      fields: { start: number; end: number; label: string }[];
    };
    const layout = renderWithConfig(SOURCE, null) as {
      packet: {
        title: string;
        fields: { start: number; end: number; label: string; segments: { width: number; height: number }[] }[];
      };
      nodes: unknown[];
      edges: unknown[];
    };

    expect(ast).toMatchObject({ type: 'packet', title: 'UDP Packet' });
    expect(ast.fields).toEqual([
      { start: 0, end: 15, label: 'Source Port' },
      { start: 16, end: 31, label: 'Destination Port' },
      { start: 32, end: 47, label: 'Length' },
      { start: 48, end: 63, label: 'Checksum' },
      { start: 64, end: 95, label: 'Data (variable length)' },
    ]);
    expect(getDiagramType(astJson)).toBe('packet');
    expect(layout.packet).toMatchObject({ title: 'UDP Packet' });
    expect(layout.packet.fields).toHaveLength(5);
    expect(layout.packet.fields[4]).toMatchObject({ start: 64, end: 95, label: 'Data (variable length)' });
    expect(layout.packet.fields[4]?.segments[0]?.width).toBeGreaterThan(layout.packet.fields[0]?.segments[0]?.width ?? 0);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });
});
