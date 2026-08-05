#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

const DEFAULT_MATRIX = [
  {
    id: 'wasm-js-build',
    command: 'npm run build',
    required_for_release: true,
    failure_owner: 'toolchain',
  },
  {
    id: 'consumer-pack-install',
    command: 'npm run --silent smoke:consumer -- --json',
    required_for_release: true,
    failure_owner: 'packaging',
  },
  {
    id: 'docs-support-matrix-sync',
    command: 'node scripts/verify-release.cjs --check-docs',
    required_for_release: true,
    failure_owner: 'docs',
  },
  {
    id: 'js-unit',
    command: 'npm test',
    required_for_release: true,
    failure_owner: 'code',
  },
  {
    id: 'ts-typecheck',
    command: 'npm run typecheck',
    required_for_release: true,
    failure_owner: 'code',
  },
  {
    id: 'rust-workspace',
    command: 'cargo test',
    required_for_release: true,
    failure_owner: 'code',
  },
  {
    id: 'diff-whitespace',
    command: 'git diff --check -- HEAD',
    required_for_release: true,
    failure_owner: 'code',
  },
];

function parseArgs(argv) {
  const args = {
    matrixFile: null,
    json: false,
    output: null,
    listMatrix: false,
    checkDocs: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--matrix-file') {
      args.matrixFile = argv[i + 1];
      i += 1;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--output') {
      args.output = argv[i + 1];
      i += 1;
    } else if (arg === '--list-matrix') {
      args.listMatrix = true;
    } else if (arg === '--check-docs') {
      args.checkDocs = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage: node scripts/verify-release.cjs [--json] [--output <path>] [--matrix-file <path>] [--list-matrix] [--check-docs]',
    '',
    'Runs the xmermaid release verification matrix and returns non-zero if any required command fails.',
  ].join('\n'));
}

function loadMatrix(matrixFile) {
  if (!matrixFile) return DEFAULT_MATRIX;
  const parsed = JSON.parse(readFileSync(matrixFile, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('--matrix-file must contain a JSON array');
  }
  return parsed;
}

function currentGitCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return 'unknown';
  return result.stdout.trim() || 'unknown';
}

function runCommand(entry, checkedAt, gitCommit) {
  const result = spawnSync(entry.command, {
    shell: true,
    encoding: 'utf8',
    env: process.env,
  });
  const exitCode = result.status ?? 1;
  const passed = exitCode === 0;

  return {
    checked_at: checkedAt,
    git_commit: gitCommit,
    command_id: entry.id,
    command: entry.command,
    exit_code: exitCode,
    passed,
    summary: summarizeCommand(entry, exitCode, result),
    blocking_reason: passed || !entry.required_for_release
      ? null
      : `Required command ${entry.id} failed with exit code ${exitCode}`,
  };
}

function summarizeCommand(entry, exitCode, result) {
  const jsonSummary = parseJsonSummary(result.stdout);
  if (exitCode === 0) {
    return jsonSummary || `Command ${entry.id} passed`;
  }
  const combined = `${result.stderr || ''}\n${result.stdout || ''}`
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const tail = combined.slice(-3).join(' | ');
  return tail
    ? `Command ${entry.id} failed with exit code ${exitCode}: ${tail}`
    : `Command ${entry.id} failed with exit code ${exitCode}`;
}

function parseJsonSummary(stdout) {
  const text = stdout.trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed.summary || null;
  } catch (_error) {
    return null;
  }
}

