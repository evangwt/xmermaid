import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('verify-release script', () => {
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
});
