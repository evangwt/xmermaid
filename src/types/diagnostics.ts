export type XMermaidDiagnosticCode =
  | 'parse_error'
  | 'unsupported_diagram_type'
  | 'unsupported_syntax'
  | 'layout_error'
  | 'render_error'
  | 'wasm_init_error'
  | 'security_blocked_url'
  | 'security_blocked_html'
  | 'security_blocked_click';

export interface SourceRange {
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface XMermaidDiagnostic {
  code: XMermaidDiagnosticCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  range: SourceRange | null;
  featureId?: string;
}