function checkDocs() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const readme = readFileSync('README.md', 'utf8');
  const chineseReadme = readFileSync('README.zh-CN.md', 'utf8');
  const checklist = readFileSync('docs/production-release-checklist.md', 'utf8');
  const matrixIds = DEFAULT_MATRIX.map(entry => entry.id);
  const editorExport = packageJson.exports?.['./editor'];
  const requirements = [
    {
      label: 'package description mentions flowchart',
      passed: /flowchart/i.test(packageJson.description || ''),
    },
    {
      label: 'package description mentions partial',
      passed: /partial/i.test(packageJson.description || ''),
    },
    {
      label: 'package exports live editor subpath',
      passed: Boolean(editorExport?.import)
        && Boolean(editorExport?.require)
        && editorExport?.types === './dist/editor/index.d.ts',
    },
    {
      label: 'package files explicitly include English, Chinese, and license docs',
      passed: Array.isArray(packageJson.files)
        && packageJson.files.includes('README.md')
        && packageJson.files.includes('README.zh-CN.md')
        && packageJson.files.includes('LICENSE'),
    },
    {
      label: 'README mentions partial Mermaid support',
      passed: /partial\s+mermaid\s+support/i.test(readme),
    },
    {
      label: 'README documents current diagram family boundaries',
      passed: [
        'sequenceDiagram',
        'classDiagram',
        'stateDiagram',
        'erDiagram',
        'gantt',
        'pie',
        'mindmap',
      ].every(term => readme.includes(term)),
    },
    {
      label: 'README documents diagnostics',
      passed: /diagnostics/i.test(readme)
        && /unsupported_syntax/.test(readme)
        && /unsupported_diagram_type/.test(readme),
    },
    {
      label: 'README documents special label limitations',
      passed: /entity[- ]code/i.test(readme)
        && /FontAwesome/i.test(readme),
    },
    {
      label: 'README documents quoted label limitation',
      passed: /quoted labels/i.test(readme),
    },
    {
      label: 'README documents safe Flowchart class style boundary',
      passed: /classDef <name>/i.test(readme)
        && /three- or six-digit hexadecimal values/i.test(readme)
        && /Visual editing is read-only/i.test(readme),
    },
    {
      label: 'Chinese README documents safe Flowchart class style boundary',
      passed: /classDef <名称>/.test(chineseReadme)
        && /三位或六位十六进制颜色/.test(chineseReadme)
        && /可视化编辑.*只读/.test(chineseReadme),
    },
    {
      label: 'README documents subgraph edge limitation',
      passed: /edges?\s+to\s+subgraph/i.test(readme),
    },
    {
      label: 'README documents hyphenated node id limitation',
      passed: /hyphenated node ids/i.test(readme),
    },
    {
      label: 'README documents strict security policy',
      passed: /security policy/i.test(readme)
        && /strict/i.test(readme)
        && /sanitizeSvg/.test(readme)
        && /security_blocked_url/.test(readme)
        && /security_blocked_html/.test(readme)
        && /security_blocked_click/.test(readme),
    },
    {
      label: 'README documents editor subpath and custom WASM fetch',
      passed: /@evangwt\/xmermaid\/editor/.test(readme)
        && /WasmInitOptions|wasm/i.test(readme)
        && /fetch/.test(readme)
        && /first initializes WASM|first render|initialized, later renders reuse/i.test(readme),
    },
    {
      label: 'README documents consumer smoke and Chrome configuration',
      passed: /consumer smoke/i.test(readme)
        && /Chrome|Chromium/.test(readme)
        && /CHROME_BIN/.test(readme)
        && /default bundle-relative WASM asset resolution/.test(readme),
    },
    {
      label: 'README documents live editor workflow smoke',
      passed: /live editor workflow/i.test(readme)
        && /visual rename/i.test(readme)
        && /share hash/i.test(readme)
        && /SVG export/i.test(readme)
        && /through `@evangwt\/xmermaid\/editor`/.test(readme),
    },
    {
      label: 'README documents live editor direction and safety smoke',
      passed: /preview-only direction/i.test(readme)
        && /source direction/i.test(readme)
        && /unsupported visual/i.test(readme),
    },
    {
      label: 'release checklist documents package metadata and editor subpath',
      passed: /LICENSE/.test(checklist)
        && /@evangwt\/xmermaid\/editor/.test(checklist)
        && /default bundle-relative WASM/.test(checklist),
    },
    ...matrixIds.map(id => ({
      label: `release checklist mentions ${id}`,
      passed: checklist.includes(id),
    })),
  ];

  const missing = requirements
    .filter(requirement => !requirement.passed)
    .map(requirement => requirement.label);

  return {
    passed: missing.length === 0,
    checked_at: new Date().toISOString(),
    missing,
    summary: missing.length === 0
      ? 'docs support matrix sync passed'
      : `docs support matrix sync failed: ${missing.join('; ')}`,
  };
}

function printHuman(runRecord) {
  console.log(`Release verification for ${runRecord.git_commit}`);
  for (const result of runRecord.results) {
    const marker = result.passed ? 'PASS' : 'FAIL';
    console.log(`[${marker}] ${result.command_id}: ${result.command}`);
    if (!result.passed) {
      console.log(`  ${result.summary}`);
    }
  }
  console.log(runRecord.passed ? 'Release verification passed.' : 'Release verification failed.');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.checkDocs) {
    const result = checkDocs();
    if (args.output) {
      writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
    }
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.passed) {
      console.log(result.summary);
    } else {
      console.error(result.summary);
    }
    process.exit(result.passed ? 0 : 1);
  }

  const matrix = loadMatrix(args.matrixFile);
  if (args.listMatrix) {
    const json = JSON.stringify(matrix, null, 2);
    if (args.output) {
      writeFileSync(args.output, `${json}\n`);
    }
    if (args.json) {
      console.log(json);
    } else {
      for (const entry of matrix) {
        console.log(`${entry.id}: ${entry.command}`);
      }
    }
    process.exit(0);
  }

  const checkedAt = new Date().toISOString();
  const gitCommit = currentGitCommit();
  const results = matrix.map(entry => runCommand(entry, checkedAt, gitCommit));
  const passed = results.every(result => result.passed || !matrix.find(entry => entry.id === result.command_id)?.required_for_release);
  const runRecord = {
    checked_at: checkedAt,
    git_commit: gitCommit,
    passed,
    results,
  };

  const json = JSON.stringify(runRecord, null, 2);
  if (args.output) {
    writeFileSync(args.output, `${json}\n`);
  }
  if (args.json) {
    console.log(json);
  } else {
    printHuman(runRecord);
  }

  process.exit(passed ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(`[xmermaid verify-release diagnostic] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
