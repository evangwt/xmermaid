export type ErrorType = 'syntax' | 'validation' | 'layout' | 'render' | 'plugin';

export interface ErrorLocation {
  line: number;
  column: number;
  snippet: string;
}

export interface XMermaidError {
  code: string;
  type: ErrorType;
  message: string;
  location?: ErrorLocation;
  suggestion?: string;
}
