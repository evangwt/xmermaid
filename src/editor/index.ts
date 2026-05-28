import { XMermaid } from '../xmermaid';
import { XMermaidError } from '../types/error';
import type { XMermaidOptions } from '../types/options';
import { applyRepair, suggestRepairs, type RepairSuggestion } from './repair';

export { applyRepair, suggestRepairs };
export type { RepairConfidence, RepairSuggestion } from './repair';

export type DiagramOrigin = 'markdown-fence' | 'raw-mermaid-block';

export interface SourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
}

export interface DocumentDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  range: SourceRange | null;
}

export type RenderDiagnosticCode =
  | 'parse_error'
  | 'unsupported_diagram_type'
  | 'layout_error'
  | 'render_error'
  | 'wasm_init_error';

export interface RenderDiagnostic {
  code: RenderDiagnosticCode;
  message: string;
  severity: 'error' | 'warning';
  range: SourceRange | null;
}

export interface DiagramBlock {
  id: string;
  index: number;
  title: string | null;
  source: string;
  origin: DiagramOrigin;
  language: 'mermaid' | 'xmermaid' | null;
  range: SourceRange;
  diagramType: 'flowchart' | 'unsupported' | 'unknown';
}

export interface DiagramDocument {
  text: string;
  diagrams: DiagramBlock[];
  diagnostics: DocumentDiagnostic[];
}

export interface ReplaceDiagramSourceResult {
  text: string;
  document: DiagramDocument;
}

export interface LiveEditorRenderRequest {
  source: string;
  container: HTMLElement;
  diagram: DiagramBlock;
}

export interface XMermaidLiveEditorOptions {
  root: HTMLElement;
  initialText?: string;
  renderDiagram?: (request: LiveEditorRenderRequest) => Promise<void>;
  xmermaidOptions?: Omit<XMermaidOptions, 'container'>;
}

const FENCE_PATTERN = /```(mermaid|xmermaid)\s*\n([\s\S]*?)\n```/gi;

export function extractDiagrams(text: string): DiagramDocument {
  const diagrams: DiagramBlock[] = [];
  const diagnostics: DocumentDiagnostic[] = [];

  for (const match of text.matchAll(FENCE_PATTERN)) {
    const fullMatch = match[0];
    const language = match[1].toLowerCase() as 'mermaid' | 'xmermaid';
    const source = match[2].trim();
    const matchStart = match.index ?? 0;
    const sourceStart = matchStart + fullMatch.indexOf(match[2]);
    diagrams.push(createDiagramBlock({
      text,
      index: diagrams.length,
      source,
      origin: 'markdown-fence',
      language,
      startOffset: sourceStart,
      endOffset: sourceStart + match[2].length,
    }));
  }

  if (diagrams.length === 0 && isMermaidStart(text.trim())) {
    const startOffset = text.search(/\S/);
    const source = text.trim();
    diagrams.push(createDiagramBlock({
      text,
      index: 0,
      source,
      origin: 'raw-mermaid-block',
      language: null,
      startOffset: startOffset < 0 ? 0 : startOffset,
      endOffset: (startOffset < 0 ? 0 : startOffset) + source.length,
    }));
  }

  return { text, diagrams, diagnostics };
}

export function replaceDiagramSource(
  text: string,
  diagramId: string,
  nextSource: string,
  document: DiagramDocument,
): ReplaceDiagramSourceResult {
  const diagram = document.diagrams.find(item => item.id === diagramId);
  if (!diagram) {
    const nextDocument = extractDiagrams(text);
    nextDocument.diagnostics.push({
      code: 'diagram_not_found',
      message: `Diagram ${diagramId} was not found.`,
      severity: 'error',
      range: null,
    });
    return { text, document: nextDocument };
  }

  const nextText = [
    text.slice(0, diagram.range.startOffset),
    nextSource,
    text.slice(diagram.range.endOffset),
  ].join('');

  return {
    text: nextText,
    document: extractDiagrams(nextText),
  };
}

