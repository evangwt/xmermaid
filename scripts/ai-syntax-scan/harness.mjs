/**
 * AI-syntax scan harness: outcome classification, SVG injection scanning, and
 * Markdown report generation. Pure functions (no imports, no DOM construction)
 * so the same logic can be unit-tested and reused.
 *
 * Verdict vocabulary (the documented result classes):
 *   renders          the diagram produced an SVG with no lost content
 *   literal-markup   an SVG was produced but a substring the entry declared in
 *                    `mustNotContain` (e.g. a raw `<br/>` that should have been
 *                    consumed into a line break) survived into the *visible*
 *                    text — a content-fidelity defect, not a security one
 *   throws           the render rejected the source (error message captured)
 *   silent-drop      an SVG was produced but some content was dropped
 *   security-blocked the active security policy rejected the source
 * In addition, injection probes may report `security-leak`, which is a
 * `renders` result that nonetheless carries executable content. It is only
 * ever produced for entries flagged `security: true` and is surfaced loudly.
 *
 * Classification precedence (first match wins): security-leak /
 * security-blocked (security entries, and any entry the policy rejects) →
 * throws → silent-drop (declared text missing) → literal-markup (declared
 * forbidden substring present in visible text) → renders.
 */

/** SVG/HTML elements that, if present in output, are executable/embedding. */
export const INJECTION_ELEMENTS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'animate',
  'set',
  'use',
  'handler',
];

/** Protocols that must never appear in href/style URLs. */
const DANGEROUS_PROTOCOL = /^\s*(?:javascript|data|vbscript):/i;

/** Unescaped opening tags in the serialized markup (escaped text cannot match). */
export const SERIALIZED_TAG_MARKERS = /<(script|foreignObject|iframe|object|embed|animate|set|handler)\b/i;

const stripControl = value => value.replace(/[\t\r\n]/g, '');

/**
 * Scan a rendered SVG element for executable content. Operates on the live
 * DOM (not the serialized string) so that neutralized text — e.g. the literal
 * characters `<img onerror=...>` that were escaped into a text node — does not
 * produce a false positive.
 *
 * @param {SVGSVGElement | null | undefined} svg
 * @returns {{kind: string, detail: string}[]}
 */
