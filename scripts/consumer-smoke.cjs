#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const { createServer } = require('node:http');
const {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const {
  basename,
  dirname,
  isAbsolute,
  join,
  resolve,
  sep,
} = require('node:path');
const WebSocket = require('ws');

const REQUIRED_PACK_FILES = [
  'dist/index.d.ts',
  'dist/support.d.ts',
  'dist/xmermaid.esm.js',
  'dist/xmermaid.cjs',
  'dist/xmermaid_wasm_bg.wasm',
  'README.md',
  'package.json',
];

function parseArgs(argv) {
  const args = {
    json: false,
    keepTemp: false,
    chromeBin: null,
    timeoutMs: 15000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--keep-temp') {
      args.keepTemp = true;
    } else if (arg === '--chrome-bin') {
      args.chromeBin = argv[i + 1];
      i += 1;
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/consumer-smoke.cjs [--json] [--keep-temp] [--chrome-bin <path>] [--timeout-ms <ms>]',
    '',
    'Packs xmermaid, installs the tarball into a temporary consumer project, typechecks the package,',
    'imports the installed ESM entry, requires the installed CommonJS entry, and renders a minimal flowchart in headless Chrome.',
  ].join('\n'));
}

function normalizePackPath(file) {
  const path = typeof file === 'string' ? file : file.path;
  return path.replace(/^package\//, '');
}

function validatePackFiles(files) {
  const normalized = new Set(files.map(normalizePackPath));
  const missing = REQUIRED_PACK_FILES.filter(file => !normalized.has(file));
  if (missing.length > 0) {
    throw new Error(`Packed package is missing required file(s): ${missing.join(', ')}`);
  }
}

function resolveChromeExecutable(env = process.env, candidates = defaultChromeCandidates()) {
  if (env.CHROME_BIN) {
    if (existsSync(env.CHROME_BIN)) return env.CHROME_BIN;
    throw new Error(`CHROME_BIN points to a missing Chrome executable: ${env.CHROME_BIN}`);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isAbsolute(candidate) && existsSync(candidate)) return candidate;
    if (!isAbsolute(candidate)) {
      const result = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (result.status === 0 && result.stdout.trim()) {
        return result.stdout.trim();
      }
    }
  }

  throw new Error('Chrome executable not found. Install Chrome/Chromium or set CHROME_BIN; jsdom is not accepted for browser smoke.');
}

function defaultChromeCandidates() {
  return [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'google-chrome',
    'chromium',
    'chromium-browser',
    'chrome',
    'msedge',
  ];
}

function runChecked(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const output = summarizeOutput(result);
    throw new Error(`${options.label} failed with exit code ${result.status ?? 1}${output ? `: ${output}` : ''}`);
  }

  return result;
}

function summarizeOutput(result) {
  return `${result.stderr || ''}\n${result.stdout || ''}`
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-6)
    .join(' | ');
}

function packProject(repoRoot, tempRoot) {
  const packDir = join(tempRoot, 'pack');
  mkdirSync(packDir, { recursive: true });
  const result = runChecked('npm', ['pack', '--json', '--pack-destination', packDir], {
    cwd: repoRoot,
    label: 'npm pack',
  });
  const parsed = JSON.parse(result.stdout);
  const packRecord = parsed[0];
  if (!packRecord?.filename) {
    throw new Error('npm pack did not return a tarball filename');
  }

  validatePackFiles(packRecord.files || []);
  const tarballPath = join(packDir, basename(packRecord.filename));
  if (!existsSync(tarballPath)) {
    throw new Error(`npm pack reported ${packRecord.filename}, but the tarball was not found in ${packDir}`);
  }

  return {
    tarballPath,
    packRecord,
    sizeBytes: statSync(tarballPath).size,
  };
}

