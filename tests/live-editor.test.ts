import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as editorModule from '../src/editor';
import * as publicApi from '../src/index';
import { XMermaid } from '../src/xmermaid';
import { XMermaidError } from '../src/types/error';

const { extractDiagrams, XMermaidLiveEditor } = editorModule;

const markdownWithTwoDiagrams = [
  '# Architecture',
  '',
  '```mermaid',
  'graph TD',
  '  A[Start] --> B[End]',
  '```',
  '',
  'Some prose between diagrams.',
  '',
  '```mermaid',
  'flowchart LR',
  '  C[Client] --> D[Server]',
  '```',
].join('\n');

describe('extractDiagrams', () => {
  it('indexes source ranges without rescanning every diagram prefix', () => {
    const text = Array.from({ length: 5_000 }, (_, index) => [
      '```mermaid',
      'flowchart TD',
      `  A${index} --> B${index}`,
      '```',
    ].join('\n')).join('\n\n');

    extractDiagrams(text);
    const startedAt = performance.now();
    const document = extractDiagrams(text);
    const elapsedMs = performance.now() - startedAt;

    expect(document.diagrams).toHaveLength(5_000);
    expect(document.diagrams[0]?.range.startLine).toBe(2);
    expect(document.diagrams.at(-1)?.range.startLine).toBe(24_997);
    expect(elapsedMs).toBeLessThan(500);
  });

  it('extracts multiple mermaid fenced blocks from a document', () => {
    const document = extractDiagrams(markdownWithTwoDiagrams);

    expect(document.diagrams).toHaveLength(2);
    expect(document.diagrams[0]).toMatchObject({
      id: 'diagram-1',
      index: 0,
      origin: 'markdown-fence',
      language: 'mermaid',
      diagramType: 'flowchart',
      source: 'graph TD\n  A[Start] --> B[End]',
    });
    expect(document.diagrams[1]).toMatchObject({
      id: 'diagram-2',
      index: 1,
      source: 'flowchart LR\n  C[Client] --> D[Server]',
    });
  });

  it('extracts a pure Mermaid document as one raw block', () => {
    const document = extractDiagrams('graph TD\n  A --> B');

    expect(document.diagrams).toHaveLength(1);
    expect(document.diagrams[0]).toMatchObject({
      id: 'diagram-1',
      origin: 'raw-mermaid-block',
      source: 'graph TD\n  A --> B',
      diagramType: 'flowchart',
    });
  });

  it('returns an empty diagram list for prose-only input', () => {
    const document = extractDiagrams('# Notes\n\nNo diagrams here.');

    expect(document.diagrams).toEqual([]);
    expect(document.diagnostics).toEqual([]);
  });

  it('reports a fenced content range that can be sliced without fence markers', () => {
    const text = [
      'Intro',
      '```mermaid',
      '  graph TD',
      '    A --> B',
      '```',
      'Outro',
    ].join('\n');
    const document = extractDiagrams(text);
    const [diagram] = document.diagrams;

    expect(text.slice(diagram.range.startOffset, diagram.range.endOffset))
      .toBe('  graph TD\n    A --> B');
    expect(diagram.source).toBe('graph TD\n    A --> B');
    expect(diagram.range).toMatchObject({
      startLine: 3,
      endLine: 4,
    });
  });

  it('reports a raw Mermaid range that excludes surrounding whitespace', () => {
    const text = '\n\n  flowchart LR\n    A --> B  \n\n';
    const document = extractDiagrams(text);
    const [diagram] = document.diagrams;

    expect(text.slice(diagram.range.startOffset, diagram.range.endOffset))
      .toBe('flowchart LR\n    A --> B');
    expect(diagram.origin).toBe('raw-mermaid-block');
    expect(diagram.range).toMatchObject({
      startLine: 3,
      endLine: 4,
    });
  });
});

describe('replaceDiagramSource', () => {
  it('is exported from both the editor module and root public API', () => {
    expect((editorModule as Record<string, unknown>).replaceDiagramSource)
      .toBeTypeOf('function');
    expect((publicApi as Record<string, unknown>).replaceDiagramSource)
      .toBeTypeOf('function');
  });

  it('replaces one fenced diagram source while preserving prose, fences, and sibling diagrams', () => {
    const document = extractDiagrams(markdownWithTwoDiagrams);
    const nextSource = 'graph TD\n  X[Next] --> Y[Done]';
    const result = replaceDiagramSource(markdownWithTwoDiagrams, 'diagram-1', nextSource, document);

    expect(result.text).toContain(`\`\`\`mermaid\n${nextSource}\n\`\`\``);
    expect(result.text).toContain('Some prose between diagrams.');
    expect(result.text).toContain('flowchart LR\n  C[Client] --> D[Server]');
    expect(result.document.text).toBe(result.text);
    expect(result.document.diagrams).toHaveLength(2);
    expect(result.document.diagrams[0].source).toBe(nextSource);
    expect(result.document.diagrams[1].source).toBe('flowchart LR\n  C[Client] --> D[Server]');
  });

  it('replaces raw Mermaid source while preserving surrounding whitespace', () => {
    const text = '\n\n  graph TD\n    A --> B  \n\n';
    const document = extractDiagrams(text);
    const nextSource = 'flowchart LR\n  C --> D';
    const result = replaceDiagramSource(text, 'diagram-1', nextSource, document);

    expect(result.text).toBe(`\n\n  ${nextSource}  \n\n`);
    expect(result.document.diagrams).toHaveLength(1);
    expect(result.document.diagrams[0].source).toBe(nextSource);
  });

  it('returns the original text with a diagnostic when the diagram id is missing', () => {
    const document = extractDiagrams(markdownWithTwoDiagrams);
    const result = replaceDiagramSource(markdownWithTwoDiagrams, 'missing-diagram', 'graph TD\n  X --> Y', document);

    expect(result.text).toBe(markdownWithTwoDiagrams);
    expect(result.document.text).toBe(markdownWithTwoDiagrams);
    expect(result.document.diagrams).toHaveLength(2);
    expect(result.document.diagnostics).toContainEqual({
      code: 'diagram_not_found',
      message: 'Diagram missing-diagram was not found.',
      severity: 'error',
      range: null,
    });
  });
});

