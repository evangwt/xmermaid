import type { SourceRange, XMermaidDiagnostic } from './types/diagnostics';

export type SecurityLevel = 'strict' | 'loose';

export interface SecurityPolicy {
  securityLevel: SecurityLevel;
  allowedUrlProtocols: string[];
  allowClickCallbacks: boolean;
  sanitizeSvg: boolean;
}

export interface SecurityPolicyOptions {
  securityLevel?: SecurityLevel;
  securityPolicy?: Partial<SecurityPolicy>;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  securityLevel: 'strict',
  allowedUrlProtocols: ['http:', 'https:', 'mailto:'],
  allowClickCallbacks: false,
  sanitizeSvg: true,
};

export function resolveSecurityPolicy(options: SecurityPolicyOptions = {}): SecurityPolicy {
  const securityLevel = options.securityLevel
    ?? options.securityPolicy?.securityLevel
    ?? DEFAULT_SECURITY_POLICY.securityLevel;
  const levelDefaults = policyDefaultsForLevel(securityLevel);
  const policy = {
    ...levelDefaults,
    ...options.securityPolicy,
    securityLevel,
  };

  return {
    ...policy,
    allowedUrlProtocols: policy.allowedUrlProtocols.map(protocol => protocol.toLowerCase()),
  };
}

export function detectSecurityDiagnostics(source: string, policy: SecurityPolicy): XMermaidDiagnostic[] {
  const diagnostics: XMermaidDiagnostic[] = [];

  for (const line of linesWithRanges(source)) {
    const trimmed = line.text.trimStart();
    if (!trimmed) continue;

    if (!policy.allowClickCallbacks && /^click\b/.test(trimmed)) {
      diagnostics.push({
        code: 'security_blocked_click',
        message: 'Flowchart click callbacks and links are blocked by the active security policy.',
        severity: 'error',
        range: lineContentRange(line),
        featureId: 'flowchart.click',
      });
    }

    // HTML labels are not gated here: the parser sanitizes them to plain text
    // and line breaks before rendering, and labels are never rendered as
    // trusted HTML, so markup in a label cannot inject anything.
  }

  // The URL scan runs over the whole source (not line by line) so a scheme
  // split across a line break — `java\nscript:` — is still recognized as a
  // single token. ASCII control whitespace inside the scheme is folded before
  // the protocol comparison; nothing is decoded.
  for (const url of unsafeUrls(source, policy)) {
    diagnostics.push({
      code: 'security_blocked_url',
      message: `URL protocol ${url.protocol} is blocked by the active security policy.`,
      severity: 'error',
      range: url.range,
    });
  }

  return diagnostics;
}

function policyDefaultsForLevel(securityLevel: SecurityLevel): SecurityPolicy {
  if (securityLevel === 'loose') {
    return {
      ...DEFAULT_SECURITY_POLICY,
      securityLevel,
      allowClickCallbacks: true,
    };
  }

  return {
    ...DEFAULT_SECURITY_POLICY,
    securityLevel,
    allowClickCallbacks: false,
  };
}

interface SourceLine {
  text: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
}

interface UnsafeUrl {
  protocol: string;
  range: SourceRange;
}

function unsafeUrls(source: string, policy: SecurityPolicy): UnsafeUrl[] {
  const allowed = new Set(policy.allowedUrlProtocols);
  const matches: UnsafeUrl[] = [];
  // The scheme may contain ASCII control whitespace so that a protocol split by
  // a tab or a newline (`java\tscript:`, `java\nscript:`) is still seen as one
  // token; `normalizeProtocol` folds those characters before comparison.
  const pattern = /(?:^|[\s"'(<[{|])([A-Za-z][A-Za-z0-9+.\-\t\r\n]*:)[^\s"'<>)}\]]*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const protocol = normalizeProtocol(match[1]);
    const schemeStart = match.index + match[0].indexOf(match[1]);
    const token = match[0].slice(schemeStart - match.index);
    const dangerous = isDangerousProtocol(protocol);
    if (!dangerous && allowed.has(protocol)) continue;
    if (!dangerous && !token.startsWith(`${protocol}//`)) continue;
    matches.push({
      protocol,
      range: offsetRange(source, schemeStart, token.length),
    });
  }

  return matches;
}

/** Build a SourceRange for an absolute [start, start + length) span. */
function offsetRange(source: string, start: number, length: number): SourceRange {
  const end = start + length;
  const startPosition = positionAt(source, start);
  const endPosition = positionAt(source, end);
  return {
    startOffset: start,
    endOffset: end,
    startLine: startPosition.line,
    startColumn: startPosition.column,
    endLine: endPosition.line,
    endColumn: endPosition.column,
  };
}

/** 1-based line/column for an absolute offset, treating CRLF as one break. */
function positionAt(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    const character = source[index];
    if (character === '\n') {
      line += 1;
      column = 1;
    } else if (character === '\r') {
      if (source[index + 1] === '\n') index += 1;
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function isDangerousProtocol(protocol: string): boolean {
  return protocol === 'javascript:' || protocol === 'data:' || protocol === 'vbscript:';
}

function normalizeProtocol(protocol: string): string {
  return protocol.replace(/[\t\r\n]/g, '').toLowerCase();
}

function lineContentRange(line: SourceLine): SourceRange {
  const leadingWhitespace = line.text.length - line.text.trimStart().length;
  const trailingWhitespace = line.text.length - line.text.trimEnd().length;
  return tokenRange(line, leadingWhitespace, line.text.length - leadingWhitespace - trailingWhitespace);
}

function tokenRange(line: SourceLine, startColumnOffset: number, length: number): SourceRange {
  const startOffset = line.startOffset + startColumnOffset;
  const endOffset = startOffset + length;
  const startColumn = startColumnOffset + 1;
  const endColumn = startColumn + length;

  return {
    startOffset,
    endOffset,
    startLine: line.lineNumber,
    startColumn,
    endLine: line.lineNumber,
    endColumn,
  };
}

function linesWithRanges(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const pattern = /.*(?:\r\n|\n|\r|$)/g;
  let match: RegExpExecArray | null;
  let lineNumber = 1;

  while ((match = pattern.exec(source)) !== null) {
    const raw = match[0];
    if (raw === '') break;
    const text = raw.replace(/\r?\n|\r$/, '');
    lines.push({
      text,
      startOffset: match.index,
      endOffset: match.index + text.length,
      lineNumber,
    });
    lineNumber += 1;
    if (pattern.lastIndex >= source.length) break;
  }

  if (source === '') {
    lines.push({ text: '', startOffset: 0, endOffset: 0, lineNumber: 1 });
  }

  return lines;
}
