import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const policyPath = 'docs/evidence-governance.md';

function readGitignore(): string {
  return readFileSync('.gitignore', 'utf8');
}

function readPolicy(): string {
  expect(existsSync(policyPath)).toBe(true);
  return readFileSync(policyPath, 'utf8');
}

describe('evidence governance policy', () => {
  it('documents every evidence asset class used by the roadmap', () => {
    const policy = readPolicy();

    for (const assetClass of [
      'repo-spec',
      'diagnostic-tool',
      'runtime-cache',
      'visual-evidence',
      'private-log',
    ]) {
      expect(policy).toContain(assetClass);
    }

    for (const repoSpecPath of [
      '.codestable/roadmap/**',
      '.codestable/features/**',
      '.codestable/audits/**',
    ]) {
      expect(policy).toContain(repoSpecPath);
    }
  });

  it('keeps runtime caches, private logs, and temporary diagnostics out of git', () => {
    const gitignore = readGitignore();

    expect(gitignore).toMatch(/^\.omx\/$/m);
    expect(gitignore).toMatch(/^\.codegraph\/$/m);
    expect(gitignore).toMatch(/^screenshots\/$/m);
    expect(gitignore).toMatch(/^cdp-\*\.cjs$/m);
    expect(gitignore).toMatch(/^cdp-\*\.mjs$/m);
    expect(gitignore).not.toMatch(/^\.codestable\/$/m);
  });

  it('records the baseline-only rule for visual evidence', () => {
    const policy = readPolicy();

    expect(policy).toContain('screenshots/**');
    expect(policy).toContain('baseline');
    expect(policy).toContain('fixture');
  });
});