describe('syntax repair rules', () => {
  const parseDiagnostic = [{
    code: 'parse_error',
    message: 'parse failed',
    severity: 'error',
    range: null,
  }];

  it('suggests adding a flowchart header when edge syntax has no graph declaration', () => {
    const suggestions = suggestRepairs('A --> B', parseDiagnostic);

    expect(suggestions).toContainEqual(expect.objectContaining({
      id: 'add-flowchart-header',
      confidence: 'high',
      before: 'A --> B',
      after: 'flowchart TD\nA --> B',
    }));
  });

  it('suggests repairing common direction typos', () => {
    const suggestions = suggestRepairs('flowchart TDD\n  A --> B', parseDiagnostic);

    expect(suggestions).toContainEqual(expect.objectContaining({
      id: 'fix-direction-typo',
      confidence: 'high',
      before: 'flowchart TDD',
      after: 'flowchart TD',
    }));
  });

  it('suggests repairing common arrow typos', () => {
    const suggestions = suggestRepairs('flowchart TD\n  A ==> B', parseDiagnostic);

    expect(suggestions).toContainEqual(expect.objectContaining({
      id: 'fix-arrow-typo',
      confidence: 'high',
      before: 'A ==> B',
      after: 'A --> B',
    }));
  });

  it('suggests repairing a simple unclosed label bracket', () => {
    const suggestions = suggestRepairs('flowchart TD\n  A[Start --> B', parseDiagnostic);

    expect(suggestions).toContainEqual(expect.objectContaining({
      id: 'close-label-bracket',
      confidence: 'high',
      before: 'A[Start --> B',
      after: 'A[Start] --> B',
    }));
  });

  it('returns a low-confidence hint for unsupported diagrams without an apply rewrite', () => {
    const suggestions = suggestRepairs('sequenceDiagram\n  A->>B: Hi', [{
      code: 'unsupported_diagram_type',
      message: 'unsupported',
      severity: 'error',
      range: null,
    }]);

    expect(suggestions).toEqual([expect.objectContaining({
      id: 'unsupported-diagram-type',
      confidence: 'low',
      before: '',
      after: '',
    })]);
  });

  it('applies only the first exact before match', () => {
    const source = 'flowchart TD\n  A ==> B\n  B ==> C';
    const nextSource = applyRepair(source, {
      id: 'fix-arrow-typo',
      title: 'Fix arrow typo',
      confidence: 'high',
      range: null,
      before: 'B ==> C',
      after: 'B --> C',
      reason: 'Common arrow typo.',
    });

    expect(nextSource).toBe('flowchart TD\n  A ==> B\n  B --> C');
  });

  it('uses a precise source range when repeated repair text appears more than once', () => {
    const source = 'flowchart TD\n  A ==> B\n  A ==> B';
    const secondMatch = source.lastIndexOf('A ==> B');

    const nextSource = applyRepair(source, {
      id: 'fix-arrow-typo',
      title: 'Fix arrow typo',
      confidence: 'high',
      range: {
        startOffset: secondMatch,
        endOffset: secondMatch + 'A ==> B'.length,
        startLine: 3,
        endLine: 3,
      },
      before: 'A ==> B',
      after: 'A --> B',
      reason: 'Common arrow typo.',
    });

    expect(nextSource).toBe('flowchart TD\n  A ==> B\n  A --> B');
  });
});

