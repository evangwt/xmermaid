import { XMermaid } from '../xmermaid';
import { XMermaidError } from '../types/error';
import type { RenderOptions, XMermaidOptions } from '../types/options';
import type { SourceRange, XMermaidDiagnostic, XMermaidDiagnosticCode } from '../types/diagnostics';
import type { LayoutConfig } from '../types/layout';
import { DARK_THEME, DEFAULT_THEME, MINIMAL_THEME, type RenderTheme } from '../types/theme';
import { applyRepair, suggestRepairs, type RepairSuggestion } from './repair';
import {
  decodeShareState as decodeLiveShareState,
  exportDiagram as exportRenderedDiagram,
  encodeShareState as encodeLiveShareState,
} from './share';
import {
  analyzeFlowchartForVisualEdit,
  applyVisualEdit as applyFlowchartVisualEdit,
  serializeFlowchart as serializeFlowchartModel,
  validateVisualEditResult,
  type FlowchartGraphDirection,
  type FlowchartDslRenderer,
  type FlowchartDslParser,
  type VisualEditDiagnostic,
  type VisualEdit,
} from './flowchart';

export type { SourceRange } from '../types/diagnostics';
export { applyRepair, suggestRepairs };
export type { RepairConfidence, RepairSuggestion } from './repair';
export { exportDiagram, encodeShareState, decodeShareState } from './share';
export type { ExportRequest } from './share';
export {
  analyzeFlowchartForVisualEdit,
  applyVisualEdit,
  flowchartAstToGraph,
  parseFlowchartToGraph,
  serializeFlowchart,
  validateVisualEditResult,
} from './flowchart';
export type {
  FlowchartDslParser,
  FlowchartDslRenderer,
  FlowchartGraphModel,
  FlowchartGraphNode,
  FlowchartGraphEdge,
  VisualEdit,
  VisualEditApplyResult,
  VisualEditDiagnostic,
  VisualFlowchartParseOptions,
  VisualUnsupportedFeatureDetector,
  VisualSourceAnalysis,
  VisualSourceCapability,
} from './flowchart';

export type DiagramOrigin = 'markdown-fence' | 'raw-mermaid-block';

export interface DocumentDiagnostic {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  range: SourceRange | null;
}

export type RenderDiagnosticCode =
  Extract<
    XMermaidDiagnosticCode,
    | 'parse_error'
    | 'unsupported_diagram_type'
    | 'unsupported_syntax'
    | 'layout_error'
    | 'render_error'
    | 'wasm_init_error'
    | 'security_blocked_url'
    | 'security_blocked_html'
    | 'security_blocked_click'
  >
  | VisualEditDiagnostic['code'];

export type RenderDiagnostic = Omit<XMermaidDiagnostic, 'code'> & { code: RenderDiagnosticCode };

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
  themeId: string;
  layoutConfig: Partial<LayoutConfig>;
}

export interface XMermaidLiveEditorOptions {
  root: HTMLElement;
  initialText?: string;
  renderDiagram?: (request: LiveEditorRenderRequest) => Promise<RenderDiagnostic[] | void>;
  parseFlowchartDsl?: FlowchartDslParser;
  renderFlowchartDsl?: FlowchartDslRenderer;
  xmermaidOptions?: Omit<XMermaidOptions, 'container'> & RenderOptions;
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
  private readonly renderDiagram: (request: LiveEditorRenderRequest) => Promise<RenderDiagnostic[] | void>;
  private readonly parseFlowchartDsl?: FlowchartDslParser;
  private readonly renderFlowchartDsl?: FlowchartDslRenderer;
  private readonly xmermaidOptions?: Omit<XMermaidOptions, 'container'> & RenderOptions;
  private documentText: string;
  private diagramDocument: DiagramDocument;
  private readonly initialSelectedDiagramId: string | null;
  private selectedDiagramId: string | null = null;
  private documentInput!: HTMLTextAreaElement;
  private listEl!: HTMLElement;
  private sourceInput!: HTMLTextAreaElement;
  private previewEl!: HTMLElement;
  private diagnosticsEl!: HTMLElement;
  private downloadLink!: HTMLAnchorElement;
  private directionSelect!: HTMLSelectElement;
  private visualEditorEl!: HTMLElement;
  private themeId = 'default';
  private layoutDirection: FlowchartGraphDirection = 'TD';
  private renderRequestId = 0;
  private visualEditQueue: Promise<void> = Promise.resolve();
  private activeDownloadUrl: string | null = null;
  private exportablePreview: { diagramId: string; source: string; requestId: number } | null = null;