function writeConsumerProject(consumerDir, tarballPath) {
  mkdirSync(join(consumerDir, 'src'), { recursive: true });
  writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      xmermaid: `file:${tarballPath}`,
    },
  }, null, 2));
  writeFileSync(join(consumerDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022', 'DOM'],
      strict: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ['src/**/*.ts'],
  }, null, 2));
  writeFileSync(join(consumerDir, 'src', 'typecheck.ts'), [
    "import { DEFAULT_SECURITY_POLICY, XMermaid, analyzeSupport, detectUnsupportedFeatures, getSupportMatrix, type RenderOptions, type RenderResult, type SecurityLevel, type SecurityPolicy, type SourceRange, type SupportMatrix, type SupportSourceRange, type UnsupportedFeature, type WasmInitOptions, type XMermaidDiagnostic, type XMermaidDiagnosticCode, type XMermaidOptions } from 'xmermaid';",
    '',
    'const matrix: SupportMatrix = getSupportMatrix();',
    "const report = analyzeSupport('graph TD\\n  A-->B');",
    "const unsupported: UnsupportedFeature[] = detectUnsupportedFeatures('sequenceDiagram\\n  A->>B: Hi');",
    'const unsupportedRange: SupportSourceRange | null = unsupported[0]?.range ?? null;',
    "const diagnosticCode: XMermaidDiagnosticCode = 'unsupported_syntax';",
    'const diagnosticRange: SourceRange | null = unsupportedRange;',
    'const diagnostics: XMermaidDiagnostic[] = [{ code: diagnosticCode, message: \'unsupported\', severity: \'warning\', range: diagnosticRange, featureId: unsupported[0]?.id }];',
    "const container = document.createElement('div');",
    'const options: XMermaidOptions = { container };',
    "const securityLevel: SecurityLevel = 'loose';",
    'const securityPolicy: SecurityPolicy = { ...DEFAULT_SECURITY_POLICY, securityLevel, allowClickCallbacks: true, allowHtmlLabels: true };',
    'const renderOptions: RenderOptions = { layoutConfig: { direction: \'LR\' }, securityPolicy };',
    'const wasmOptions: WasmInitOptions = { wasmUrl: new URL(\'./xmermaid_wasm_bg.wasm\', import.meta.url) };',
    'const renderer = new XMermaid(options);',
    "void renderer.render('graph TD\\n  A-->B');",
    "const svgResult: Promise<RenderResult> = renderer.renderToSVGElement('graph TD\\n  A-->B', renderOptions);",
    "const svgString: Promise<string> = renderer.renderToSVGString('graph TD\\n  A-->B', { wasm: wasmOptions });",
    'void svgResult;',
    'void svgString;',
    'void unsupportedRange;',
    'void diagnostics;',
    'void securityPolicy;',
    "if (matrix.entries.length === 0 || report.diagramType !== 'flowchart') {",
    "  throw new Error('xmermaid support API is not available');",
    '}',
  ].join('\n'));
  writeFileSync(join(consumerDir, 'node-import.mjs'), [
    "import { analyzeSupport, getSupportMatrix } from 'xmermaid';",
    '',
    'const matrix = getSupportMatrix();',
    "const report = analyzeSupport('sequenceDiagram\\n  A->>B: Hi');",
    "if (!matrix.entries.some(entry => entry.diagramType === 'flowchart')) {",
    "  throw new Error('flowchart support entry missing');",
    '}',
    "if (report.diagramType !== 'sequence' || report.status !== 'unsupported') {",
    "  throw new Error('support analyzer import smoke failed');",
    '}',
  ].join('\n'));
  writeFileSync(join(consumerDir, 'cjs-require.cjs'), [
    "const { XMermaid, analyzeSupport } = require('xmermaid');",
    '',
    "const report = analyzeSupport('graph TD\\n  A-->B');",
    "if (typeof XMermaid !== 'function' || report.diagramType !== 'flowchart') {",
    "  throw new Error('CommonJS package entry is unavailable');",
    '}',
  ].join('\n'));
}