describe('XMermaidLiveEditor', () => {
  it('renders a diagram list, defaults to the first diagram, and switches selection', async () => {
    const root = document.createElement('div');
    const rendered: string[] = [];
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram: vi.fn(async ({ source, container }) => {
        rendered.push(source);
        container.textContent = `rendered:${source.split('\n')[0]}`;
      }),
    });

    await editor.mount();

    const items = root.querySelectorAll<HTMLButtonElement>('[data-xm-diagram-item]');
    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]');
    const preview = root.querySelector<HTMLElement>('[data-xm-preview]');

    expect(items).toHaveLength(2);
    expect(items[0].classList.contains('is-selected')).toBe(true);
    expect(selectedSource?.value).toBe('graph TD\n  A[Start] --> B[End]');
    expect(preview?.textContent).toBe('rendered:graph TD');

    items[1].click();
    await Promise.resolve();

    expect(root.querySelector<HTMLButtonElement>('[data-xm-diagram-item].is-selected')?.textContent)
      .toContain('Diagram 2');
    expect(selectedSource?.value).toBe('flowchart LR\n  C[Client] --> D[Server]');
    expect(rendered.at(-1)).toBe('flowchart LR\n  C[Client] --> D[Server]');
  });

  it('uses the selected diagram direction for layout when switching diagrams', async () => {
    const root = document.createElement('div');
    const renderDiagram = vi.fn(async ({ container }) => {
      container.textContent = 'rendered';
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram,
    });

    await editor.mount();
    root.querySelectorAll<HTMLButtonElement>('[data-xm-diagram-item]')[1].click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(renderDiagram).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'flowchart LR\n  C[Client] --> D[Server]',
      layoutConfig: expect.objectContaining({ direction: 'LR' }),
    }));
    expect(root.querySelector<HTMLSelectElement>('[data-xm-layout-direction]')?.value)
      .toBe('LR');
  });

  it('rerenders with edited selected source and displays render errors', async () => {
    const root = document.createElement('div');
    const renderDiagram = vi.fn(async ({ source, container }) => {
      if (source.includes('BROKEN')) {
        throw new Error('parse failed');
      }
      container.textContent = source;
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram,
    });

    await editor.mount();
    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;
    selectedSource.value = 'graph TD\n  A --> BROKEN';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(renderDiagram).toHaveBeenLastCalledWith(expect.objectContaining({
      source: 'graph TD\n  A --> BROKEN',
    }));
    expect(root.querySelector('[data-xm-preview-error]')?.textContent).toContain('parse failed');
    expect(root.querySelectorAll('[data-xm-diagram-item]')).toHaveLength(1);
  });

  it('commits selected source edits back to the document before switching diagrams', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram: vi.fn(async ({ source, container }) => {
        container.textContent = source;
      }),
    });

    await editor.mount();

    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;
    const documentInput = root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')!;
    selectedSource.value = 'graph TD\n  Edited[Edited] --> B[End]';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(documentInput.value).toContain('Edited[Edited]');
    root.querySelectorAll<HTMLButtonElement>('[data-xm-diagram-item]')[1].click();
    await new Promise(resolve => setTimeout(resolve, 0));
    root.querySelectorAll<HTMLButtonElement>('[data-xm-diagram-item]')[0].click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
      .toContain('Edited[Edited]');
  });

  it('ignores stale async render results after a newer render completes', async () => {
    const root = document.createElement('div');
    let releaseSlowRender: (() => void) | null = null;
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async ({ source, container }) => {
        if (source.includes('Slow')) {
          await new Promise<void>(resolve => {
            releaseSlowRender = resolve;
          });
          container.textContent = 'rendered slow';
          return;
        }
        container.textContent = `rendered:${source.includes('Fast') ? 'fast' : 'initial'}`;
      }),
    });

    await editor.mount();
    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;

    selectedSource.value = 'graph TD\n  Slow --> B';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    selectedSource.value = 'graph TD\n  Fast --> B';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector('[data-xm-preview]')?.textContent).toBe('rendered:fast');
    releaseSlowRender?.();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector('[data-xm-preview]')?.textContent).toBe('rendered:fast');
  });

  it('shows an empty state when no diagrams are present', async () => {
    const root = document.createElement('div');
    const renderDiagram = vi.fn();
    const editor = new XMermaidLiveEditor({
      root,
      initialText: '# Notes only',
      renderDiagram,
    });

    await editor.mount();

    expect(root.querySelector('[data-xm-empty]')?.textContent).toContain('No Mermaid diagrams found');
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('shows render diagnostics with the selected diagram range when rendering throws', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram: vi.fn(async () => {
        throw new Error('render failed');
      }),
    });

    await editor.mount();

    const diagnostic = root.querySelector<HTMLElement>('[data-xm-diagnostic-item]');
    expect(diagnostic?.getAttribute('data-xm-diagnostic-code')).toBe('render_error');
    expect(diagnostic?.textContent).toContain('render failed');
    expect(diagnostic?.textContent).toContain('Lines 4-5');
    expect(root.querySelector('[data-xm-preview-error]')?.textContent).toContain('render failed');
  });

  it('maps XMermaidError codes into render diagnostics', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async () => {
        throw new XMermaidError('PARSE_ERROR', 'unexpected token');
      }),
    });

    await editor.mount();

    const diagnostic = root.querySelector<HTMLElement>('[data-xm-diagnostic-item]');
    expect(diagnostic?.getAttribute('data-xm-diagnostic-code')).toBe('parse_error');
    expect(diagnostic?.textContent).toContain('unexpected token');
    expect(diagnostic?.textContent).toContain('Lines 1-2');
  });

  it('clears render diagnostics after a successful rerender', async () => {
    const root = document.createElement('div');
    let shouldFail = true;
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async ({ container }) => {
        if (shouldFail) {
          throw new Error('first render failed');
        }
        container.textContent = 'rendered ok';
      }),
    });

    await editor.mount();
    expect(root.querySelector('[data-xm-diagnostic-item]')?.textContent)
      .toContain('first render failed');

    shouldFail = false;
    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;
    selectedSource.value = 'graph TD\n  A --> C';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector('[data-xm-diagnostic-item]')).toBeNull();
    expect(root.querySelector('[data-xm-diagnostics-empty]')?.textContent)
      .toContain('No diagnostics');
  });

  it('shows SDK diagnostics returned by the default render path without hiding the preview', async () => {
    const root = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('xmermaid-diagram');
    const renderSpy = vi.spyOn(XMermaid.prototype, 'renderToSVGElement').mockResolvedValue({
      diagramType: 'flowchart',
      diagnostics: [{
        code: 'unsupported_syntax',
        message: 'Flowchart classDef statements are not supported yet.',
        severity: 'warning',
        featureId: 'flowchart.classDef',
        range: {
          startOffset: 18,
          endOffset: 45,
          startLine: 3,
          startColumn: 3,
          endLine: 3,
          endColumn: 30,
        },
      }],
      dimensions: { width: 200, height: 120 },
      svg,
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: [
        'graph TD',
        '  A --> B',
        '  classDef hot fill:#fff',
      ].join('\n'),
    });

    try {
      await editor.mount();
    } finally {
      renderSpy.mockRestore();
    }

    expect(root.querySelector('svg.xmermaid-diagram')).not.toBeNull();
    const diagnostic = root.querySelector<HTMLElement>('[data-xm-diagnostic-item]');
    expect(diagnostic?.getAttribute('data-xm-diagnostic-code')).toBe('unsupported_syntax');
    expect(diagnostic?.textContent).toContain('Lines 3-3');
    expect(root.querySelector('[data-xm-preview-error]')).toBeNull();
  });

  it('passes SDK render options through the default render path', async () => {
    const root = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const renderSpy = vi.spyOn(XMermaid.prototype, 'renderToSVGElement').mockResolvedValue({
      diagramType: 'flowchart',
      diagnostics: [],
      dimensions: { width: 200, height: 120 },
      svg,
    });
    const wasmUrl = new URL('https://cdn.example.com/xmermaid_wasm_bg.wasm');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      xmermaidOptions: {
        wasm: { wasmUrl },
        securityLevel: 'loose',
      },
    });

    try {
      await editor.mount();
      expect(renderSpy).toHaveBeenCalledWith('graph TD\n  A --> B', {
        wasm: { wasmUrl },
        securityLevel: 'loose',
      });
    } finally {
      renderSpy.mockRestore();
    }
  });

  it('keeps the last successful preview visible when a later render fails', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async ({ source, container }) => {
        if (source.includes('BROKEN')) {
          throw new XMermaidError('PARSE_ERROR', 'bad edit');
        }
        container.textContent = 'last good preview';
      }),
    });

    await editor.mount();
    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;
    selectedSource.value = 'graph TD\n  A --> BROKEN';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector('[data-xm-preview]')?.textContent).toContain('last good preview');
    expect(root.querySelector('[data-xm-preview-error]')?.textContent).toContain('bad edit');
  });

  it('updates diagnostics to the clicked diagram range', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram: vi.fn(async ({ diagram }) => {
        if (diagram.id === 'diagram-2') {
          throw new Error('second diagram failed');
        }
      }),
    });

    await editor.mount();
    expect(root.querySelector('[data-xm-diagnostic-item]')).toBeNull();

    root.querySelectorAll<HTMLButtonElement>('[data-xm-diagram-item]')[1].click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const diagnostic = root.querySelector<HTMLElement>('[data-xm-diagnostic-item]');
    expect(diagnostic?.textContent).toContain('second diagram failed');
    expect(diagnostic?.textContent).toContain('Lines 11-12');
  });

  it('shows an empty diagnostics state when no diagrams are present', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: '# Notes only',
      renderDiagram: vi.fn(),
    });

    await editor.mount();

    expect(root.querySelector('[data-xm-diagnostics-empty]')?.textContent)
      .toContain('No diagnostics');
  });

  it('maps unsupported diagram errors without treating them as parse errors', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async () => {
        throw new XMermaidError('UNSUPPORTED_DIAGRAM', 'sequence diagrams are not supported');
      }),
    });

    await editor.mount();

    const diagnostic = root.querySelector<HTMLElement>('[data-xm-diagnostic-item]');
    expect(diagnostic?.getAttribute('data-xm-diagnostic-code')).toBe('unsupported_diagram_type');
    expect(diagnostic?.textContent).not.toContain('parse_error');
  });

  it('prefers diagnostics carried by XMermaidError over whole-diagram fallback diagnostics', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B\n  classDef hot fill:#fff',
      renderDiagram: vi.fn(async () => {
        throw new XMermaidError('RENDER_ERROR', 'structured failure', {
          diagnostics: [{
            code: 'unsupported_syntax',
            message: 'Flowchart classDef statements are not supported yet.',
            severity: 'warning',
            featureId: 'flowchart.classDef',
            range: {
              startOffset: 18,
              endOffset: 45,
              startLine: 3,
              startColumn: 3,
              endLine: 3,
              endColumn: 30,
            },
          }],
        });
      }),
    });

    await editor.mount();

    const diagnostic = root.querySelector<HTMLElement>('[data-xm-diagnostic-item]');
    expect(diagnostic?.getAttribute('data-xm-diagnostic-code')).toBe('unsupported_syntax');
    expect(diagnostic?.textContent).toContain('Lines 3-3');
    expect(diagnostic?.textContent).not.toContain('render_error');
  });

  it('uses strict security policy in the default render path', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A-->B\n  click A javascript:alert(1)',
    });

    await editor.mount();

    const diagnosticCodes = Array.from(root.querySelectorAll<HTMLElement>('[data-xm-diagnostic-item]'))
      .map(item => item.getAttribute('data-xm-diagnostic-code'));
    expect(diagnosticCodes).toContain('security_blocked_click');
    expect(diagnosticCodes).toContain('security_blocked_url');
    expect(root.querySelector('[data-xm-preview-error]')?.textContent).toContain('blocked');
  });

  it('shows a high-confidence repair suggestion and applies it to the selected source', async () => {
    const root = document.createElement('div');
    const rendered: string[] = [];
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A ==> B',
      renderDiagram: vi.fn(async ({ source, container }) => {
        rendered.push(source);
        if (source.includes('==>')) {
          throw new XMermaidError('PARSE_ERROR', 'bad arrow');
        }
        container.textContent = `rendered:${source.split('\n')[0]}`;
      }),
    });

    await editor.mount();

    const suggestion = root.querySelector<HTMLElement>('[data-xm-repair-suggestion]');
    const applyButton = root.querySelector<HTMLButtonElement>('[data-xm-repair-apply]');
    expect(suggestion?.textContent).toContain('Fix arrow typo');
    expect(applyButton?.disabled).toBe(false);

    applyButton?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
      .toBe('flowchart TD\n  A --> B');
    expect(rendered.at(-1)).toBe('flowchart TD\n  A --> B');
    expect(root.querySelector('[data-xm-diagnostic-item]')).toBeNull();
  });

  it('commits applied repairs back to the document text', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: [
        'Intro',
        '```mermaid',
        'flowchart TD',
        '  A ==> B',
        '```',
      ].join('\n'),
      renderDiagram: vi.fn(async ({ source, container }) => {
        if (source.includes('==>')) {
          throw new XMermaidError('PARSE_ERROR', 'bad arrow');
        }
        container.textContent = source;
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-repair-apply]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value)
      .toContain('A --> B');
  });

  it('does not render an apply button for unsupported diagram hints', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async () => {
        throw new XMermaidError('UNSUPPORTED_DIAGRAM', 'sequence diagrams are not supported');
      }),
    });

    await editor.mount();

    expect(root.querySelector('[data-xm-repair-suggestion]')?.textContent)
      .toContain('Unsupported diagram type');
    expect(root.querySelector('[data-xm-repair-apply]')).toBeNull();
  });

  it('shares the current document state through location hash', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;
    selectedSource.value = 'graph TD\n  Shared[Shared] --> B[End]';
    selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    root.querySelector<HTMLButtonElement>('[data-xm-share-link]')?.click();

    const decoded = decodeShareState(window.location.hash);
    expect(decoded?.documentText).toContain('Shared[Shared]');
    expect(decoded?.selectedDiagramId).toBe('diagram-1');
  });

  it('restores document text and selected diagram from a share hash on mount', async () => {
    const root = document.createElement('div');
    window.location.hash = encodeShareState(markdownWithTwoDiagrams, 'diagram-2');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  Placeholder --> Ignored',
      renderDiagram: vi.fn(async ({ source, container }) => {
        container.textContent = source;
      }),
    });

    try {
      await editor.mount();

      expect(root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value)
        .toBe(markdownWithTwoDiagrams);
      expect(root.querySelector<HTMLButtonElement>('[data-xm-diagram-item].is-selected')?.textContent)
        .toContain('Diagram 2');
      expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
        .toBe('flowchart LR\n  C[Client] --> D[Server]');
    } finally {
      window.location.hash = '';
    }
  });

  it('ignores non-xmermaid hashes when mounting with initial text', async () => {
    const root = document.createElement('div');
    window.location.hash = encodeURIComponent(JSON.stringify({
      documentText: markdownWithTwoDiagrams,
      selectedDiagramId: 'diagram-2',
    }));
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  Initial --> Text',
      renderDiagram: vi.fn(async ({ source, container }) => {
        container.textContent = source;
      }),
    });

    try {
      await editor.mount();

      expect(root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value)
        .toBe('graph TD\n  Initial --> Text');
      expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
        .toBe('graph TD\n  Initial --> Text');
    } finally {
      window.location.hash = '';
    }
  });

  it('exports the current rendered SVG from the toolbar', async () => {
    const root = document.createElement('div');
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:current-preview');
    URL.revokeObjectURL = vi.fn();
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async ({ container }) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.textContent = 'current preview';
        container.appendChild(svg);
      }),
    });

    try {
      await editor.mount();
      const exported = new Promise<void>(resolve => {
        root.addEventListener('xmermaid:exported', () => resolve(), { once: true });
      });
      root.querySelector<HTMLButtonElement>('[data-xm-export-svg]')?.click();
      await exported;

      const link = root.querySelector<HTMLAnchorElement>('[data-xm-download-link]');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/svg+xml' }));
      expect(link?.download).toBe('diagram-1.svg');
      expect(link?.href).toBe('blob:current-preview');
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
    }
  });

  it('does not export a stale preview after the current source fails to render', async () => {
    const root = document.createElement('div');
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:stale-preview');
    URL.revokeObjectURL = vi.fn();
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async ({ source, container }) => {
        if (source.includes('BROKEN')) {
          throw new Error('parse failed');
        }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.textContent = source;
        container.appendChild(svg);
      }),
    });

    try {
      await editor.mount();
      const selectedSource = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')!;
      selectedSource.value = 'graph TD\n  A --> BROKEN';
      selectedSource.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));

      const exported = vi.fn();
      root.addEventListener('xmermaid:exported', exported);
      root.querySelector<HTMLButtonElement>('[data-xm-export-svg]')?.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      const link = root.querySelector<HTMLAnchorElement>('[data-xm-download-link]');
      expect(exported).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(link?.hidden).toBe(true);
      expect(root.querySelector<HTMLElement>('[data-xm-diagnostic-item]')?.textContent)
        .toContain('current diagram has not rendered successfully');
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
    }
  });

  it('exports the current rendered SVG as PNG from the toolbar', async () => {
    const root = document.createElement('div');
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalImage = globalThis.Image;
    const originalCreateElement = document.createElement.bind(document);
    URL.createObjectURL = vi.fn(() => 'blob:png-preview');
    URL.revokeObjectURL = vi.fn();
    globalThis.Image = class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 16;
      naturalHeight = 16;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    } as unknown as typeof Image;
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['png'], { type: 'image/png' })),
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement;
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'graph TD\n  A --> B',
      renderDiagram: vi.fn(async ({ container }) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        container.appendChild(svg);
      }),
    });

    try {
      await editor.mount();
      const exported = new Promise<void>(resolve => {
        root.addEventListener('xmermaid:exported', () => resolve(), { once: true });
      });
      root.querySelector<HTMLButtonElement>('[data-xm-export-png]')?.click();
      await exported;

      const link = root.querySelector<HTMLAnchorElement>('[data-xm-download-link]');
      expect(URL.createObjectURL).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'image/png' }));
      expect(link?.download).toBe('diagram-1.png');
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      globalThis.Image = originalImage;
      document.createElement = originalCreateElement;
    }
  });

  it('copies the selected source and full document from toolbar buttons', async () => {
    const root = document.createElement('div');
    const writeText = vi.fn(async () => {});
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: markdownWithTwoDiagrams,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    try {
      await editor.mount();
      root.querySelector<HTMLButtonElement>('[data-xm-copy-source]')?.click();
      root.querySelector<HTMLButtonElement>('[data-xm-copy-document]')?.click();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(writeText).toHaveBeenNthCalledWith(1, 'graph TD\n  A[Start] --> B[End]');
      expect(writeText).toHaveBeenNthCalledWith(2, markdownWithTwoDiagrams);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  it('applies theme and layout controls to subsequent renders', async () => {
    const root = document.createElement('div');
    const renderDiagram = vi.fn(async ({ container }) => {
      container.textContent = 'rendered';
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A --> B',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram,
    });

    await editor.mount();
    const themeSelect = root.querySelector<HTMLSelectElement>('[data-xm-theme-select]')!;
    const directionSelect = root.querySelector<HTMLSelectElement>('[data-xm-layout-direction]')!;
    themeSelect.value = 'dark';
    themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    directionSelect.value = 'LR';
    directionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(renderDiagram).toHaveBeenLastCalledWith(expect.objectContaining({
      themeId: 'dark',
      layoutConfig: expect.objectContaining({ direction: 'LR' }),
      source: expect.stringContaining('flowchart TD'),
    }));
    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
      .toContain('flowchart TD');
    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value)
      .toContain('flowchart TD');
  });

  it('applies the current layout direction to source only through the explicit source direction control', async () => {
    const root = document.createElement('div');
    const renderDiagram = vi.fn(async ({ container }) => {
      container.textContent = 'rendered';
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A --> B',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram,
    });

    await editor.mount();
    const directionSelect = root.querySelector<HTMLSelectElement>('[data-xm-layout-direction]')!;
    directionSelect.value = 'LR';
    directionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
      .toContain('flowchart TD');

    root.querySelector<HTMLButtonElement>('[data-xm-apply-source-direction]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
      .toContain('flowchart LR');
    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value)
      .toContain('flowchart LR');
  });

  it('blocks source direction edits for unsupported visual sources', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A --> B\n  classDef hot fill:#fff',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    const directionSelect = root.querySelector<HTMLSelectElement>('[data-xm-layout-direction]')!;
    directionSelect.value = 'LR';
    directionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    root.querySelector<HTMLButtonElement>('[data-xm-apply-source-direction]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const source = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value ?? '';
    expect(source).toContain('flowchart TD');
    expect(source).toContain('classDef hot fill:#fff');
    expect(root.querySelector<HTMLElement>('[data-xm-diagnostic-item]')?.getAttribute('data-xm-diagnostic-code'))
      .toBe('visual_unsupported_syntax');
  });

  it('renames nodes through the visual flowchart editor and writes Mermaid back', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A[Start] --> B[End]',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-visual-toggle]')?.click();
    const nodeId = root.querySelector<HTMLInputElement>('[data-xm-visual-node-id]')!;
    const nodeLabel = root.querySelector<HTMLInputElement>('[data-xm-visual-node-label]')!;
    nodeId.value = 'A';
    nodeLabel.value = 'Begin';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-rename-node]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value)
      .toContain('A[Begin]');
    expect(root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value)
      .toContain('A[Begin]');
  });

  it('adds nodes and edges through the visual flowchart editor', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A[Start] --> B[End]',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-visual-toggle]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-id]')!.value = 'C';
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-label]')!.value = 'Done';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-add-node]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-edge-from]')!.value = 'B';
    root.querySelector<HTMLInputElement>('[data-xm-visual-edge-to]')!.value = 'C';
    root.querySelector<HTMLInputElement>('[data-xm-visual-edge-label]')!.value = 'next';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-add-edge]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const source = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value ?? '';
    expect(source).toContain('C[Done]');
    expect(source).toContain('B -->|next| C');
  });

  it('removes nodes and edges through the visual flowchart editor', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A --> B\n  B --> C',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-visual-toggle]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-edge-id]')!.value = 'A-B-1';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-remove-edge]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-id]')!.value = 'B';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-remove-node]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const source = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value ?? '';
    expect(source).not.toContain('A --> B');
    expect(source).not.toContain('B --> C');
    expect(source).toContain('A');
    expect(source).toContain('C');
  });

  it('blocks visual edits for unsupported flowchart source without changing document text', async () => {
    const root = document.createElement('div');
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A --> B\n  classDef hot fill:#fff',
      parseFlowchartDsl: parseFlowchartDslForTest,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-visual-toggle]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-id]')!.value = 'A';
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-label]')!.value = 'Begin';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-rename-node]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const source = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value ?? '';
    const documentText = root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value ?? '';
    expect(source).toBe('flowchart TD\n  A --> B\n  classDef hot fill:#fff');
    expect(documentText).toBe('flowchart TD\n  A --> B\n  classDef hot fill:#fff');
    expect(root.querySelector<HTMLElement>('[data-xm-diagnostic-item]')?.getAttribute('data-xm-diagnostic-code'))
      .toBe('visual_unsupported_syntax');
  });

  it('blocks visual edits that would serialize to different parsed label semantics', async () => {
    const root = document.createElement('div');
    const parseFlowchartDsl = vi.fn((source: string) => {
      const label = source.includes('Bad))') ? 'Bad' : 'Start';
      return JSON.stringify({
        type: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'A', label, shape: 'rounded', classes: [], styles: [] },
          { id: 'B', label: 'End', shape: 'rect', classes: [], styles: [] },
        ],
        edges: [
          { from: 'A', to: 'B', style: 'arrow', label: null, min_length: 1 },
        ],
        subgraphs: [],
      });
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A(Start) --> B[End]',
      parseFlowchartDsl,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-visual-toggle]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-id]')!.value = 'A';
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-label]')!.value = 'Bad)';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-rename-node]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const source = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value ?? '';
    const documentText = root.querySelector<HTMLTextAreaElement>('[data-xm-document-input]')?.value ?? '';
    expect(source).toBe('flowchart TD\n  A(Start) --> B[End]');
    expect(documentText).toBe('flowchart TD\n  A(Start) --> B[End]');
    expect(root.querySelector<HTMLElement>('[data-xm-diagnostic-item]')?.getAttribute('data-xm-diagnostic-code'))
      .toBe('visual_roundtrip_failed');
  });
});

