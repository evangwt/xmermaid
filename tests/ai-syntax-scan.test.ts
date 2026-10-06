import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import initWasmPackage, * as wasmPkg from '../pkg/xmermaid_wasm.js';
import { XMermaid } from '../src/xmermaid';
import { LIGHT_THEME } from '../src/types/theme';
import { __setWasmModuleLoaderForTests } from '../src/wasm';
import { MERMAID_COMPATIBILITY_VERSION } from '../src/diagram-catalog';
import { XMermaidError } from '../src/types/error';
import { CORPUS, FAMILIES } from '../scripts/ai-syntax-scan/corpus.mjs';
import {
  buildReport,
  classifyOutcome,
  scanSvgForInjection,
  scanSerializedForTags,
  tallyVerdicts,
} from '../scripts/ai-syntax-scan/harness.mjs';

/**
 * AI-emitted syntax scan — diagnostic only.
 *
 * Runs the entire corpus through the real WASM-backed pipeline
 * (`XMermaid.renderToSVGElement`), classifies every outcome, and writes the
 * Markdown gap report to `docs/ai-syntax-scan.md`. This test intentionally
 * does NOT fail on gaps: it is a measurement, not an assertion of support.
 * It only fails if the corpus itself is malformed or the harness breaks.
 */

const REPORT_PATH = resolve(process.cwd(), 'docs/ai-syntax-scan.md');

/**
 * Gap thresholds. The scan used to be diagnostic-only; these lock in the
 * current tolerance so an accidental regression (a syntax that starts throwing
 * again, a silent content drop, or a label that leaks literal markup) fails
 * loudly instead of quietly widening the gap. `renders` must not fall and the
 * `throws`/`silent-drop`/`literal-markup` ceilings must not rise. Raise/lower
 * deliberately when the corpus changes.
 *
 * Last moved for the fence-unwrapping round: 225 -> 236 probes, with seven fence
 * variants moving from `throws` to `renders` (```mermaid, ~~~mermaid, bare ```,
 * truncated, fenced en-dash arrow, trailing prose, trailing payload) and one
 * documented `throws` entry added (a ```js fence stays a code sample).
 *
 * Moved again for the `<br/>` label-fidelity round: the corpus grew from 236 to
 * 266 probes with one `<br/>BRPROBE` probe per documented family (30 total), and
 * the harness gained the opt-in `literal-markup` verdict. That verdict is an
 * independent class, so the 28 probes whose families still paint `<br/>` as
 * literal text no longer count as `renders`; only the 2 positive controls
 * (flowchart, sequence) raise the floor: 205 + 2 = 207. `throws` and
 * `silent-drop` are untouched by this defect (205 -> 207 is the whole change).
 *
 * Lowered for the batch-1 parser fix: the 12 families that only missed the
 * `sanitize_label_text` call site (class, state, er, architecture, user-journey,
 * timeline, mindmap, treeview, requirement, gitgraph, c4, zenuml) now convert
 * `<br/>` into a real line break, so their probes moved from `literal-markup`
 * to `renders`: LITERAL_MARKUP_CEILING 28 -> 16 and RENDERS_FLOOR 207 -> 219
 * (12 flipped). `throws`/`silent-drop` are unchanged. The remaining 16 gaps are
 * the layout-dependent batches (2/3/4); the full fix drives
 * LITERAL_MARKUP_CEILING to 0.
 */
const RENDERS_FLOOR = 219;
const THROWS_CEILING = 19;
const SILENT_DROP_CEILING = 1;
const LITERAL_MARKUP_CEILING = 16;

const packageVersion = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
).version as string;

beforeAll(async () => {
  // Initialise the wasm-bindgen package once from the local build artefact...
  await initWasmPackage({ module_or_path: readFileSync('pkg/xmermaid_wasm_bg.wasm') });
  // ...then let the SDK's loader hand back the already-initialised module so
  // the full XMermaid pipeline (support analysis + security policy + renderer
  // + sanitizer) runs against the real WASM instead of a mock.
  __setWasmModuleLoaderForTests(async () => wasmPkg as never);
});

interface OutcomeOk {
  status: 'ok';
  svg: SVGSVGElement;
  serialized: string;
  textContent: string;
  diagnostics: unknown[];
}

interface OutcomeErr {
  status: 'error';
  error: unknown;
  errorCode: string | null;
  diagnostics: unknown[];
}

type Outcome = OutcomeOk | OutcomeErr;