function installConsumer(consumerDir) {
  runChecked('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: consumerDir,
    label: 'consumer npm install',
  });
}

function runConsumerTypecheck(repoRoot, consumerDir) {
  const tscBin = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  runChecked(process.execPath, [tscBin, '--noEmit', '--project', 'tsconfig.json'], {
    cwd: consumerDir,
    label: 'consumer TypeScript typecheck',
  });
}

function runNodeImport(consumerDir) {
  runChecked(process.execPath, ['node-import.mjs'], {
    cwd: consumerDir,
    label: 'consumer Node import',
  });
}

function runCommonJsRequire(consumerDir) {
  runChecked(process.execPath, ['cjs-require.cjs'], {
    cwd: consumerDir,
    label: 'consumer CommonJS require',
  });
}

function writeBrowserSmokePage(consumerDir) {
  writeFileSync(join(consumerDir, 'smoke.html'), [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<title>xmermaid consumer smoke</title>',
    '<div id="container"></div>',
    '<div id="editor"></div>',
    '<script type="importmap">',
    '{"imports":{"xmermaid":"/node_modules/xmermaid/dist/xmermaid.esm.js"}}',
    '</script>',
    '<script type="module">',
    "import { XMermaid, XMermaidLiveEditor } from 'xmermaid';",
    "window.__xmermaidSmoke = { done: false, ok: false };",
    'const waitFor = async (predicate, label) => {',
    '  const startedAt = performance.now();',
    '  while (performance.now() - startedAt < 5000) {',
    '    const value = predicate();',
    '    if (value) return value;',
    '    await new Promise(resolve => setTimeout(resolve, 50));',
    '  }',
    "  throw new Error(`Timed out waiting for ${label}`);",
    '};',
    'try {',
    "  const container = document.getElementById('container');",
    "  const wasmUrl = new URL('/node_modules/xmermaid/dist/xmermaid_wasm_bg.wasm', window.location.href);",
    '  const renderer = new XMermaid({ container });',
    "  await renderer.renderToSVGElement('graph TD\\n  A-->B', {",
    '    wasm: { wasmUrl }',
    '  });',
    "  await renderer.render('graph TD\\n  A-->B');",
    "  const svg = container.querySelector('svg');",
    "  const editorRoot = document.getElementById('editor');",
    '  const editor = new XMermaidLiveEditor({',
    '    root: editorRoot,',
    "    initialText: '# Smoke\\n\\n```mermaid\\nflowchart TD\\n  LiveEditor[Live Editor] --> Preview[Preview]\\n```\\n\\n```mermaid\\nflowchart LR\\n  Second[Second] --> Done[Done]\\n```',",
    '    xmermaidOptions: { wasm: { wasmUrl } }',
    '  });',
    '  await editor.mount();',
    "  const liveEditorSvg = await waitFor(() => editorRoot.querySelector('[data-xm-preview] svg'), 'initial live editor preview');",
    '  const liveEditorWorkflow = {};',
    "  const diagramItems = editorRoot.querySelectorAll('[data-xm-diagram-item]');",
    '  liveEditorWorkflow.multiDiagramList = diagramItems.length === 2;',
    '  diagramItems[1].click();',
    "  const selectedSource = await waitFor(() => editorRoot.querySelector('[data-xm-selected-source]'), 'selected diagram source');",
    "  await waitFor(() => selectedSource.value.includes('Second[Second]'), 'diagram switch source');",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-preview]')?.textContent.includes('Second'), 'diagram switch preview');",
    '  liveEditorWorkflow.diagramSwitchApplied = true;',
    "  await waitFor(() => editorRoot.querySelector('[data-xm-visual-toggle]'), 'visual editor toggle').then(toggle => toggle.click());",
    "  const visualNodeId = await waitFor(() => editorRoot.querySelector('[data-xm-visual-node-id]'), 'visual node id input');",
    "  const visualNodeLabel = await waitFor(() => editorRoot.querySelector('[data-xm-visual-node-label]'), 'visual node label input');",
    "  visualNodeId.value = 'Second';",
    "  visualNodeLabel.value = 'Renamed';",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-visual-rename-node]'), 'visual rename button').then(button => button.click());",
    "  await waitFor(() => selectedSource.value.includes('Second[Renamed]'), 'visual rename source');",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-document-input]')?.value.includes('Second[Renamed]'), 'visual rename document');",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-preview]')?.textContent.includes('Renamed'), 'visual rename preview');",
    '  liveEditorWorkflow.visualRenameApplied = true;',
    "  const directionSelect = await waitFor(() => editorRoot.querySelector('[data-xm-layout-direction]'), 'layout direction select');",
    "  const applySourceDirection = await waitFor(() => editorRoot.querySelector('[data-xm-apply-source-direction]'), 'apply source direction button');",
    '  const sourceAfterRename = selectedSource.value;',
    "  directionSelect.value = 'TD';",
    "  directionSelect.dispatchEvent(new Event('change', { bubbles: true }));",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-preview] svg'), 'preview-only direction render');",
    '  liveEditorWorkflow.previewDirectionPreservesSource = selectedSource.value === sourceAfterRename;',
    '  applySourceDirection.click();',
    "  await waitFor(() => selectedSource.value.startsWith('flowchart TD'), 'source direction applied');",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-document-input]')?.value.includes('flowchart TD'), 'source direction document');",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-preview]')?.textContent.includes('Renamed'), 'source direction preview');",
    "  liveEditorWorkflow.sourceDirectionApplied = selectedSource.value.startsWith('flowchart TD') && editorRoot.querySelector('[data-xm-document-input]')?.value.includes('Second[Renamed]');",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-share-link]'), 'share link button').then(button => button.click());",
    "  liveEditorWorkflow.shareHashNamespaced = window.location.hash.startsWith('#xm=') && decodeURIComponent(window.location.hash).includes('Second[Renamed]');",
    '  const exported = new Promise(resolve => {',
    "    editorRoot.addEventListener('xmermaid:exported', event => resolve(event.detail), { once: true });",
    '  });',
    "  await waitFor(() => editorRoot.querySelector('[data-xm-export-svg]'), 'SVG export button').then(button => button.click());",
    '  const exportDetail = await exported;',
    "  const downloadLink = editorRoot.querySelector('[data-xm-download-link]');",
    "  liveEditorWorkflow.svgExportReady = exportDetail.format === 'svg' && Boolean(downloadLink?.href) && downloadLink.download.endsWith('.svg');",
    "  const unsupportedSource = `${selectedSource.value}\\n  classDef hot fill:#fff`;",
    '  selectedSource.value = unsupportedSource;',
    "  selectedSource.dispatchEvent(new Event('input', { bubbles: true }));",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-document-input]')?.value.includes('classDef hot'), 'unsupported source committed');",
    "  visualNodeLabel.value = 'Blocked';",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-visual-rename-node]'), 'blocked visual rename button').then(button => button.click());",
    "  await waitFor(() => editorRoot.querySelector('[data-xm-diagnostic-code=\"visual_unsupported_syntax\"]'), 'unsupported visual edit diagnostic');",
    "  liveEditorWorkflow.unsupportedVisualEditBlocked = selectedSource.value === unsupportedSource && !selectedSource.value.includes('Blocked');",
    '  const liveEditorWorkflowOk = Object.values(liveEditorWorkflow).every(Boolean);',
    '  window.__xmermaidSmoke = {',
    '    done: true,',
    '    ok: Boolean(svg && liveEditorSvg && liveEditorWorkflowOk),',
    '    svgCount: container.querySelectorAll("svg").length,',
    '    liveEditorSvgCount: editorRoot.querySelectorAll("[data-xm-preview] svg").length,',
    '    liveEditorWorkflow,',
    '    text: container.textContent || ""',
    '  };',
    '} catch (error) {',
    '  window.__xmermaidSmoke = {',
    '    done: true,',
    '    ok: false,',
    '    error: error instanceof Error ? error.message : String(error),',
    '    stack: error instanceof Error ? error.stack : null',
    '  };',
    '}',
    '</script>',
  ].join('\n'));
}