describe('share and export helpers', () => {
  it('roundtrips share state through a URL-hash-safe string', () => {
    const encoded = encodeShareState('# Doc\n\n```mermaid\ngraph TD\n  A --> B\n```', 'diagram-1');
    const decoded = decodeShareState(encoded);

    expect(decoded).toEqual({
      documentText: '# Doc\n\n```mermaid\ngraph TD\n  A --> B\n```',
      selectedDiagramId: 'diagram-1',
    });
    expect(decodeShareState('#not-valid-json')).toBeNull();
    expect(decodeShareState(encodeURIComponent(JSON.stringify({
      documentText: 'graph TD\n  Wrong --> Hash',
      selectedDiagramId: 'diagram-1',
    })))).toBeNull();
  });

  it('exports the provided current SVG without re-rendering', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'Current Preview';
    svg.appendChild(text);

    const blob = await exportDiagram({
      diagramId: 'diagram-1',
      source: 'graph TD\n  A --> B',
      svg,
      format: 'svg',
      fileName: 'diagram.svg',
    });

    expect(blob.type).toBe('image/svg+xml');
    await expect(blob.text()).resolves.toContain('Current Preview');
  });

  it('uses viewBox dimensions for PNG export when image natural size is unavailable', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalImage = globalThis.Image;
    const originalCreateElement = document.createElement.bind(document);
    const canvases: Array<{ width: number; height: number }> = [];
    URL.createObjectURL = vi.fn(() => 'blob:viewbox-preview');
    URL.revokeObjectURL = vi.fn();
    globalThis.Image = class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    } as unknown as typeof Image;
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: (blob: Blob | null) => void) => {
            canvases.push({ width: canvas.width, height: canvas.height });
            callback(new Blob(['png'], { type: 'image/png' }));
          },
        };
        return canvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 640 360');

    try {
      const blob = await exportDiagram({
        diagramId: 'diagram-1',
        source: 'graph TD\n  A --> B',
        svg,
        format: 'png',
      });

      expect(blob.type).toBe('image/png');
      expect(canvases).toEqual([{ width: 640, height: 360 }]);
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      globalThis.Image = originalImage;
      document.createElement = originalCreateElement;
    }
  });
});

