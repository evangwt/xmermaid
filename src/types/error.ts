import type { XMermaidDiagnostic } from './diagnostics';

export type XMermaidErrorCode =
  | 'PARSE_ERROR'
  | 'LAYOUT_ERROR'
  | 'RENDER_ERROR'
  | 'WASM_ERROR'
  | 'UNSUPPORTED_DIAGRAM';

export class XMermaidError extends Error {
  code: XMermaidErrorCode;
  details?: unknown;
  diagnostics: XMermaidDiagnostic[];

  constructor(
    code: XMermaidErrorCode,
    message: string,
    details?: unknown,
    diagnostics = diagnosticsFromDetails(details),
  ) {
    super(message);
    this.name = 'XMermaidError';
    this.code = code;
    this.details = details;
    this.diagnostics = diagnostics;
  }
}

function diagnosticsFromDetails(details: unknown): XMermaidDiagnostic[] {
  if (
    typeof details === 'object'
    && details !== null
    && Array.isArray((details as { diagnostics?: unknown }).diagnostics)
  ) {
    return (details as { diagnostics: XMermaidDiagnostic[] }).diagnostics;
  }
  return [];
}