  constructor(options: XMermaidLiveEditorOptions) {
    this.root = options.root;
    const shareState = currentShareState();
    this.documentText = shareState?.documentText ?? options.initialText ?? '';
    this.diagramDocument = extractDiagrams(this.documentText);
    this.initialSelectedDiagramId = shareState?.selectedDiagramId ?? null;
    this.renderDiagram = options.renderDiagram ?? this.defaultRenderDiagram;
    this.parseFlowchartDsl = options.parseFlowchartDsl;
    this.renderFlowchartDsl = options.renderFlowchartDsl;
    this.xmermaidOptions = options.xmermaidOptions;
  }

  async mount(): Promise<void> {
    this.root.innerHTML = '';
    this.root.classList.add('xmermaid-live-editor');
    this.root.appendChild(this.createShell());
    this.selectDiagram(this.initialDiagramSelection());
    await this.renderSelected();
  }

  private initialDiagramSelection(): string | null {
    if (this.initialSelectedDiagramId && this.diagramDocument.diagrams.some(diagram => diagram.id === this.initialSelectedDiagramId)) {
      return this.initialSelectedDiagramId;
    }
    return this.diagramDocument.diagrams[0]?.id ?? null;
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
      this.commitSelectedSource(this.sourceInput.value);
      this.syncLayoutDirectionFromSource(this.sourceInput.value);
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

    const workspace = document.createElement('div');
    workspace.className = 'xm-live-workspace';
    workspace.append(this.documentInput, this.listEl, this.sourceInput, previewPanel);

    this.visualEditorEl = this.createVisualEditor();
    shell.append(this.createToolbar(), workspace, this.visualEditorEl);
    return shell;
  }

  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.setAttribute('data-xm-toolbar', '');

    const themeSelect = document.createElement('select');
    themeSelect.setAttribute('data-xm-theme-select', '');
    themeSelect.setAttribute('aria-label', 'Theme');
    for (const theme of ['default', 'dark', 'minimal']) {
      const option = document.createElement('option');
      option.value = theme;
      option.textContent = theme;
      themeSelect.appendChild(option);
    }
    themeSelect.value = this.themeId;
    themeSelect.addEventListener('change', () => {
      this.themeId = themeSelect.value;
      void this.renderSelected();
    });

    this.directionSelect = document.createElement('select');
    this.directionSelect.setAttribute('data-xm-layout-direction', '');
    this.directionSelect.setAttribute('aria-label', 'Layout direction');
    for (const direction of ['TD', 'TB', 'BT', 'LR', 'RL']) {
      const option = document.createElement('option');
      option.value = direction;
      option.textContent = direction;
      this.directionSelect.appendChild(option);
    }
    this.directionSelect.value = this.layoutDirection;
    this.directionSelect.addEventListener('change', () => {
      this.layoutDirection = this.directionSelect.value as FlowchartGraphDirection;
      void this.renderSelected();
    });

    const applySourceDirectionButton = this.createButton('data-xm-apply-source-direction', 'Apply direction');
    applySourceDirectionButton.addEventListener('click', () => {
      void this.applyVisualEdit({ type: 'set-direction', direction: this.layoutDirection });
    });

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.setAttribute('data-xm-share-link', '');
    shareButton.textContent = 'Share';
    shareButton.addEventListener('click', () => {
      window.location.hash = encodeLiveShareState(this.documentText, this.selectedDiagramId);
    });

    const exportButton = this.createButton('data-xm-export-svg', 'Export SVG');
    exportButton.addEventListener('click', () => {
      void this.exportCurrentDiagram('svg');
    });

    const exportPngButton = this.createButton('data-xm-export-png', 'Export PNG');
    exportPngButton.addEventListener('click', () => {
      void this.exportCurrentDiagram('png');
    });

    const copySourceButton = this.createButton('data-xm-copy-source', 'Copy source');
    copySourceButton.addEventListener('click', () => {
      void this.copyText(this.sourceInput.value);
    });

    const copyDocumentButton = this.createButton('data-xm-copy-document', 'Copy document');
    copyDocumentButton.addEventListener('click', () => {
      void this.copyText(this.documentText);
    });