describe('flowchart graph model helpers', () => {
  it('derives graph model from AST without dropping shapes, edge metadata, or subgraphs', () => {
    const model = flowchartAstToGraph({
      type: 'flowchart',
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'Start', shape: 'rounded', classes: [], styles: [] },
        { id: 'B', label: null, shape: 'diamond', classes: [], styles: [] },
      ],
      edges: [
        { from: 'A', to: 'B', style: 'thick', label: 'yes', min_length: 2 },
      ],
      subgraphs: [
        { title: 'Decision path', nodes: ['A', 'B'], subgraphs: [] },
      ],
    });

    expect(model).toEqual({
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'Start', shape: 'rounded' },
        { id: 'B', label: 'B', shape: 'diamond' },
      ],
      edges: [
        { id: 'A-B-1', from: 'A', to: 'B', label: 'yes', style: 'thick', min_length: 2 },
      ],
      subgraphs: [
        { title: 'Decision path', nodes: ['A', 'B'], subgraphs: [] },
      ],
    });
  });

  it('serializes supported shapes, edge styles, labels, and subgraphs', () => {
    const serialized = serializeFlowchart({
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'Start', shape: 'rounded' },
        { id: 'B', label: 'Decision', shape: 'diamond' },
        { id: 'C', label: 'Check', shape: 'circle' },
      ],
      edges: [
        { id: 'A-B-1', from: 'A', to: 'B', label: 'yes', style: 'thick', min_length: 1 },
        { id: 'B-C-2', from: 'B', to: 'C', style: 'dotted', min_length: 1 },
      ],
      subgraphs: [
        { title: 'Decision path', nodes: ['A', 'B'], subgraphs: [] },
      ],
    });

    expect(serialized).toContain('flowchart LR');
    expect(serialized).toContain('subgraph Decision path');
    expect(serialized).toContain('A(Start) ==>|yes| B{Decision}');
    expect(serialized).toContain('B -.-> C((Check))');
  });

  it('analyzes flowchart source through an injected AST parser', async () => {
    const parseDsl = vi.fn(() => JSON.stringify({
      type: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'Start', shape: 'rect', classes: [], styles: [] },
        { id: 'B', label: 'End', shape: 'rect', classes: [], styles: [] },
      ],
      edges: [
        { from: 'A', to: 'B', style: 'arrow', label: null, min_length: 1 },
      ],
      subgraphs: [],
    }));

    const analysis = await analyzeFlowchartForVisualEdit('flowchart TD\n  A --> B', { parseDsl });

    expect(parseDsl).toHaveBeenCalledWith('flowchart TD\n  A --> B');
    expect(analysis.capability).toBe('editable');
    expect(analysis.model).toMatchObject({
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'Start', shape: 'rect' },
        { id: 'B', label: 'End', shape: 'rect' },
      ],
    });
    expect(analysis.diagnostics).toEqual([]);
  });

  it('blocks unsupported source before invoking the AST parser', async () => {
    const parseDsl = vi.fn(() => {
      throw new Error('parse should not run for unsupported visual source');
    });

    const analysis = await analyzeFlowchartForVisualEdit(
      'flowchart TD\n  A --> B\n  classDef hot fill:#fff',
      { parseDsl },
    );

    expect(parseDsl).not.toHaveBeenCalled();
    expect(analysis).toEqual(expect.objectContaining({
      capability: 'read-only',
      model: null,
      diagnostics: [expect.objectContaining({
        code: 'visual_unsupported_syntax',
        range: expect.objectContaining({ startLine: 3 }),
      })],
    }));
  });

  it('reports analysis and validation diagnostics when parsing fails', async () => {
    const parseDsl = vi.fn(() => {
      throw new Error('bad flowchart');
    });

    await expect(analyzeFlowchartForVisualEdit('flowchart TD\n  A -->', { parseDsl }))
      .resolves.toEqual(expect.objectContaining({
        capability: 'read-only',
        model: null,
        diagnostics: [expect.objectContaining({ code: 'visual_parse_failed' })],
      }));

    await expect(validateVisualEditResult('flowchart TD\n  A -->', { parseDsl }))
      .resolves.toEqual(expect.objectContaining({
        status: 'blocked',
        source: 'flowchart TD\n  A -->',
        model: null,
        diagnostics: [expect.objectContaining({ code: 'visual_roundtrip_failed' })],
      }));
  });

  it('blocks visual validation when render/layout validation fails after parse succeeds', async () => {
    const parseDsl = vi.fn(() => JSON.stringify({
      type: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'A', label: null, shape: 'rect', classes: [], styles: [] },
        { id: 'B', label: null, shape: 'rect', classes: [], styles: [] },
      ],
      edges: [
        { from: 'A', to: 'B', style: 'arrow', label: null, min_length: 1 },
      ],
      subgraphs: [],
    }));
    const renderDsl = vi.fn(() => {
      throw new Error('layout failed');
    });

    await expect(validateVisualEditResult('flowchart TD\n  A --> B', { parseDsl, renderDsl }))
      .resolves.toEqual(expect.objectContaining({
        status: 'blocked',
        source: 'flowchart TD\n  A --> B',
        model: null,
        diagnostics: [expect.objectContaining({
          code: 'visual_render_failed',
          message: 'layout failed',
        })],
      }));
  });

  it('keeps shape and edge style when visual rename writes source through AST analysis', async () => {
    const root = document.createElement('div');
    const parseFlowchartDsl = vi.fn((source: string) => {
      const label = source.includes('A(Begin)') ? 'Begin' : 'Start';
      return JSON.stringify({
        type: 'flowchart',
        direction: 'TD',
        nodes: [
          { id: 'A', label, shape: 'rounded', classes: [], styles: [] },
          { id: 'B', label: 'End', shape: 'diamond', classes: [], styles: [] },
        ],
        edges: [
          { from: 'A', to: 'B', style: 'thick', label: 'yes', min_length: 1 },
        ],
        subgraphs: [],
      });
    });
    const editor = new XMermaidLiveEditor({
      root,
      initialText: 'flowchart TD\n  A(Start) ==>|yes| B{End}',
      parseFlowchartDsl,
      renderFlowchartDsl: renderFlowchartDslForTest,
      renderDiagram: vi.fn(async ({ container }) => {
        container.textContent = 'rendered';
      }),
    });

    await editor.mount();
    root.querySelector<HTMLButtonElement>('[data-xm-visual-toggle]')?.click();
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-id]')!.value = 'A';
    root.querySelector<HTMLInputElement>('[data-xm-visual-node-label]')!.value = 'Begin';
    root.querySelector<HTMLButtonElement>('[data-xm-visual-rename-node]')?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    const source = root.querySelector<HTMLTextAreaElement>('[data-xm-selected-source]')?.value ?? '';
    expect(source).toContain('A(Begin) ==>|yes| B{End}');
    expect(source).not.toContain('A[Begin]');
  });

  it('parses and serializes a simple flowchart model', () => {
    const model = parseFlowchartToGraph('flowchart LR\n  A[Start] --> B[End]');

    expect(model.direction).toBe('LR');
    expect(model.nodes).toEqual([
      expect.objectContaining({ id: 'A', label: 'Start' }),
      expect.objectContaining({ id: 'B', label: 'End' }),
    ]);
    expect(model.edges).toEqual([
      expect.objectContaining({ from: 'A', to: 'B' }),
    ]);
    expect(serializeFlowchart(model)).toContain('flowchart LR');
  });

  it('applies visual edits to nodes, edges, and direction', () => {
    let model = parseFlowchartToGraph('flowchart TD\n  A[Start] --> B[End]');
    model = applyVisualEdit(model, { type: 'rename-node', nodeId: 'A', label: 'Begin' });
    model = applyVisualEdit(model, { type: 'add-node', nodeId: 'C', label: 'Done' });
    model = applyVisualEdit(model, { type: 'add-edge', from: 'B', to: 'C', label: 'next' });
    model = applyVisualEdit(model, { type: 'set-direction', direction: 'LR' });

    expect(model.direction).toBe('LR');
    expect(model.nodes).toContainEqual(expect.objectContaining({ id: 'A', label: 'Begin' }));
    expect(model.edges).toContainEqual(expect.objectContaining({ from: 'B', to: 'C', label: 'next' }));

    const serialized = serializeFlowchart(model);
    expect(serialized).toContain('A[Begin]');
    expect(serialized).toContain('B -->|next| C');
  });

  it('removes incident edges when removing a node', () => {
    const model = applyVisualEdit(
      parseFlowchartToGraph('flowchart TD\n  A --> B\n  B --> C'),
      { type: 'remove-node', nodeId: 'B' },
    );

    expect(model.nodes.map(node => node.id)).toEqual(['A', 'C']);
    expect(model.edges).toEqual([]);
  });
});

