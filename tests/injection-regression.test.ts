import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, * as wasmPkg from '../pkg/xmermaid_wasm.js';
import { XMermaid } from '../src/xmermaid';
import { LIGHT_THEME } from '../src/types/theme';
import { __setWasmModuleLoaderForTests } from '../src/wasm';
import { XMermaidError } from '../src/types/error';
import { scanSvgForInjection, scanSerializedForTags } from '../scripts/ai-syntax-scan/harness.mjs';

/**
 * Injection regression for the newly-tolerated AI syntax.
 *
 * Every syntax tolerance added by docs/ai-syntax-support-plan.md §3.3 is
 * paired here with a probe that carries an injection payload in the *same*
 * construct. The point is to prove the added tolerance does not widen the
 * attack surface: the payload must be neutralized to inert text, and the
 * non-negotiable security list from §3.1 must stay fail-closed.
 *
 * Assertions are deliberately DOM-level (`scanSvgForInjection`) plus a
 * serialized scan that only looks for *unescaped executable element tags*
 * (`scanSerializedForTags`). We never regex the serialized string for
 * `onerror=`/`onload=`: a neutralized payload keeps the literal attribute
 * text (its `<`/`>` are escaped to `&lt;`/`&gt;`) and a naive attribute regex
 * would produce a false positive.
 */

const container = document.createElement('div');
const renderer = new XMermaid({ container });

beforeAll(async () => {
  await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  __setWasmModuleLoaderForTests(async () => wasmPkg as never);
});

interface RenderOutcome {
  ok: boolean;
  leaks: string[];
  errorCode: string | null;
  blocked: boolean;
}

/** Render once and collect every DOM/serialized injection finding. */
async function renderAndScan(source: string, sanitizeSvg: boolean): Promise<RenderOutcome> {
  try {
    const result = await renderer.renderToSVGElement(source, {
      theme: LIGHT_THEME,
      securityPolicy: sanitizeSvg ? undefined : { sanitizeSvg: false },
    });
    const serialized = new XMLSerializer().serializeToString(result.svg);
    const leaks = [
      ...scanSvgForInjection(result.svg).map(finding => `${finding.kind}:${finding.detail}`),
      ...scanSerializedForTags(serialized).map(finding => `${finding.kind}:${finding.detail}`),
    ];
    return { ok: true, leaks, errorCode: null, blocked: false };
  } catch (error) {
    const diagnostics = error instanceof XMermaidError ? error.diagnostics : [];
    return {
      ok: false,
      leaks: [],
      errorCode: error instanceof XMermaidError ? error.code : null,
      blocked: diagnostics.some(diagnostic => diagnostic.code.startsWith('security_blocked_')),
    };
  }
}

const lines = (...parts: string[]): string => parts.join('\n');

/**
 * §3.3 — one probe per newly-tolerated syntax, each carrying an injection
 * payload. These must all render as inert text, with and without the
 * post-render sanitizer, and produce zero injection findings.
 */
const NEUTRALIZED_CASES: { name: string; source: string }[] = [
  {
    name: 'en-dash arrow normalization + <script> in node label',
    source: lines('flowchart TD', '  A \u2013> B["<script>alert(1)</script>"]'),
  },
  {
    name: 'em-dash arrow normalization + <img onerror> in node label',
    source: lines('flowchart TD', '  A \u2014> B["<img src=x onerror=alert(1)>"]'),
  },
  {
    name: 'full-width dash arrow normalization + <svg onload> in node label',
    source: lines('sequenceDiagram', '  A\uff0d>>B: <svg onload=alert(1)>'),
  },
  {
    name: 'UTF-8 BOM normalization + <script> in node label',
    source: '\uFEFF' + lines('flowchart TD', '  A["<script>alert(1)</script>"] --> B'),
  },
  {
    name: 'escaped-pipe edge label + <img onerror> inside the label',
    source: lines('flowchart TD', '  A -->|a \\| <img src=x onerror=alert(1)> \\| b| B'),
  },
  {
    name: 'standalone <<interface>> annotation + <script> class name',
    source: lines('classDiagram', '  <<interface>> <script>alert(1)</script>', '  A <|-- B'),
  },
  {
    name: 'standalone <<Service>> annotation + <script> class name',
    source: lines('classDiagram', '  <<Service>> <script>alert(1)</script>', '  A --> B'),
  },
  {
    name: 'state concurrent region separator + <script> in note',
    source: lines('stateDiagram-v2', '  [*] --> A', '  --', '  note right of A : <script>alert(1)</script>'),
  },
  {
    name: 'c4 boundary block on the call line + <script> boundary label',
    source: lines('C4Context', '  Enterprise_Boundary(b, "<script>alert(1)</script>") {', '    System(s, "S")', '  }'),
  },
  {
    name: 'zenuml participant declaration + <script> participant name',
    source: lines('zenuml', '  participant <script>alert(1)</script>', '  A->B: x'),
  },
  {
    name: 'treemap two-space hierarchy + <script> label',
    source: lines('treemap-beta', '"<script>alert(1)</script>"', '  "x": 1'),
  },
  {
    name: 'kanban non-ASCII column id + <img onerror> label',
    source: lines('kanban', '  \u5b8c\u6210[<img src=x onerror=alert(1)>]', '    \u4efb\u52a1[Task]'),
  },
];