    const visualButton = document.createElement('button');
    visualButton.type = 'button';
    visualButton.setAttribute('data-xm-visual-toggle', '');
    visualButton.textContent = 'Visual';
    visualButton.addEventListener('click', () => {
      this.visualEditorEl.hidden = !this.visualEditorEl.hidden;
    });

    this.downloadLink = document.createElement('a');
    this.downloadLink.setAttribute('data-xm-download-link', '');
    this.downloadLink.hidden = true;

    toolbar.append(
      themeSelect,
      this.directionSelect,
      applySourceDirectionButton,
      shareButton,
      copySourceButton,
      copyDocumentButton,
      exportButton,
      exportPngButton,
      visualButton,
      this.downloadLink,
    );
    return toolbar;
  }

  private createVisualEditor(): HTMLElement {
    const panel = document.createElement('section');
    panel.setAttribute('data-xm-visual-editor', '');
    panel.hidden = true;

    const nodeIdInput = this.createInput('data-xm-visual-node-id', 'Node id');
    const nodeLabelInput = this.createInput('data-xm-visual-node-label', 'Node label');
    const renameButton = this.createButton('data-xm-visual-rename-node', 'Rename node');
    renameButton.addEventListener('click', () => {
      void this.applyVisualEdit({ type: 'rename-node', nodeId: nodeIdInput.value, label: nodeLabelInput.value });
    });

    const addNodeButton = this.createButton('data-xm-visual-add-node', 'Add node');
    addNodeButton.addEventListener('click', () => {
      void this.applyVisualEdit({ type: 'add-node', nodeId: nodeIdInput.value, label: nodeLabelInput.value || nodeIdInput.value });
    });
    const removeNodeButton = this.createButton('data-xm-visual-remove-node', 'Remove node');
    removeNodeButton.addEventListener('click', () => {
      void this.applyVisualEdit({ type: 'remove-node', nodeId: nodeIdInput.value });
    });

    const edgeFromInput = this.createInput('data-xm-visual-edge-from', 'Edge from');
    const edgeToInput = this.createInput('data-xm-visual-edge-to', 'Edge to');
    const edgeLabelInput = this.createInput('data-xm-visual-edge-label', 'Edge label');
    const edgeIdInput = this.createInput('data-xm-visual-edge-id', 'Edge id');
    const addEdgeButton = this.createButton('data-xm-visual-add-edge', 'Add edge');
    addEdgeButton.addEventListener('click', () => {
      void this.applyVisualEdit({
        type: 'add-edge',
        from: edgeFromInput.value,
        to: edgeToInput.value,
        label: edgeLabelInput.value || undefined,
      });
    });
    const removeEdgeButton = this.createButton('data-xm-visual-remove-edge', 'Remove edge');
    removeEdgeButton.addEventListener('click', () => {
      void this.applyVisualEdit({ type: 'remove-edge', edgeId: edgeIdInput.value });
    });

    panel.append(
      nodeIdInput,
      nodeLabelInput,
      renameButton,
      addNodeButton,
      removeNodeButton,
      edgeFromInput,
      edgeToInput,
      edgeLabelInput,
      edgeIdInput,
      addEdgeButton,
      removeEdgeButton,
    );
    return panel;
  }

  private createInput(attribute: string, label: string): HTMLInputElement {
    const input = document.createElement('input');
    input.setAttribute(attribute, '');
    input.setAttribute('aria-label', label);
    return input;
  }

  private createButton(attribute: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(attribute, '');
    button.setAttribute('aria-label', label);
    button.textContent = label;
    return button;
  }

  private selectDiagram(diagramId: string | null): void {
    this.selectedDiagramId = diagramId;
    this.renderList();
    const selected = this.selectedDiagram();
    this.sourceInput.value = selected?.source ?? '';
    this.sourceInput.disabled = !selected;
    this.syncLayoutDirectionFromSource(selected?.source ?? '');
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

  private selectedSourceIsFlowchart(): boolean {
    return flowchartDirection(this.sourceInput.value) !== null;
  }

  private applyVisualEdit(edit: VisualEdit): Promise<void> {
    const next = this.visualEditQueue.then(() => this.applyVisualEditNow(edit));
    this.visualEditQueue = next.catch(() => {});
    return next;
  }

  private async applyVisualEditNow(edit: VisualEdit): Promise<void> {
    if (!this.selectedDiagramId || !this.selectedSourceIsFlowchart()) return;
    const parseOptions = {
      parseDsl: this.parseFlowchartDsl,
      renderDsl: this.renderFlowchartDsl,
    };
    const analysis = await analyzeFlowchartForVisualEdit(this.sourceInput.value, parseOptions);
    if (!analysis.model) {
      this.renderDiagnostics(analysis.diagnostics);
      return;
    }

    const model = analysis.model;
    const nextModel = applyFlowchartVisualEdit(model, edit);
    const nextSource = serializeFlowchartModel(nextModel);
    const validation = await validateVisualEditResult(nextSource, parseOptions, nextModel);
    if (validation.status === 'blocked') {
      this.renderDiagnostics(validation.diagnostics);
      return;
    }

    this.sourceInput.value = nextSource;
    this.commitSelectedSource(nextSource);
    void this.renderSelected();
  }

  private commitSelectedSource(nextSource: string): DiagramBlock | undefined {
    if (!this.selectedDiagramId) return undefined;

    const result = replaceDiagramSource(
      this.documentText,
      this.selectedDiagramId,
      nextSource,
      this.diagramDocument,
    );
    this.documentText = result.text;
    this.diagramDocument = result.document;
    this.documentInput.value = this.documentText;

    const selected = this.selectedDiagram();
    if (!selected) {
      this.selectDiagram(this.diagramDocument.diagrams[0]?.id ?? null);
      return this.selectedDiagram();
    }

    this.syncLayoutDirectionFromSource(nextSource);
    this.renderList();
    return selected;
  }

  private async renderSelected(): Promise<void> {
    const selected = this.selectedDiagram();
    const requestId = ++this.renderRequestId;
    this.invalidateExportablePreview();
    if (!selected) {
      this.previewEl.innerHTML = '';
      this.renderDiagnostics([]);
      return;
    }

    const source = this.sourceInput.value;
    const renderContainer = document.createElement('div');
    try {
      const diagnostics = await this.renderDiagram({
        source,
        container: renderContainer,
        diagram: { ...selected, source },
        themeId: this.themeId,
        layoutConfig: this.currentLayoutConfig(source),
      });
      if (requestId !== this.renderRequestId) return;
      this.previewEl.innerHTML = '';
      this.previewEl.append(...Array.from(renderContainer.childNodes));
      this.exportablePreview = { diagramId: selected.id, source, requestId };
      this.renderDiagnostics(diagnostics ?? []);
    } catch (error) {
      if (requestId !== this.renderRequestId) return;
      const message = error instanceof Error ? error.message : String(error);
      const diagnostics = normalizeRenderError(error, selected.range);
      this.previewEl.querySelector('[data-xm-preview-error]')?.remove();
      this.renderDiagnostics(diagnostics, suggestRepairs(source, diagnostics));
      const errorEl = document.createElement('div');
      errorEl.setAttribute('data-xm-preview-error', '');
      errorEl.textContent = message;
      this.previewEl.appendChild(errorEl);
    }
  }

  private defaultRenderDiagram = async ({ source, container, layoutConfig }: LiveEditorRenderRequest): Promise<RenderDiagnostic[]> => {
    const renderer = new XMermaid({
      ...this.xmermaidOptions,
      theme: this.currentTheme(),
      layoutConfig,
      container,
    });
    const result = await renderer.renderToSVGElement(source, this.currentRenderOptions());
    container.innerHTML = '';
    container.appendChild(result.svg);
    return result.diagnostics as RenderDiagnostic[];
  };

  private currentTheme(): Partial<RenderTheme> {
    if (this.themeId === 'dark') return DARK_THEME;
    if (this.themeId === 'minimal') return MINIMAL_THEME;
    return this.xmermaidOptions?.theme ?? DEFAULT_THEME;
  }

  private currentLayoutConfig(source: string): Partial<LayoutConfig> {
    return {
      ...this.xmermaidOptions?.layoutConfig,
      direction: layoutDirection(this.layoutDirection),
    };
  }

  private currentRenderOptions(): RenderOptions {
    return {
      securityLevel: this.xmermaidOptions?.securityLevel,
      securityPolicy: this.xmermaidOptions?.securityPolicy,
      wasm: this.xmermaidOptions?.wasm,
    };
  }

  private syncLayoutDirectionFromSource(source: string): void {
    const direction = flowchartDirection(source);
    if (!direction) return;
    this.layoutDirection = direction;
    if (this.directionSelect) {
      this.directionSelect.value = direction;
    }
  }

  private async exportCurrentDiagram(format: 'svg' | 'png'): Promise<void> {
    const selected = this.selectedDiagram();
    const svg = this.previewEl.querySelector('svg');
    if (!selected) return;
    if (!svg || !this.canExportCurrentPreview(selected, this.sourceInput.value)) {
      this.renderDiagnostics([{
        code: 'render_error',
        message: 'The current diagram has not rendered successfully; fix diagnostics before exporting.',
        severity: 'error',
        range: selected.range,
      }]);
      return;
    }

    try {
      const blob = await exportRenderedDiagram({
        diagramId: selected.id,
        source: this.sourceInput.value,
        svg,
        format,
        fileName: `${selected.id}.${format}`,
      });

      if (this.activeDownloadUrl) URL.revokeObjectURL(this.activeDownloadUrl);
      this.activeDownloadUrl = URL.createObjectURL(blob);
      this.downloadLink.href = this.activeDownloadUrl;
      this.downloadLink.download = `${selected.id}.${format}`;
      this.downloadLink.hidden = false;
      this.root.dispatchEvent(new CustomEvent('xmermaid:exported', { detail: { diagramId: selected.id, format } }));
    } catch (error) {
      this.renderDiagnostics([{
        code: 'render_error',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
        range: selected.range,
      }]);
    }
  }

  private canExportCurrentPreview(selected: DiagramBlock, source: string): boolean {
    return this.exportablePreview?.diagramId === selected.id
      && this.exportablePreview.source === source
      && this.exportablePreview.requestId === this.renderRequestId;
  }

  private invalidateExportablePreview(): void {
    this.exportablePreview = null;
    if (this.activeDownloadUrl) {
      URL.revokeObjectURL(this.activeDownloadUrl);
      this.activeDownloadUrl = null;
    }
    if (this.downloadLink) {
      this.downloadLink.hidden = true;
      this.downloadLink.removeAttribute('href');
      this.downloadLink.removeAttribute('download');
    }
  }

  private async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      this.renderDiagnostics([{
        code: 'render_error',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
        range: this.selectedDiagram()?.range ?? null,
      }]);
    }
  }

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
          const nextSource = applyRepair(this.sourceInput.value, suggestion);
          this.sourceInput.value = nextSource;
          this.commitSelectedSource(nextSource);
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
      startColumn: columnForOffset(input.text, input.startOffset),
      endLine: lineForOffset(input.text, input.endOffset),
      endColumn: columnForOffset(input.text, input.endOffset),
    },
    diagramType: isMermaidStart(input.source) ? 'flowchart' : 'unknown',
  };
}