describe('examples/live-editor.html', () => {
  it('does not seed browser examples with syntax blocked by the support matrix', () => {
    for (const file of ['examples/live-editor.html', 'examples/basic.html']) {
      const html = readFileSync(file, 'utf8');

      expect(html, `${file} should not ship parser-unsupported cylinder shape examples`)
        .not.toMatch(/\b[A-Za-z0-9_]+\[\([^\)\r\n]*\)\]/);
      expect(html, `${file} should not ship parser-unsupported stadium shape examples`)
        .not.toMatch(/\b[A-Za-z0-9_]+\(\[[^\]\r\n]*\]\)/);
    }
  });

  it('declares an inline favicon to keep browser verification console-clean', () => {
    const html = readFileSync('examples/live-editor.html', 'utf8');

    expect(html).toContain('rel="icon"');
    expect(html).toContain('data:image/svg+xml');
  });

  it('includes styles for the diagnostics panel', () => {
    const html = readFileSync('examples/live-editor.html', 'utf8');

    expect(html).toContain('[data-xm-diagnostics]');
    expect(html).toContain('[data-xm-diagnostic-item]');
  });

  it('includes styles for repair suggestions', () => {
    const html = readFileSync('examples/live-editor.html', 'utf8');

    expect(html).toContain('[data-xm-repair-suggestion]');
    expect(html).toContain('[data-xm-repair-apply]');
  });

  it('includes styles for toolbar and visual editor controls', () => {
    const html = readFileSync('examples/live-editor.html', 'utf8');

    expect(html).toContain('[data-xm-toolbar]');
    expect(html).toContain('[data-xm-visual-editor]');
  });
});