describe('injection scanner canary — the detector is not a no-op', () => {
  it('flags a genuine <script> element and unescaped serialized tag', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const script = document.createElementNS('http://www.w3.org/2000/svg', 'script');
    svg.appendChild(script);

    expect(scanSvgForInjection(svg).some(finding => finding.kind === 'element')).toBe(true);
    expect(scanSerializedForTags('<svg><script>alert(1)</script></svg>').length).toBeGreaterThan(0);
  });

  it('does not flag a neutralized escaped payload', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    // Literal payload characters survive as text content, but they are inert:
    // the DOM has no element and the serialization escapes the angle brackets.
    text.textContent = '<img src=x onerror=alert(1)>';
    svg.appendChild(text);

    const serialized = new XMLSerializer().serializeToString(svg);
    expect(serialized).toContain('&lt;img');
    expect(scanSvgForInjection(svg)).toEqual([]);
    expect(scanSerializedForTags(serialized)).toEqual([]);
  });
});

describe('injection regression — newly-tolerated syntax stays inert', () => {
  it.each(NEUTRALIZED_CASES)('$name', async ({ source }) => {
    // Both with and without the post-render sanitizer: the renderer's own
    // escaping must already be sufficient, and the sanitizer is only the last
    // line of defence.
    for (const sanitizeSvg of [true, false]) {
      const outcome = await renderAndScan(source, sanitizeSvg);
      expect(
        outcome.ok,
        `sanitizeSvg=${sanitizeSvg} unexpectedly rejected (${outcome.errorCode ?? 'ok'})`,
      ).toBe(true);
      expect(outcome.leaks, `sanitizeSvg=${sanitizeSvg} produced executable content`).toEqual([]);
    }
  });
});

/**
 * §3.1 — the non-negotiable list. These must stay blocked by the active
 * security policy regardless of the new tolerances.
 */
const BLOCKED_CASES: { name: string; source: string }[] = [
  {
    name: 'lowercase javascript: URL in node label',
    source: lines('flowchart TD', '  A[javascript:alert(1)] --> B'),
  },
  {
    name: 'mixed-case JaVaScRiPt: URL in node label',
    source: lines('flowchart TD', '  A[JaVaScRiPt:alert(1)] --> B'),
  },
  {
    name: 'tab-split javascript: URL in node label',
    source: lines('flowchart TD', '  A[java\tscript:alert(1)] --> B'),
  },
  {
    name: 'newline-split javascript: URL in node label',
    source: lines('flowchart TD', '  A[java', 'script:alert(1)] --> B'),
  },
  {
    name: 'data:text/html URL in node label',
    source: lines('flowchart TD', '  A[data:text/html,<script>alert(1)</script>] --> B'),
  },
  {
    name: 'vbscript: URL in node label',
    source: lines('flowchart TD', '  A[vbscript:msgbox(1)] --> B'),
  },
  {
    name: 'javascript: URL in edge label',
    source: lines('flowchart TD', '  A -->|javascript:alert(1)| B'),
  },
  {
    name: 'strict click with https URL (all clicks blocked)',
    source: lines('flowchart TD', '  A --> B', '  click A "https://example.com"'),
  },
  {
    name: 'strict click with javascript: URL',
    source: lines('flowchart TD', '  A --> B', '  click A "javascript:alert(1)"'),
  },
  {
    name: 'click href with javascript: URL',
    source: lines('flowchart TD', '  A --> B', '  click A href "javascript:alert(1)"'),
  },
  {
    name: 'source %%{init securityLevel loose}%% directive must not lower policy',
    source: lines("%%{init: {'securityLevel':'loose'}}%%", 'flowchart TD', '  A --> B', '  click A "https://example.com"'),
  },
];

describe('injection regression — §3.1 non-negotiable list stays blocked', () => {
  it.each(BLOCKED_CASES)('$name', async ({ source }) => {
    const outcome = await renderAndScan(source, true);
    expect(outcome.ok, `expected the source to be rejected, got ok (${outcome.errorCode ?? 'ok'})`).toBe(false);
    expect(outcome.blocked, 'expected a security_blocked_* diagnostic').toBe(true);
  });
});

/**
 * §3.1 — dangerous styles must be rejected before they can reach the SVG.
 * These throw from the style validators (support gate or Rust parser), so the
 * only requirement is that they never render.
 */
const REJECTED_STYLE_CASES: { name: string; source: string }[] = [
  {
    name: 'flowchart classDef fill:url(#ref)',
    source: lines('flowchart TD', '  A --> B', '  classDef x fill:url(#evil)', '  class A x'),
  },
  {
    name: 'flowchart classDef fill:url(javascript:)',
    source: lines('flowchart TD', '  A --> B', '  classDef x fill:url(javascript:alert(1))', '  class A x'),
  },
  {
    name: 'flowchart style fill:url(javascript:)',
    source: lines('flowchart TD', '  A --> B', '  style A fill:url(javascript:alert(1))'),
  },
  {
    name: 'quadrant classDef fill:url(javascript:)',
    source: lines('quadrantChart', '  classDef x fill:url(javascript:alert(1))', '  A: [0.3, 0.6]:::x'),
  },
];

describe('injection regression — dangerous styles stay rejected', () => {
  it.each(REJECTED_STYLE_CASES)('$name', async ({ source }) => {
    const sanitized = await renderAndScan(source, true);
    const raw = await renderAndScan(source, false);
    expect(sanitized.ok, 'expected the dangerous style to be rejected (sanitizeSvg: true)').toBe(false);
    expect(raw.ok, 'expected the dangerous style to be rejected (sanitizeSvg: false)').toBe(false);
    expect([...sanitized.leaks, ...raw.leaks]).toEqual([]);
  });
});