export function scanSvgForInjection(svg) {
  const findings = [];
  if (!svg || typeof svg.querySelectorAll !== 'function') return findings;

  const elements = [svg, ...Array.from(svg.querySelectorAll('*'))];
  for (const element of elements) {
    const tag = (element.tagName || element.nodeName || '').toString();
    if (INJECTION_ELEMENTS.includes(tag)) {
      findings.push({ kind: 'element', detail: `<${tag}>` });
    }
    const attributes = element.attributes ? Array.from(element.attributes) : [];
    for (const attribute of attributes) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value || '';
      if (name.startsWith('on')) {
        findings.push({ kind: 'event-attribute', detail: `${tag}[${attribute.name}]` });
      }
      if ((name === 'href' || name === 'xlink:href') && DANGEROUS_PROTOCOL.test(stripControl(value))) {
        findings.push({ kind: 'dangerous-url', detail: `${tag}[${attribute.name}]=${value}` });
      }
      if (name === 'style' && /url\(\s*['"]?\s*(?:javascript|data|vbscript):/i.test(stripControl(value))) {
        findings.push({ kind: 'dangerous-style', detail: `${tag}[style]=${value}` });
      }
      if (name === 'src' && DANGEROUS_PROTOCOL.test(stripControl(value))) {
        findings.push({ kind: 'dangerous-src', detail: `${tag}[src]=${value}` });
      }
    }
  }
  return findings;
}

/**
 * Secondary string-level scan for unescaped element tags in serialized SVG.
 * A text node containing `<script>` is serialized as `&lt;script&gt;`, so any
 * literal `<script` in the serialization is a real element.
 */
export function scanSerializedForTags(serialized) {
  const findings = [];
  if (typeof serialized !== 'string') return findings;
  const match = SERIALIZED_TAG_MARKERS.exec(serialized);
  if (match) findings.push({ kind: 'serialized-tag', detail: `<${match[1]}>` });
  return findings;
}

const errorDiagnosticCodes = diagnostics =>
  (diagnostics || []).map(diagnostic => diagnostic && diagnostic.code).filter(Boolean);

/** SVG elements whose text is *metadata*, never painted for the reader. */
const METADATA_TEXT_TAGS = new Set(['title', 'desc']);

/** Recursively collect text-node values, skipping `<title>`/`<desc>` subtrees. */
function collectVisibleText(node, out) {
  const children = node.childNodes ? Array.from(node.childNodes) : [];
  for (const child of children) {
    if (child.nodeType === 3) {
      // Text node — the visible characters themselves.
      out.push(child.nodeValue || '');
    } else if (child.nodeType === 1) {
      const tag = (child.tagName || child.nodeName || '').toString().toLowerCase();
      if (METADATA_TEXT_TAGS.has(tag)) continue;
      collectVisibleText(child, out);
    }
  }
}

/**
 * Extract the *visible* text of a rendered SVG: the concatenated `textContent`
 * of every `<text>`/`<tspan>` node, with `<title>`/`<desc>` metadata excluded.
 * Metadata legitimately preserves the raw source (a literal `<br/>` kept for
 * tooltips is not a defect), so it must not count as visible content. Because
 * `textContent` decodes character references, an escaped `&lt;br/&gt;` surfaces
 * here as the literal string `<br/>`, and a raw `<br/>` that was never consumed
 * surfaces identically — which is exactly what `mustNotContain` detects.
 *
 * @param {SVGSVGElement | null | undefined} svg
 * @returns {string}
 */
export function extractVisibleText(svg) {
  if (!svg || typeof svg.querySelectorAll !== 'function') return '';
  const parts = [];
  for (const node of Array.from(svg.querySelectorAll('text, tspan'))) {
    collectVisibleText(node, parts);
  }
  return parts.join('\n');
}

/** Short, report-friendly window of `haystack` around the first `needle`. */
function matchSnippet(haystack, needle, radius = 16) {
  const index = haystack.indexOf(needle);
  if (index < 0) return '';
  const start = Math.max(0, index - radius);
  const end = Math.min(haystack.length, index + needle.length + radius);
  return haystack.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Classify one probe outcome.
 *
 * @param {object} entry corpus entry
 * @param {{final: object, raw?: object|null}} outcome
 * @returns {object} row: { id, family, category, variant, verdict, detail, ... }
 */
export function classifyOutcome(entry, outcome) {
  const final = outcome.final;
  const diagnostics = final && final.diagnostics ? final.diagnostics : [];
  const diagCodes = errorDiagnosticCodes(diagnostics);

  if (final && final.status === 'error') {
    const blockedCodes = diagCodes.filter(code => code.startsWith('security_blocked_'));
    if (blockedCodes.length > 0) {
      return {
        id: entry.id,
        family: entry.family,
        category: entry.category,
        variant: entry.variant,
        verdict: 'security-blocked',
        detail: `diagnostics=${blockedCodes.join(',')}`,
        errorCode: final.errorCode || null,
        diagCodes,
      };
    }
    const message = final.error && final.error.message ? final.error.message : String(final.error);
    return {
      id: entry.id,
      family: entry.family,
      category: entry.category,
      variant: entry.variant,
      verdict: 'throws',
      detail: `${final.errorCode || 'ERROR'}: ${message}`,
      errorCode: final.errorCode || null,
      diagCodes,
    };
  }

  // Rendered successfully.
  const leaks = scanSvgForInjection(final.svg);
  const serializedTags = scanSerializedForTags(final.serialized);
  const allLeaks = [...leaks, ...serializedTags];
  const text = typeof final.textContent === 'string' ? final.textContent : '';
  const missing = (entry.mustContain || []).filter(token => !text.includes(token));

  const row = {
    id: entry.id,
    family: entry.family,
    category: entry.category,
    variant: entry.variant,
    errorCode: null,
    diagCodes,
    leaks: allLeaks,
    missing,
    textCount: typeof final.svg.querySelectorAll === 'function' ? final.svg.querySelectorAll('text').length : null,
  };

  if (entry.security) {
    row.verdict = allLeaks.length > 0 ? 'security-leak' : 'renders';
    row.detail = allLeaks.length > 0
      ? `LEAK: ${allLeaks.map(leak => leak.detail).join(', ')}`
      : 'neutralized (no executable content in output)';
    return row;
  }

  if (missing.length > 0) {
    row.verdict = 'silent-drop';
    row.detail = `missing text: ${missing.join(', ')}`;
    return row;
  }

  // Opt-in content-fidelity check: only entries that declare `mustNotContain`
  // are inspected. Security entries returned above and never reach here, so
  // their intentional literal `<script>`/`<img onerror>` text is never flagged.
  const visibleText = extractVisibleText(final.svg);
  const forbidden = (entry.mustNotContain || []).filter(token => visibleText.includes(token));
  if (forbidden.length > 0) {
    row.verdict = 'literal-markup';
    const snippet = matchSnippet(visibleText, forbidden[0]);
    row.detail = `literal markup in visible text: ${forbidden.join(', ')} (near "${snippet}")`;
    return row;
  }

  row.verdict = 'renders';
  row.detail = `texts=${row.textCount}`;
  return row;
}

/** Stable, human-readable summary of an injection finding list. */
export function formatLeaks(leaks) {
  return leaks && leaks.length > 0 ? leaks.map(leak => leak.detail).join(', ') : '—';
}

/** Group rows by family, preserving FAMILIES order where provided. */
export function groupByFamily(rows, families) {
  const order = families && families.length > 0 ? families : [...new Set(rows.map(row => row.family))];
  const groups = new Map(order.map(family => [family, []]));
  for (const row of rows) {
    if (!groups.has(row.family)) groups.set(row.family, []);
    groups.get(row.family).push(row);
  }
  return groups;
}

const VERDICT_ORDER = ['renders', 'literal-markup', 'silent-drop', 'security-blocked', 'throws', 'security-leak'];

/** Count rows per verdict. */
export function tallyVerdicts(rows) {
  const tally = new Map(VERDICT_ORDER.map(verdict => [verdict, 0]));
  for (const row of rows) tally.set(row.verdict, (tally.get(row.verdict) || 0) + 1);
  return tally;
}

const escapeCell = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/**
 * Build the Markdown gap report.
 *
 * @param {object} params
 * @param {object[]} params.rows classified rows
 * @param {object[]} params.entries corpus entries (for expectations)
 * @param {string[]} params.families catalog families
 * @param {object} params.meta { version, mermaidVersion, generatedAt, command, caseCount }
 * @returns {string}
 */
export function buildReport({ rows, entries, families, meta }) {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const tally = tallyVerdicts(rows);
  const nonRendering = rows.filter(row => row.verdict !== 'renders');
  const securityRows = rows.filter(row => byId.get(row.id) && byId.get(row.id).security);
  const familiesCovered = new Set(rows.map(row => row.family));
  const variantCount = rows.length;

  const out = [];
  out.push('# AI-emitted Mermaid syntax — renderer gap scan');
  out.push('');
  out.push(`- Generated: ${meta.generatedAt}`);
  out.push(`- Renderer: \`@evangwt/xmermaid@${meta.version}\` (Mermaid compatibility target ${meta.mermaidVersion})`);
  out.push(`- Corpus: ${variantCount} probes across ${familiesCovered.size}/${families.length} documented families`);
  out.push(`- Reproduce: \`${meta.command}\``);
  out.push('');
  out.push('Result vocabulary: `renders` (clean), `throws` (rejected, message captured),');
  out.push('`literal-markup` (declared substring — e.g. a raw `<br/>` — survived into the');
  out.push('visible text instead of being consumed), `silent-drop` (SVG produced but content');
  out.push('lost), `security-blocked` (policy rejected), `security-leak` (injection probe that');
  out.push('rendered executable content — must stay at zero).');
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push('| Verdict | Count |');
  out.push('| --- | ---: |');
  for (const verdict of VERDICT_ORDER) {
    out.push(`| ${verdict} | ${tally.get(verdict) || 0} |`);
  }
  out.push(`| **total** | **${rows.length}** |`);
  out.push('');

  out.push('## Coverage by family');
  out.push('');
  out.push('| Family | Probes | renders | non-renders |');
  out.push('| --- | ---: | ---: | ---: |');
  const groups = groupByFamily(rows, families);
  for (const [family, familyRows] of groups) {
    const renders = familyRows.filter(row => row.verdict === 'renders').length;
    out.push(`| ${family} | ${familyRows.length} | ${renders} | ${familyRows.length - renders} |`);
  }
  out.push('');

  out.push('## Gaps — every non-`renders` probe');
  out.push('');
  if (nonRendering.length === 0) {
    out.push('_No gaps found._');
    out.push('');
  } else {
    out.push('| Family | Variant | Verdict | Evidence |');
    out.push('| --- | --- | --- | --- |');
    for (const row of nonRendering) {
      out.push(`| ${escapeCell(row.family)} | ${escapeCell(row.variant)} | ${row.verdict} | ${escapeCell(row.detail)} |`);
    }
    out.push('');
  }

  out.push('## Security — injection probes');
  out.push('');
  out.push('Method: every probe is rendered twice — once under the default strict policy');
  out.push('(`sanitizeSvg: true`, `allowClickCallbacks: false`) and once with `sanitizeSvg: false`');
  out.push('so the renderer\'s own escaping is observed without the post-render sanitizer.');
  out.push('The returned SVG is scanned at the DOM level for `script`/`foreignObject`/`iframe`/');
  out.push('`object`/`embed`/`animate`/`set`/`handler` elements, `on*` event attributes, and');
  out.push('`javascript:`/`data:`/`vbscript:` URLs in `href`/`src`/`style`; the serialized markup is');
  out.push('also scanned for unescaped executable tags.');
  out.push('');
  out.push('| Family | Variant | Default-policy verdict | sanitizeSvg:false leaks |');
  out.push('| --- | --- | --- | --- |');
  for (const row of securityRows) {
    const rawLeaks = row.rawLeaks;
    const rawDetail = row.rawStatus === 'error'
      ? `blocked (${row.rawErrorCode || 'ERROR'})`
      : formatLeaks(rawLeaks);
    out.push(`| ${escapeCell(row.family)} | ${escapeCell(row.variant)} | ${row.verdict} | ${escapeCell(rawDetail)} |`);
  }
  out.push('');
  const leaks = securityRows.filter(row => row.verdict === 'security-leak' || (row.rawLeaks && row.rawLeaks.length > 0));
  out.push(leaks.length === 0
    ? '**Conclusion: no injection probe produced executable content, with or without the SVG sanitizer.**'
    : `**Conclusion: ${leaks.length} probe(s) produced executable content — see rows above.**`);
  out.push('');

  const surprises = rows.filter(row => {
    const entry = byId.get(row.id);
    return entry && entry.expect && entry.expect !== row.verdict;
  });
  out.push('## Expectation surprises');
  out.push('');
  if (surprises.length === 0) {
    out.push('_Every documented expectation matched the observed verdict._');
    out.push('');
  } else {
    out.push('| Family | Variant | expected | observed |');
    out.push('| --- | --- | --- | --- |');
    for (const row of surprises) {
      const entry = byId.get(row.id);
      out.push(`| ${escapeCell(row.family)} | ${escapeCell(row.variant)} | ${entry.expect} | ${row.verdict} |`);
    }
    out.push('');
  }

  out.push('## Full results');
  out.push('');
  out.push('| id | Family | Category | Variant | Verdict | Evidence |');
  out.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of rows) {
    out.push(`| ${escapeCell(row.id)} | ${escapeCell(row.family)} | ${escapeCell(row.category)} | ${escapeCell(row.variant)} | ${row.verdict} | ${escapeCell(row.detail)} |`);
  }
  out.push('');
  out.push('_Diagnostic only — the renderer source was not modified by this scan._');
  out.push('');

  return out.join('\n');
}

export { VERDICT_ORDER };
