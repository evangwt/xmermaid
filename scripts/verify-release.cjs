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
    'Usage: node scripts/verify-release.cjs [--json] [--output <path>] [--matrix-file <path>]',
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
  if (exitCode === 0) return `Command ${entry.id} passed`;
  const combined = `${result.stderr || ''}\n${result.stdout || ''}`
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const tail = combined.slice(-3).join(' | ');
  return tail
    ? `Command ${entry.id} failed with exit code ${exitCode}: ${tail}`
    : `Command ${entry.id} failed with exit code ${exitCode}`;
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
  const matrix = loadMatrix(args.matrixFile);
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
