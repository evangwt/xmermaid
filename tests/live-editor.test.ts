import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as editorModule from '../src/editor';
import * as publicApi from '../src/index';
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
});

describe('examples/live-editor.html', () => {
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