type ReplaceDiagramSource = (
  text: string,
  diagramId: string,
  nextSource: string,
  document: ReturnType<typeof extractDiagrams>,
) => { text: string; document: ReturnType<typeof extractDiagrams> };

function replaceDiagramSource(
  text: string,
  diagramId: string,
  nextSource: string,
  document: ReturnType<typeof extractDiagrams>,
): { text: string; document: ReturnType<typeof extractDiagrams> } {
  const replacement = (editorModule as typeof editorModule & {
    replaceDiagramSource?: ReplaceDiagramSource;
  }).replaceDiagramSource;
  expect(replacement, 'replaceDiagramSource should be exported from src/editor')
    .toBeTypeOf('function');
  return replacement!(text, diagramId, nextSource, document);
}

type RepairSuggestion = {
  id: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  range: ReturnType<typeof extractDiagrams>['diagrams'][number]['range'] | null;
  before: string;
  after: string;
  reason: string;
};

type SuggestRepairs = (
  source: string,
  diagnostics: Array<{
    code: string;
    message: string;
    severity: string;
    range: ReturnType<typeof extractDiagrams>['diagrams'][number]['range'] | null;
  }>,
) => RepairSuggestion[];

type ApplyRepair = (source: string, suggestion: RepairSuggestion) => string;

function suggestRepairs(
  source: string,
  diagnostics: Parameters<SuggestRepairs>[1],
): RepairSuggestion[] {
  const suggestionFn = (publicApi as typeof publicApi & {
    suggestRepairs?: SuggestRepairs;
  }).suggestRepairs;
  expect(suggestionFn, 'suggestRepairs should be exported from src/index')
    .toBeTypeOf('function');
  return suggestionFn!(source, diagnostics);
}

function applyRepair(source: string, suggestion: RepairSuggestion): string {
  const applyFn = (publicApi as typeof publicApi & {
    applyRepair?: ApplyRepair;
  }).applyRepair;
  expect(applyFn, 'applyRepair should be exported from src/index')
    .toBeTypeOf('function');
  return applyFn!(source, suggestion);
}

type ExportDiagram = (request: {
  diagramId: string;
  source: string;
  svg: SVGSVGElement;
  format: 'svg' | 'png';
  fileName?: string;
}) => Promise<Blob>;