async function runBrowserSmoke(consumerDir, chromeExecutable, timeoutMs) {
  writeBrowserSmokePage(consumerDir);
  const server = await startStaticServer(consumerDir);
  const profileDir = mkdtempSync(join(tmpdir(), 'xmermaid-chrome-profile-'));
  let chrome = null;

  try {
    const smokeUrl = `http://127.0.0.1:${server.port}/smoke.html`;
    const launched = await launchChrome(chromeExecutable, profileDir, timeoutMs);
    chrome = launched.chrome;
    const startedAt = Date.now();
    const smoke = await driveChromeSmoke(launched.wsUrl, smokeUrl, timeoutMs);
    const durationMs = Date.now() - startedAt;
    if (!smoke.ok) {
      throw new Error(`browser render smoke failed${smoke.error ? `: ${smoke.error}` : ''}`);
    }
    return { durationMs, smoke };
  } finally {
    if (chrome) chrome.kill();
    await new Promise(resolveClose => server.server.close(resolveClose));
    rmSync(profileDir, { recursive: true, force: true });
  }
}

function startStaticServer(rootDir) {
  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const relative = requestUrl.pathname === '/'
        ? 'smoke.html'
        : decodeURIComponent(requestUrl.pathname.slice(1));
      const fullPath = resolve(rootDir, relative);
      const rootPath = resolve(rootDir);

      if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      response.writeHead(200, { 'Content-Type': contentType(fullPath) });
      response.end(readFileSync(fullPath));
    } catch (error) {
      response.writeHead(500);
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  return new Promise((resolveStart, rejectStart) => {
    server.on('error', rejectStart);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveStart({ server, port: address.port });
    });
  });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function launchChrome(chromeExecutable, profileDir, timeoutMs) {
  return new Promise((resolveLaunch, rejectLaunch) => {
    const chrome = spawn(chromeExecutable, [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    const timer = setTimeout(() => {
      chrome.kill();
      rejectLaunch(new Error(`Chrome did not expose a DevTools endpoint within ${timeoutMs}ms${stderr ? `: ${stderr.trim()}` : ''}`));
    }, timeoutMs);

    chrome.on('error', error => {
      clearTimeout(timer);
      rejectLaunch(error);
    });
    chrome.on('exit', code => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        rejectLaunch(new Error(`Chrome exited before browser smoke completed with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
      }
    });
    chrome.stderr.on('data', chunk => {
      stderr += String(chunk);
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolveLaunch({ chrome, wsUrl: match[1] });
      }
    });
  });
}

async function driveChromeSmoke(browserWsUrl, smokeUrl, timeoutMs) {
  const client = await connectCdp(browserWsUrl);
  try {
    const target = await client.send('Target.createTarget', { url: 'about:blank' });
    const attached = await client.send('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true,
    });
    const sessionId = attached.sessionId;
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    await client.send('Page.navigate', { url: smokeUrl }, sessionId);

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const evaluated = await client.send('Runtime.evaluate', {
        expression: 'window.__xmermaidSmoke || null',
        returnByValue: true,
        awaitPromise: false,
      }, sessionId);
      const value = evaluated.result?.value;
      if (value?.done) return value;
      await delay(100);
    }
    throw new Error(`browser smoke timed out after ${timeoutMs}ms`);
  } finally {
    client.close();
  }
}

function connectCdp(wsUrl) {
  return new Promise((resolveConnect, rejectConnect) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();

    ws.on('open', () => {
      resolveConnect({
        send(method, params = {}, sessionId) {
          const id = nextId++;
          const payload = { id, method, params };
          if (sessionId) payload.sessionId = sessionId;
          ws.send(JSON.stringify(payload));
          return new Promise((resolveSend, rejectSend) => {
            pending.set(id, { resolve: resolveSend, reject: rejectSend, method });
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.on('message', data => {
      const message = JSON.parse(String(data));
      if (!message.id || !pending.has(message.id)) return;
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(`${request.method} failed: ${message.error.message}`));
      } else {
        request.resolve(message.result || {});
      }
    });
    ws.on('error', error => {
      for (const request of pending.values()) request.reject(error);
      pending.clear();
      rejectConnect(error);
    });
  });
}

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

function makeCheck(id, summary) {
  return { id, passed: true, summary };
}

async function runSmoke(args) {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const tempRoot = mkdtempSync(join(tmpdir(), 'xmermaid-consumer-smoke-'));
  const checks = [];

  try {
    const packed = packProject(repoRoot, tempRoot);
    checks.push(makeCheck('npm-pack', `Packed ${basename(packed.tarballPath)} (${packed.sizeBytes} bytes)`));
    checks.push(makeCheck('pack-files', 'Packed package contains runtime bundles, declarations, wasm asset, README, and package.json'));

    const consumerDir = join(tempRoot, 'consumer');
    writeConsumerProject(consumerDir, packed.tarballPath);
    installConsumer(consumerDir);
    checks.push(makeCheck('consumer-install', 'Temporary consumer installed the packed tarball'));

    runConsumerTypecheck(repoRoot, consumerDir);
    checks.push(makeCheck('typecheck', 'Temporary consumer TypeScript project resolved xmermaid types'));

    runNodeImport(consumerDir);
    checks.push(makeCheck('node-import', 'Temporary consumer imported the installed package ESM entry'));

    runCommonJsRequire(consumerDir);
    checks.push(makeCheck('cjs-require', 'Temporary consumer required the installed package CommonJS entry'));

    const chromeExecutable = args.chromeBin || resolveChromeExecutable(process.env);
    const browser = await runBrowserSmoke(consumerDir, chromeExecutable, args.timeoutMs);
    checks.push(makeCheck('browser-render', `Headless Chrome rendered an SVG in ${browser.durationMs}ms`));
    checks.push(makeCheck('live-editor-render', `Headless Chrome mounted the live editor with ${browser.smoke.liveEditorSvgCount} preview SVG(s)`));
    checks.push(makeCheck('live-editor-workflow', 'Headless Chrome switched diagrams, applied visual edits, verified direction controls, blocked unsupported visual edits, shared state, and prepared SVG export'));

    const record = {
      passed: true,
      package_name: packageJson.name,
      package_version: packageJson.version,
      package_size_bytes: packed.sizeBytes,
      browser_render_duration_ms: browser.durationMs,
      temp_root: args.keepTemp ? tempRoot : null,
      checks,
      summary: `consumer smoke passed: package_size_bytes=${packed.sizeBytes}, browser_render_duration_ms=${browser.durationMs}`,
    };

    if (!args.keepTemp) rmSync(tempRoot, { recursive: true, force: true });
    return record;
  } catch (error) {
    if (!args.keepTemp) rmSync(tempRoot, { recursive: true, force: true });
    error.checks = checks;
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const record = await runSmoke(args);
  if (args.json) {
    console.log(JSON.stringify(record, null, 2));
  } else {
    console.log(record.summary);
    for (const check of record.checks) {
      console.log(`[PASS] ${check.id}: ${check.summary}`);
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[xmermaid consumer-smoke diagnostic] ${error instanceof Error ? error.message : String(error)}`);
    if (Array.isArray(error.checks)) {
      for (const check of error.checks) {
        console.error(`[xmermaid consumer-smoke diagnostic] completed ${check.id}: ${check.summary}`);
      }
    }
    process.exit(1);
  });
} else {
  module.exports = {
    resolveChromeExecutable,
    validatePackFiles,
    writeBrowserSmokePage,
  };
}
