import type { SourceRange } from './types/diagnostics';

/**
 * Input normalization for AI-emitted Mermaid.
 *
 * The render pipeline has two gates that run *before* the Rust parser:
 * `analyzeSupport` (src/support.ts) and `detectSecurityDiagnostics`
 * (src/security.ts). If a glyph quirk (a smart-dash arrow, a UTF-8 BOM) is not
 * folded away before those gates run, the TS gate rejects the source before the
 * Rust parser ever sees it — so the fix has to happen here, once, and the same
 * text must be handed to the gates and to `wasm.render`.
 *
 * Hard constraints (see docs/ai-syntax-support-plan.md §2.1, §3.2):
 *   - Equivalent, character-for-character rewrites only. No entity decoding,
 *     no percent decoding, no token joining.
 *   - Never touch ordinary label text: a dash-like character is only folded
 *     when it forms the start of an arrow head (a dash run immediately before
 *     `>`), so a label such as `en – dash` is left exactly as written.
 *   - Only a fence that opens the source is removed, and only when its info
 *     string is empty or names Mermaid; ```js stays untouched. The block ends at
 *     the first matching closer (Markdown semantics), and nested fences are
 *     unwrapped repeatedly so the result is stable.
 *   - Idempotent: `normalizeSource(normalizeSource(x).text).text === normalizeSource(x).text`.
 */

/** Map between offsets in the normalized text and offsets in the original. */
export interface SourceOffsetMap {
  /** Characters removed from the start of the original source (leading BOM). */
  readonly removedPrefixLength: number;
  /** Translate an offset in the normalized text back to the original source. */
  toOriginalOffset(offset: number): number;
}

export interface NormalizedSource {
  /** The normalized source handed to the support gate, security gate, and parser. */
  text: string;
  /** Offset mapping back to the caller's original source for diagnostics. */
  offsetMap: SourceOffsetMap;
}

const BOM = '\uFEFF';
// En dash, em dash, minus sign, full-width hyphen-minus.
const DASH_LIKE = new Set(['\u2013', '\u2014', '\u2212', '\uFF0D']);
const ARROW_HEAD = '>';

// A Markdown fence opener: ``` / ~~~ plus an optional info string whose first
// token is the language. The closer must be a bare run of the same marker.
const FENCE_OPENER = /^(`{3,}|~{3,})[ \t]*([A-Za-z0-9_-]*)/;
const FENCE_CLOSER = /^(`{3,}|~{3,})[ \t]*$/;
// Fences that quote Mermaid may be stripped; a fence naming another language
// (```js) is somebody's code sample and stays exactly as written.
const FENCE_LANGUAGES = new Set(['', 'mermaid', 'xmermaid', 'mmd']);

function isDashCharacter(character: string | undefined): boolean {
  return character === '-' || (character !== undefined && DASH_LIKE.has(character));
}

/**
 * Fold a run of dash-like characters into ASCII hyphens **only** when the run
 * is immediately followed by `>` (an arrow head). This rewrites `–>`, `—>`,
 * `−>` and `－>>` to their ASCII equivalents while leaving every dash that is
 * part of ordinary text untouched.
 */
function foldArrowDashes(source: string): string {
  let result = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    if (isDashCharacter(character)) {
      let end = index;
      while (end < source.length && isDashCharacter(source[end])) end += 1;
      if (source[end] === ARROW_HEAD) {
        result += '-'.repeat(end - index);
      } else {
        result += source.slice(index, end);
      }
      index = end;
    } else {
      result += character;
      index += 1;
    }
  }
  return result;
}

interface FenceBounds {
  /** Offset of the first character after the opening fence line. */
  contentStart: number;
  /** Offset where the closing fence line begins (or the slice end if unclosed). */
  contentEnd: number;
}