const container = document.createElement('div');
const renderer = new XMermaid({ container });

async function renderOnce(source: string, sanitizeSvg: boolean): Promise<Outcome> {
  try {
    const result = await renderer.renderToSVGElement(source, {
      theme: LIGHT_THEME,
      securityPolicy: sanitizeSvg ? undefined : { sanitizeSvg: false },
    });
    return {
      status: 'ok',
      svg: result.svg,
      serialized: new XMLSerializer().serializeToString(result.svg),
      textContent: result.svg.textContent ?? '',
      diagnostics: result.diagnostics,
    };
  } catch (error) {
    return {
      status: 'error',
      error,
      errorCode: error instanceof XMermaidError ? error.code : null,
      diagnostics: error instanceof XMermaidError ? error.diagnostics : [],
    };
  }
}

describe('AI-syntax scan (diagnostic)', () => {
  it('has a well-formed corpus', () => {
    const ids = CORPUS.map(entry => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const families = new Set(CORPUS.map(entry => entry.family));
    for (const family of families) {
      expect(FAMILIES).toContain(family);
    }
  });

  it('scans every family and writes the gap report', async () => {
    const rows: Record<string, unknown>[] = [];

    for (const entry of CORPUS) {
      const final = await renderOnce(entry.source, true);
      const outcome: { final: Outcome; raw?: Outcome | null } = { final };
      if (entry.security) {
        outcome.raw = await renderOnce(entry.source, false);
      }
      const row = classifyOutcome(entry, outcome) as Record<string, unknown>;

      if (entry.security && outcome.raw) {
        const raw = outcome.raw;
        row.rawStatus = raw.status;
        if (raw.status === 'error') {
          row.rawErrorCode = raw.errorCode;
          row.rawLeaks = [];
        } else {
          row.rawLeaks = [
            ...scanSvgForInjection(raw.svg),
            ...scanSerializedForTags(raw.serialized),
          ];
        }
      }
      rows.push(row);
    }

    const report = buildReport({
      rows,
      entries: CORPUS,
      families: FAMILIES,
      meta: {
        version: packageVersion,
        mermaidVersion: MERMAID_COMPATIBILITY_VERSION,
        generatedAt: new Date().toISOString(),
        command: 'npx vitest run tests/ai-syntax-scan.test.ts',
        caseCount: CORPUS.length,
      },
    });
    writeFileSync(REPORT_PATH, report, 'utf8');

    // Hard security assertion: no injection probe may render executable
    // content, neither under the default policy nor with the post-render
    // sanitizer disabled. This is the §3.3 requirement that upgrades the scan
    // from "diagnostic" to "fail-closed".
    const securityLeaks = rows.filter(row => row.verdict === 'security-leak');
    const rawLeaks = rows.filter(row => Array.isArray(row.rawLeaks) && (row.rawLeaks as unknown[]).length > 0);
    expect(securityLeaks.map(row => row.id), 'security-leak probes').toEqual([]);
    expect(rawLeaks.map(row => row.id), 'sanitizeSvg:false leaks').toEqual([]);

    // Gap thresholds: a support regression must fail the scan.
    const tally = tallyVerdicts(rows);
    const renders = tally.get('renders') ?? 0;
    const throws = tally.get('throws') ?? 0;
    const silentDrops = tally.get('silent-drop') ?? 0;
    const literalMarkup = tally.get('literal-markup') ?? 0;
    expect(renders, 'renders fell below the locked-in floor').toBeGreaterThanOrEqual(RENDERS_FLOOR);
    expect(throws, 'throws rose above the locked-in ceiling').toBeLessThanOrEqual(THROWS_CEILING);
    expect(silentDrops, 'silent-drop rose above the locked-in ceiling').toBeLessThanOrEqual(SILENT_DROP_CEILING);
    expect(literalMarkup, 'literal-markup rose above the locked-in ceiling').toBeLessThanOrEqual(LITERAL_MARKUP_CEILING);

    // Coverage sanity: at least one probe per documented family.
    const coveredFamilies = new Set(rows.map(row => row.family));
    expect(coveredFamilies.size).toBe(FAMILIES.length);

    // eslint-disable-next-line no-console
    console.log(`\nAI-syntax scan: ${rows.length} probes -> ${REPORT_PATH} (renders=${renders}, throws=${throws}, silent-drop=${silentDrops}, literal-markup=${literalMarkup})`);
  }, 120_000);
});
