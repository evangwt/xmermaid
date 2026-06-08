import type { SourceRange, XMermaidDiagnostic } from './types/diagnostics';

export type SecurityLevel = 'strict' | 'loose';

export interface SecurityPolicy {
  securityLevel: SecurityLevel;
  allowedUrlProtocols: string[];
  allowHtmlLabels: boolean;
  allowClickCallbacks: boolean;
}

export interface SecurityPolicyOptions {
  securityLevel?: SecurityLevel;
  securityPolicy?: Partial<SecurityPolicy>;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  securityLevel: 'strict',
  allowedUrlProtocols: ['http:', 'https:', 'mailto:'],
  allowHtmlLabels: false,
  allowClickCallbacks: false,
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

    if (!policy.allowHtmlLabels && /<\/?[A-Za-z][^>]*>/.test(line.text)) {
      diagnostics.push({
        code: 'security_blocked_html',
        message: 'Flowchart HTML labels are blocked by the active security policy.',
        severity: 'error',
        range: lineContentRange(line),
        featureId: 'flowchart.htmlLabel',
      });
    }

    for (const url of unsafeUrls(line, policy)) {
      diagnostics.push({
        code: 'security_blocked_url',
        message: `URL protocol ${url.protocol} is blocked by the active security policy.`,
        severity: 'error',
        range: url.range,
      });
    }
  }

  return diagnostics;
}

function policyDefaultsForLevel(securityLevel: SecurityLevel): SecurityPolicy {
  if (securityLevel === 'loose') {
    return {
      ...DEFAULT_SECURITY_POLICY,
      securityLevel,
      allowClickCallbacks: true,
      allowHtmlLabels: true,
    };
  }

  return {
    ...DEFAULT_SECURITY_POLICY,
    securityLevel,
    allowClickCallbacks: false,
    allowHtmlLabels: false,
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

function unsafeUrls(line: SourceLine, policy: SecurityPolicy): UnsafeUrl[] {
  const allowed = new Set(policy.allowedUrlProtocols);
  const matches: UnsafeUrl[] = [];
  const pattern = /(?:^|[\s"'(<[{|])([A-Za-z][A-Za-z0-9+.\-\t\r\n]*:)[^\s"'<>)}\]]*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line.text)) !== null) {
    const protocol = normalizeProtocol(match[1]);
    const tokenStart = match.index + match[0].indexOf(match[1]);
    const token = line.text.slice(tokenStart, tokenStart + match[0].length - (tokenStart - match.index));
    const dangerous = isDangerousProtocol(protocol);
    if (!dangerous && allowed.has(protocol)) continue;
    if (!dangerous && !token.startsWith(`${protocol}//`)) continue;
    matches.push({
      protocol,
      range: tokenRange(line, tokenStart, token.length),
    });
  }

  return matches;
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