/**
 * Detect a Markdown fence that *opens* the `[from, to)` slice.
 *
 * AI chat answers arrive with the diagram inside a ```mermaid block, and pasting
 * the whole block used to fail with "Unknown diagram type". Only a fence whose
 * opener is the first content line is considered — a fence that merely appears
 * inside a label or a comment is not a wrapper — and the info string must be
 * empty or name Mermaid, so ```js stays a code sample.
 *
 * The block ends at the *first* matching closer, exactly as Markdown defines a
 * fenced code block: content after the closer is outside the block and is not
 * part of the diagram. A missing closer is tolerated (streaming output is often
 * truncated) and the block runs to the end. A closer whose marker does not match
 * the opener (~~~ vs ```) does not close the fence.
 *
 * Everything removed is a contiguous prefix plus a contiguous suffix, so the
 * constant prefix shift in {@link SourceOffsetMap} still maps offsets back.
 */
function stripWrappingFence(input: string, from: number, to: number): FenceBounds | null {
  const lines: { start: number; end: number; text: string }[] = [];
  let index = from;
  while (index <= to) {
    let end = input.indexOf('\n', index);
    if (end < 0 || end > to) end = to;
    lines.push({ start: index, end, text: input.slice(index, end) });
    if (end >= to) break;
    index = end + 1;
  }

  let open = 0;
  while (open < lines.length && lines[open]!.text.trim() === '') open += 1;
  if (open >= lines.length) return null;

  const opener = FENCE_OPENER.exec(lines[open]!.text.trim());
  if (!opener || !FENCE_LANGUAGES.has((opener[2] ?? '').toLowerCase())) return null;

  const marker = opener[1]!;
  let close = -1;
  for (let probe = open + 1; probe < lines.length; probe += 1) {
    const closer = FENCE_CLOSER.exec(lines[probe]!.text.trim());
    if (closer && closer[1]![0] === marker[0] && closer[1]!.length >= marker.length) {
      close = probe;
      break;
    }
  }

  const contentStart = lines[open]!.end < to ? lines[open]!.end + 1 : lines[open]!.end;
  const contentEnd = close >= 0 ? lines[close]!.start : to;
  if (input.slice(contentStart, contentEnd).trim() === '') return null;
  return { contentStart, contentEnd };
}

/**
 * Normalize an AI-emitted Mermaid source into the canonical form the rest of
 * the pipeline expects. Currently: strip a leading UTF-8 BOM, unwrap any
 * surrounding Markdown fences, and fold smart/full-width dash arrows into ASCII.
 *
 * Only a prefix (BOM, blank lines, and the opening fences) and a suffix (the
 * closing fences) are ever removed, so `toOriginalOffset` stays a constant
 * shift. The unwrap loop terminates because every pass consumes at least the
 * opener line, so `start` strictly increases.
 */
export function normalizeSource(input: string): NormalizedSource {
  let start = 0;
  while (input[start] === BOM) start += 1;

  let end = input.length;
  for (;;) {
    const fence = stripWrappingFence(input, start, end);
    if (!fence) break;
    start = fence.contentStart;
    end = fence.contentEnd;
  }

  const text = foldArrowDashes(input.slice(start, end));
  const offsetMap: SourceOffsetMap = {
    removedPrefixLength: start,
    toOriginalOffset: (offset: number) => offset + start,
  };
  return { text, offsetMap };
}

function shiftRange(range: SourceRange, shift: number): SourceRange {
  return {
    startOffset: range.startOffset + shift,
    endOffset: range.endOffset + shift,
    startLine: range.startLine,
    startColumn: range.startLine === 1 ? range.startColumn + shift : range.startColumn,
    endLine: range.endLine,
    endColumn: range.endLine === 1 ? range.endColumn + shift : range.endColumn,
  };
}

/**
 * Remap diagnostic ranges from normalized offsets back to the caller's
 * original source. Only a leading BOM shifts offsets today, so this is a
 * constant prefix shift; when nothing was removed it is an identity.
 */
export function mapDiagnosticsToOriginal<T extends { range: SourceRange | null }>(
  diagnostics: T[],
  offsetMap: SourceOffsetMap,
): T[] {
  const shift = offsetMap.removedPrefixLength;
  if (shift === 0) return diagnostics;
  return diagnostics.map(diagnostic =>
    diagnostic.range ? { ...diagnostic, range: shiftRange(diagnostic.range, shift) } : diagnostic);
}
