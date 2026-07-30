import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, {
  get_diagram_type as getDiagramType,
  parse_dsl as parseDsl,
  render_with_config as renderWithConfig,
} from '../pkg/xmermaid_wasm.js';

beforeAll(async () => {
  await initWasmPackage({
    module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm'),
  });
});

describe('Sequence real WASM contract', () => {
  it('parses declared participants and actor aliases into labeled sequence nodes', () => {
    const source = [
      'sequenceDiagram',
      '  participant Alice',
      '  participant Payments as Payment service',
      '  actor User',
      '  User->>Payments: Sign in',
      '  Payments-->>User: Signed in',
    ].join('\n');
    const astJson = parseDsl(source);
    const ast = JSON.parse(astJson);
    const layout = renderWithConfig(source, null) as {
      sequence: {
        participants: { id: string; label: string; kind: string }[];
        lifelines: { participant: string }[];
        messages: { from: string; to: string; label: string; dashed: boolean }[];
      };
    };

    expect(ast).toMatchObject({
      type: 'sequence',
      participants: [
        { id: 'Alice', label: 'Alice', kind: 'participant' },
        { id: 'Payments', label: 'Payment service', kind: 'participant' },
        { id: 'User', label: 'User', kind: 'actor' },
      ],
    });
    expect(getDiagramType(astJson)).toBe('sequence');
    expect(layout.sequence.participants).toMatchObject([
      { id: 'Alice', label: 'Alice', kind: 'participant' },
      { id: 'Payments', label: 'Payment service', kind: 'participant' },
      { id: 'User', label: 'User', kind: 'actor' },
    ]);
    expect(layout.sequence.lifelines).toHaveLength(3);
    expect(layout.sequence.messages).toMatchObject([
      { from: 'User', to: 'Payments', label: 'Sign in', dashed: false },
      { from: 'Payments', to: 'User', label: 'Signed in', dashed: true },
    ]);
  });

  it('preserves activation, notes, and alternate branches through the real WASM layout', () => {
    const source = [
      'sequenceDiagram',
      '  participant Client',
      '  participant API',
      '  Client->>+API: Request',
      '  Note right of API: Validate request',
      '  alt Accepted',
      '    API-->>-Client: Response',
      '  else Rejected',
      '    API-->>Client: Denied',
      '  end',
    ].join('\n');
    const ast = JSON.parse(parseDsl(source));
    const layout = renderWithConfig(source, null) as {
      sequence: {
        messages: { label: string; dashed: boolean }[];
        activations: { participant: string; bounds: { height: number } }[];
        notes: { text: string }[];
        blocks: { kind: string; label: string; dividers: { label: string }[] }[];
      };
    };

    expect(ast.events.map((event: { kind: string }) => event.kind)).toEqual([
      'message', 'note', 'block_start', 'message', 'block_divider', 'message', 'block_end',
    ]);
    expect(layout.sequence.messages).toMatchObject([
      { label: 'Request', dashed: false },
      { label: 'Response', dashed: true },
      { label: 'Denied', dashed: true },
    ]);
    expect(layout.sequence.activations).toMatchObject([{ participant: 'API' }]);
    expect(layout.sequence.activations[0]?.bounds.height).toBeGreaterThan(0);
    expect(layout.sequence.notes).toMatchObject([{ text: 'Validate request' }]);
    expect(layout.sequence.blocks).toMatchObject([{ kind: 'alt', label: 'Accepted', dividers: [{ label: 'Rejected' }] }]);
  });

  it('preserves document autonumber, RGB rect frames, and cross-ended messages through the real WASM layout', () => {
    const source = [
      'sequenceDiagram',
      '  autonumber',
      '  participant EventBus',
      '  participant CraneJob',
      '  rect rgb(255, 235, 235)',
      '    EventBus--xCraneJob: Drop Stop',
      '  end',
    ].join('\n');
    const ast = JSON.parse(parseDsl(source));
    const layout = renderWithConfig(source, null) as {
      sequence: {
        messages: { label: string; number: number; end_marker: string; dashed: boolean }[];
        blocks: { kind: string; color: string | null }[];
      };
    };

    expect(ast.events.map((event: { kind: string }) => event.kind)).toEqual([
      'autonumber', 'block_start', 'message', 'block_end',
    ]);
    expect(ast.messages).toMatchObject([{ end_marker: 'cross', line_style: 'dashed' }]);
    expect(layout.sequence.messages).toMatchObject([
      { label: 'Drop Stop', number: 1, end_marker: 'cross', dashed: true },
    ]);
    expect(layout.sequence.blocks).toMatchObject([{ kind: 'rect', color: 'rgb(255, 235, 235)' }]);
  });

  it('sizes sequence geometry from participant, message, and scoped block content', () => {
    const source = [
      'sequenceDiagram',
      '  participant Client as Crane STK Stack Machine',
      '  participant API as API',
      '  participant Store as PostgreSQL Task Repository',
      '  participant Audit as Audit',
      '  Client->>Client: Publish a snapshot after every observed device state change',
      '  par Persist task state independently',
      '    API->>Store: Persist a command that must remain attributable to its physical task generation',
      '  and Append audit trail independently',
      '    API->>Audit: Record a committed result for the same command generation',
      '  end',
    ].join('\n');
    const layout = renderWithConfig(source, null) as {
      dimensions: { width: number };
      sequence: {
        participants: { id: string; header: { width: number } }[];
        messages: { from: string; label_position?: { x: number }; self_width?: number }[];
        blocks: { kind: string; bounds: { width: number } }[];
      };
    };

    const client = layout.sequence.participants.find(participant => participant.id === 'Client');
    const selfMessage = layout.sequence.messages.find(message => message.from === 'Client');
    const parallel = layout.sequence.blocks.find(block => block.kind === 'par');

    expect(client?.header.width).toBeGreaterThan(170);
    expect(selfMessage?.self_width).toBeGreaterThan(100);
    expect(selfMessage?.label_position?.x).toBeGreaterThan(0);
    expect(parallel?.bounds.width).toBeLessThan(layout.dimensions.width - 160);
  });
});