function isMermaidStart(source: string): boolean {
  return /^(graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i.test(source);
}

function flowchartDirection(source: string): FlowchartGraphDirection | null {
  return source.trim().match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)\b/i)?.[1].toUpperCase() as FlowchartGraphDirection | undefined ?? null;
}

function layoutDirection(direction: FlowchartGraphDirection): LayoutConfig['direction'] {
  return direction === 'TD' || direction === 'TB' ? 'TB' : direction;
}

function lineForOffset(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

function columnForOffset(text: string, offset: number): number {
  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1));
  return offset - lineStart;
}

function normalizeRenderError(error: unknown, range: SourceRange): RenderDiagnostic[] {
  if (error instanceof XMermaidError && error.diagnostics.length > 0) {
    return error.diagnostics.map(diagnostic => withFallbackRange(diagnostic as RenderDiagnostic, range));
  }

  return [{
    code: renderDiagnosticCode(error),
    message: error instanceof Error ? error.message : String(error),
    severity: 'error',
    range,
  }];
}

function withFallbackRange(diagnostic: RenderDiagnostic, range: SourceRange): RenderDiagnostic {
  return {
    ...diagnostic,
    range: diagnostic.range ?? range,
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

function currentShareState(): { documentText: string; selectedDiagramId: string | null } | null {
  if (typeof window === 'undefined') return null;
  return decodeLiveShareState(window.location.hash);
}
