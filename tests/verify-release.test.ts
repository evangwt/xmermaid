import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('verify-release script', () => {
  it('lists the default release matrix with the packed consumer gate after build', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/verify-release.cjs', '--list-matrix', '--json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    const matrix = JSON.parse(result.stdout);
    const commandIds = matrix.map((entry: { id: string }) => entry.id);

    expect(commandIds).toContain('consumer-pack-install');
    expect(commandIds).toContain('docs-support-matrix-sync');
    expect(commandIds.indexOf('consumer-pack-install')).toBeGreaterThan(commandIds.indexOf('wasm-js-build'));
    expect(commandIds.indexOf('docs-support-matrix-sync')).toBeGreaterThan(commandIds.indexOf('consumer-pack-install'));
    expect(matrix.find((entry: { id: string }) => entry.id === 'consumer-pack-install')).toMatchObject({
      command: 'npm run --silent smoke:consumer -- --json',
      required_for_release: true,
      failure_owner: 'packaging',
    });
    expect(matrix.find((entry: { id: string }) => entry.id === 'docs-support-matrix-sync')).toMatchObject({
      command: 'node scripts/verify-release.cjs --check-docs',
      required_for_release: true,
      failure_owner: 'docs',
    });
  });

  it('runs every matrix command and returns JSON records for failures', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'xmermaid-verify-release-'));
    const touchedPath = join(tempRoot, 'commands.txt');
    const matrixPath = join(tempRoot, 'matrix.json');

    writeFileSync(matrixPath, JSON.stringify([
      {
        id: 'fake-pass',
        command: `${process.execPath} -e "require('fs').appendFileSync(process.argv[1], 'pass\\n')" ${JSON.stringify(touchedPath)}`,
        required_for_release: true,
        failure_owner: 'code',
      },
      {
        id: 'fake-fail',
        command: `${process.execPath} -e "require('fs').appendFileSync(process.argv[1], 'fail\\n'); process.exit(7)" ${JSON.stringify(touchedPath)}`,
        required_for_release: true,
        failure_owner: 'toolchain',
      },
    ]));

    const result = spawnSync(
      process.execPath,
      ['scripts/verify-release.cjs', '--matrix-file', matrixPath, '--json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(1);
    const runRecord = JSON.parse(result.stdout);
    expect(runRecord.results).toHaveLength(2);
    expect(runRecord.results.map((record: { command_id: string }) => record.command_id))
      .toEqual(['fake-pass', 'fake-fail']);
    expect(runRecord.results[0]).toMatchObject({
      exit_code: 0,
      passed: true,
      blocking_reason: null,
    });
    expect(runRecord.results[1]).toMatchObject({
      exit_code: 7,
      passed: false,
      blocking_reason: 'Required command fake-fail failed with exit code 7',
    });
    expect(readFileSync(touchedPath, 'utf8')).toBe('pass\nfail\n');
  });

  it('passes the docs support matrix sync check for current production docs', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/verify-release.cjs', '--check-docs', '--json'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    const record = JSON.parse(result.stdout);
    expect(record.passed).toBe(true);
    expect(record.summary).toMatch(/docs support matrix sync passed/i);
  });

  it('fails the docs support matrix sync check when critical production claims are missing', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'xmermaid-docs-check-'));
    mkdirSync(join(tempRoot, 'docs'));
    copyFileSync('package.json', join(tempRoot, 'package.json'));
    copyFileSync('scripts/verify-release.cjs', join(tempRoot, 'verify-release.cjs'));
    writeFileSync(join(tempRoot, 'README.md'), '# xmermaid\n\nFull Mermaid compatibility.\n');
    writeFileSync(join(tempRoot, 'docs', 'production-release-checklist.md'), '# Release\n\nnpm test\n');

    const result = spawnSync(
      process.execPath,
      ['verify-release.cjs', '--check-docs', '--json'],
      {
        cwd: tempRoot,
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(1);
    const record = JSON.parse(result.stdout);
    expect(record.passed).toBe(false);
    expect(record.missing).toContain('README mentions partial Mermaid support');
    expect(record.missing).toContain('README documents special label limitations');
    expect(record.missing).toContain('README documents subgraph edge limitation');
    expect(record.missing).toContain('README documents live editor workflow smoke');
    expect(record.missing).toContain('release checklist mentions consumer-pack-install');
  });
});