class XMermaidLiveEditor {
  private readonly root: HTMLElement;
  private readonly renderDiagram: (request: LiveEditorRenderRequest) => Promise<void>;
  private readonly xmermaidOptions?: Omit<XMermaidOptions, 'container'>;
  private documentText: string;
  private diagramDocument: DiagramDocument;
  private selectedDiagramId: string | null = null;
  private documentInput!: HTMLTextAreaElement;
  private listEl!: HTMLElement;
  private sourceInput!: HTMLTextAreaElement;
  private previewEl!: HTMLElement;
  private diagnosticsEl!: HTMLElement;

  constructor(options: XMermaidLiveEditorOptions) {
    this.root = options.root;
    this.documentText = options.initialText ?? '';
    this.diagramDocument = extractDiagrams(this.documentText);
    this.renderDiagram = options.renderDiagram ?? this.defaultRenderDiagram;
    this.xmermaidOptions = options.xmermaidOptions;
  }

  async mount(): Promise<void> {
    this.root.innerHTML = '';
    this.root.classList.add('xmermaid-live-editor');
    this.root.appendChild(this.createShell());
    this.selectDiagram(this.diagramDocument.diagrams[0]?.id ?? null);
    await this.renderSelected();
  }

  private createShell(): HTMLElement {
    const shell = document.createElement('div');
    shell.className = 'xm-live-shell';

    this.documentInput = document.createElement('textarea');
    this.documentInput.value = this.documentText;
    this.documentInput.setAttribute('data-xm-document-input', '');
    this.documentInput.setAttribute('aria-label', 'Document input');
    this.documentInput.addEventListener('input', () => {
      this.documentText = this.documentInput.value;
      this.diagramDocument = extractDiagrams(this.documentText);
      this.selectDiagram(this.diagramDocument.diagrams[0]?.id ?? null);
      void this.renderSelected();
    });

    this.listEl = document.createElement('div');
    this.listEl.setAttribute('data-xm-diagram-list', '');

    this.sourceInput = document.createElement('textarea');
    this.sourceInput.setAttribute('data-xm-selected-source', '');
    this.sourceInput.setAttribute('aria-label', 'Selected diagram source');
    this.sourceInput.addEventListener('input', () => {
      void this.renderSelected();
    });

    this.previewEl = document.createElement('div');
    this.previewEl.setAttribute('data-xm-preview', '');

    this.diagnosticsEl = document.createElement('section');
    this.diagnosticsEl.setAttribute('data-xm-diagnostics', '');
    this.diagnosticsEl.setAttribute('aria-label', 'Diagnostics');

    const previewPanel = document.createElement('div');
    previewPanel.className = 'xm-live-preview-panel';
    previewPanel.append(this.previewEl, this.diagnosticsEl);

    shell.append(this.documentInput, this.listEl, this.sourceInput, previewPanel);
    return shell;
  }

  private selectDiagram(diagramId: string | null): void {
    this.selectedDiagramId = diagramId;
    this.renderList();
    const selected = this.selectedDiagram();
    this.sourceInput.value = selected?.source ?? '';
    this.sourceInput.disabled = !selected;
  }

