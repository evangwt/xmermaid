export type XMermaidErrorCode =
  | 'PARSE_ERROR'
  | 'LAYOUT_ERROR'
  | 'RENDER_ERROR'
  | 'WASM_ERROR'
  | 'UNSUPPORTED_DIAGRAM';

export class XMermaidError extends Error {
  code: XMermaidErrorCode;
  details?: unknown;

  constructor(code: XMermaidErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'XMermaidError';
    this.code = code;
    this.details = details;
  }
}