function exportDiagram(request: Parameters<ExportDiagram>[0]): Promise<Blob> {
  const exportFn = (publicApi as typeof publicApi & {
    exportDiagram?: ExportDiagram;
  }).exportDiagram;
  expect(exportFn, 'exportDiagram should be exported from src/index')
    .toBeTypeOf('function');
  return exportFn!(request);
}

type EncodeShareState = (documentText: string, selectedDiagramId: string | null) => string;
type DecodeShareState = (hash: string) => { documentText: string; selectedDiagramId: string | null } | null;

function encodeShareState(documentText: string, selectedDiagramId: string | null): string {
  const encodeFn = (publicApi as typeof publicApi & {
    encodeShareState?: EncodeShareState;
  }).encodeShareState;
  expect(encodeFn, 'encodeShareState should be exported from src/index')
    .toBeTypeOf('function');
  return encodeFn!(documentText, selectedDiagramId);
}

function decodeShareState(hash: string): ReturnType<DecodeShareState> {
  const decodeFn = (publicApi as typeof publicApi & {
    decodeShareState?: DecodeShareState;
  }).decodeShareState;
  expect(decodeFn, 'decodeShareState should be exported from src/index')
    .toBeTypeOf('function');
  return decodeFn!(hash);
}

type FlowchartGraphModel = {
  direction: 'TD' | 'TB' | 'BT' | 'LR' | 'RL';
  nodes: Array<{ id: string; label: string; shape: string }>;
  edges: Array<{ id: string; from: string; to: string; label?: string; style: string; min_length: number }>;
  subgraphs: Array<{ title: string; nodes: string[]; subgraphs: Array<{ title: string; nodes: string[]; subgraphs: unknown[] }> }>;
};

type FlowchartAst = {
  type: 'flowchart';
  direction: FlowchartGraphModel['direction'];
  nodes: Array<{ id: string; label: string | null; shape: string; classes: string[]; styles: string[] }>;
  edges: Array<{ from: string; to: string; style: string; label: string | null; min_length: number }>;
  subgraphs: FlowchartGraphModel['subgraphs'];
};

type VisualSourceAnalysis = {
  capability: 'editable' | 'read-only' | 'unsupported';
  model: FlowchartGraphModel | null;
  diagnostics: Array<{ code: string; message: string; severity: string; range: null }>;
};

type VisualEditApplyResult = {
  status: 'applied' | 'blocked';
  source: string;
  model: FlowchartGraphModel | null;
  diagnostics: Array<{ code: string; message: string; severity: string; range: null }>;
};

type VisualParseOptions = {
  parseDsl?: (source: string) => string | Promise<string>;
  renderDsl?: (source: string) => unknown | Promise<unknown>;
  detectUnsupportedFeatures?: (source: string) => Array<{
    id: string;
    message: string;
    severity: 'warning' | 'error';
    range: ReturnType<typeof extractDiagrams>['diagrams'][number]['range'] | null;
  }>;
};

type VisualEdit =
  | { type: 'rename-node'; nodeId: string; label: string }
  | { type: 'add-node'; nodeId: string; label: string }
  | { type: 'remove-node'; nodeId: string }
  | { type: 'add-edge'; from: string; to: string; label?: string }
  | { type: 'remove-edge'; edgeId: string }
  | { type: 'set-direction'; direction: FlowchartGraphModel['direction'] };

type ParseFlowchartToGraph = (source: string) => FlowchartGraphModel;
type ApplyVisualEdit = (model: FlowchartGraphModel, edit: VisualEdit) => FlowchartGraphModel;
type SerializeFlowchart = (model: FlowchartGraphModel) => string;
type FlowchartAstToGraph = (ast: FlowchartAst) => FlowchartGraphModel;
type AnalyzeFlowchartForVisualEdit = (source: string, options?: VisualParseOptions) => Promise<VisualSourceAnalysis>;
type ValidateVisualEditResult = (
  source: string,
  options?: VisualParseOptions,
  expectedModel?: FlowchartGraphModel,
) => Promise<VisualEditApplyResult>;

function parseFlowchartToGraph(source: string): FlowchartGraphModel {
  const parseFn = (publicApi as typeof publicApi & {
    parseFlowchartToGraph?: ParseFlowchartToGraph;
  }).parseFlowchartToGraph;
  expect(parseFn, 'parseFlowchartToGraph should be exported from src/index')
    .toBeTypeOf('function');
  return parseFn!(source);
}

function applyVisualEdit(model: FlowchartGraphModel, edit: VisualEdit): FlowchartGraphModel {
  const applyFn = (publicApi as typeof publicApi & {
    applyVisualEdit?: ApplyVisualEdit;
  }).applyVisualEdit;
  expect(applyFn, 'applyVisualEdit should be exported from src/index')
    .toBeTypeOf('function');
  return applyFn!(model, edit);
}

function serializeFlowchart(model: FlowchartGraphModel): string {
  const serializeFn = (publicApi as typeof publicApi & {
    serializeFlowchart?: SerializeFlowchart;
  }).serializeFlowchart;
  expect(serializeFn, 'serializeFlowchart should be exported from src/index')
    .toBeTypeOf('function');
  return serializeFn!(model);
}

function parseFlowchartDslForTest(source: string): string {
  const model = parseFlowchartToGraph(source);
  return JSON.stringify({
    type: 'flowchart',
    direction: model.direction,
    nodes: model.nodes.map(node => ({
      id: node.id,
      label: node.label,
      shape: node.shape,
      classes: [],
      styles: [],
    })),
    edges: model.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      style: edge.style,
      label: edge.label ?? null,
      min_length: edge.min_length,
    })),
    subgraphs: model.subgraphs,
  });
}

function renderFlowchartDslForTest(): { nodes: unknown[]; edges: unknown[] } {
  return { nodes: [], edges: [] };
}

function flowchartAstToGraph(ast: FlowchartAst): FlowchartGraphModel {
  const convertFn = (publicApi as typeof publicApi & {
    flowchartAstToGraph?: FlowchartAstToGraph;
  }).flowchartAstToGraph;
  expect(convertFn, 'flowchartAstToGraph should be exported from src/index')
    .toBeTypeOf('function');
  return convertFn!(ast);
}

function analyzeFlowchartForVisualEdit(source: string, options?: VisualParseOptions): Promise<VisualSourceAnalysis> {
  const analyzeFn = (publicApi as typeof publicApi & {
    analyzeFlowchartForVisualEdit?: AnalyzeFlowchartForVisualEdit;
  }).analyzeFlowchartForVisualEdit;
  expect(analyzeFn, 'analyzeFlowchartForVisualEdit should be exported from src/index')
    .toBeTypeOf('function');
  return analyzeFn!(source, options);
}

function validateVisualEditResult(
  source: string,
  options?: VisualParseOptions,
  expectedModel?: FlowchartGraphModel,
): Promise<VisualEditApplyResult> {
  const validateFn = (publicApi as typeof publicApi & {
    validateVisualEditResult?: ValidateVisualEditResult;
  }).validateVisualEditResult;
  expect(validateFn, 'validateVisualEditResult should be exported from src/index')
    .toBeTypeOf('function');
  return validateFn!(source, options, expectedModel);
}