  private renderList(): void {
    this.listEl.innerHTML = '';

    if (this.diagramDocument.diagrams.length === 0) {
      const empty = document.createElement('p');
      empty.setAttribute('data-xm-empty', '');
      empty.textContent = 'No Mermaid diagrams found.';
      this.listEl.appendChild(empty);
      return;
    }

    for (const diagram of this.diagramDocument.diagrams) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-xm-diagram-item', '');
      button.textContent = `Diagram ${diagram.index + 1}`;
      if (diagram.id === this.selectedDiagramId) {
        button.classList.add('is-selected');
      }
      button.addEventListener('click', () => {
        this.selectDiagram(diagram.id);
        void this.renderSelected();
      });
      this.listEl.appendChild(button);
    }
  }

  private selectedDiagram(): DiagramBlock | undefined {
    return this.diagramDocument.diagrams.find(diagram => diagram.id === this.selectedDiagramId);
  }

  private async renderSelected(): Promise<void> {
    const selected = this.selectedDiagram();
    this.previewEl.innerHTML = '';
    this.renderDiagnostics([]);
    if (!selected) {
      return;
    }

    const source = this.sourceInput.value;
    try {
      await this.renderDiagram({
        source,
        container: this.previewEl,
        diagram: { ...selected, source },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const diagnostics = [normalizeRenderError(error, selected.range)];
      this.renderDiagnostics(diagnostics, suggestRepairs(source, diagnostics));
      const errorEl = document.createElement('div');
      errorEl.setAttribute('data-xm-preview-error', '');
      errorEl.textContent = message;
      this.previewEl.appendChild(errorEl);
    }
  }

  private defaultRenderDiagram = async ({ source, container }: LiveEditorRenderRequest): Promise<void> => {
    const renderer = new XMermaid({
      ...this.xmermaidOptions,
      container,
    });
    await renderer.render(source);
  };

  private renderDiagnostics(diagnostics: RenderDiagnostic[], suggestions: RepairSuggestion[] = []): void {
    this.diagnosticsEl.innerHTML = '';

    if (diagnostics.length === 0) {
      const empty = document.createElement('p');
      empty.setAttribute('data-xm-diagnostics-empty', '');
      empty.textContent = 'No diagnostics.';
      this.diagnosticsEl.appendChild(empty);
      return;
    }

    for (const diagnostic of diagnostics) {
      const item = document.createElement('div');
      item.setAttribute('data-xm-diagnostic-item', '');
      item.setAttribute('data-xm-diagnostic-code', diagnostic.code);
      const rangeLabel = diagnostic.range
        ? `Lines ${diagnostic.range.startLine}-${diagnostic.range.endLine}`
        : 'No source range';
      item.textContent = `${diagnostic.code}: ${diagnostic.message} (${rangeLabel})`;
      this.diagnosticsEl.appendChild(item);
    }

    for (const suggestion of suggestions) {
      const item = document.createElement('div');
      item.setAttribute('data-xm-repair-suggestion', '');
      item.textContent = `${suggestion.title}: ${suggestion.reason}`;

      if (suggestion.confidence === 'high') {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-xm-repair-apply', '');
        button.textContent = 'Apply';
        button.addEventListener('click', () => {
          this.sourceInput.value = applyRepair(this.sourceInput.value, suggestion);
          void this.renderSelected();
        });
        item.appendChild(button);
      }

      this.diagnosticsEl.appendChild(item);
    }
  }
}

export { XMermaidLiveEditor };

interface CreateDiagramBlockInput {
  text: string;
  index: number;
  source: string;
  origin: DiagramOrigin;
  language: 'mermaid' | 'xmermaid' | null;
  startOffset: number;
  endOffset: number;
}

function createDiagramBlock(input: CreateDiagramBlockInput): DiagramBlock {
  return {
    id: `diagram-${input.index + 1}`,
    index: input.index,
    title: null,
    source: input.source,
    origin: input.origin,
    language: input.language,
    range: {
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      startLine: lineForOffset(input.text, input.startOffset),
      endLine: lineForOffset(input.text, input.endOffset),
    },
    diagramType: isMermaidStart(input.source) ? 'flowchart' : 'unknown',
  };
}

function isMermaidStart(source: string): boolean {
  return /^(graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i.test(source);
}

function lineForOffset(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

function normalizeRenderError(error: unknown, range: SourceRange): RenderDiagnostic {
  return {
    code: renderDiagnosticCode(error),
    message: error instanceof Error ? error.message : String(error),
    severity: 'error',
    range,
  };
}

function renderDiagnosticCode(error: unknown): RenderDiagnosticCode {
  if (!(error instanceof XMermaidError)) {
    return 'render_error';
  }

  switch (error.code) {
    case 'PARSE_ERROR':
      return 'parse_error';
    case 'LAYOUT_ERROR':
      return 'layout_error';
    case 'WASM_ERROR':
      return 'wasm_init_error';
    case 'UNSUPPORTED_DIAGRAM':
      return 'unsupported_diagram_type';
    case 'RENDER_ERROR':
    default:
      return 'render_error';
  }
}
