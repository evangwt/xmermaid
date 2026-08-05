import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CodeStable current evidence docs', () => {
  it('keeps local planning artifacts private and npm installs on the official registry', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    const npmrc = readFileSync('.npmrc', 'utf8');
    const lockfile = readFileSync('package-lock.json', 'utf8');

    expect(gitignore).toMatch(/^\.superpowers\/$/m);
    expect(gitignore).toMatch(/^docs\/superpowers\/$/m);
    expect(npmrc).toBe('registry=https://registry.npmjs.org/\nreplace-registry-host=always\n');
    expect(lockfile).toContain('registry.npmjs.org');
    expect(lockfile).not.toContain('registry.npmmirror.com');
  });

  it('keeps Chinese Flowchart class style docs aligned with the safe parser boundary', () => {
    const readme = readFileSync('README.zh-CN.md', 'utf8');

    expect(readme).toMatch(/`classDef <名称>`/);
    expect(readme).toMatch(/`fill`、`stroke` 和 `color`/);
    expect(readme).toMatch(/三位或六位十六进制颜色/);
    expect(readme).toMatch(/可视化编辑.*只读/);
  });

  it('records the exact class style release size evidence and decision', () => {
    const acceptance = readFileSync(
      '.codestable/features/2026-08-04-flowchart-safe-class-styles/flowchart-safe-class-styles-acceptance.md',
      'utf8',
    );

    expect(acceptance).toMatch(/WASM.*976,159.*994,083.*17,924.*1\.84%/s);
    expect(acceptance).toMatch(/ESM.*251,102.*261,549.*10,447.*4\.16%/s);
    expect(acceptance).toMatch(/initial candidate.*1,036,038.*6\.13%/is);
    expect(acceptance).toMatch(/Rejected simplification/i);
    expect(acceptance).toMatch(/Accepted rationale/i);
  });

  it('keeps Rust package versions aligned with the npm package version', () => {
    const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
    const workspaceManifest = readFileSync('Cargo.toml', 'utf8');
    const layoutManifest = readFileSync('crates/xmermaid-layout/Cargo.toml', 'utf8');
    const wasmManifest = readFileSync('crates/xmermaid-wasm/Cargo.toml', 'utf8');
    const lockfile = readFileSync('Cargo.lock', 'utf8');

    expect(packageVersion).toBe('0.1.10');
    expect(workspaceManifest).toMatch(new RegExp(`\\[workspace\\.package\\]\\s*version = "${packageVersion}"`));
    expect(layoutManifest).toMatch(/version\.workspace = true/);
    expect(wasmManifest).toMatch(/version\.workspace = true/);
    for (const crate of ['xmermaid-layout', 'xmermaid-parser', 'xmermaid-wasm']) {
      expect(lockfile).toMatch(new RegExp(`name = "${crate}"\\nversion = "${packageVersion}"`));
    }
  });

  it('pins the npm publish toolchain used for reproducible release bytes', () => {
    const workflow = readFileSync('.github/workflows/publish-npm.yml', 'utf8');

    expect(existsSync('rust-toolchain.toml')).toBe(true);
    const rustToolchain = readFileSync('rust-toolchain.toml', 'utf8');
    expect(rustToolchain).toMatch(/channel = "1\.97\.1"/);
    expect(rustToolchain).toMatch(/profile = "minimal"/);
    expect(rustToolchain).toMatch(/targets = \["wasm32-unknown-unknown"\]/);
    expect(workflow).toMatch(/runs-on: ubuntu-24\.04/);
    expect(workflow).toMatch(/actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/);
    expect(workflow).toMatch(/actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38/);
    expect(workflow).toMatch(/node-version: "24\.19\.0"/);
    expect(workflow).toMatch(/npm@11\.17\.0/);
    expect(workflow).toMatch(/rustup show active-toolchain/);
    expect(workflow).toMatch(/cargo install wasm-pack --version 0\.14\.0 --locked/);
    expect(workflow).not.toMatch(/rustup toolchain install|rustup target add|cargo \+1\.97\.1/);
    expect(workflow).toMatch(/npm audit --audit-level=high --registry=https:\/\/registry\.npmjs\.org\n\s+- run: npm run verify:release/);
    expect(workflow).toMatch(/npm stage publish/);
    expect(workflow).not.toMatch(/npm publish --access public --provenance/);
  });

  it('describes the current live editor browser gate as packed Chrome/CDP smoke', () => {
    const harshReview = readFileSync(
      '.codestable/roadmap/multi-diagram-live-editor/harsh-review-2026-06-07.md',
      'utf8',
    );

    expect(harshReview).not.toMatch(/Playwright browser smoke/i);
    expect(harshReview).toMatch(/packed Chrome\/CDP consumer smoke/i);
  });

  it('describes explicit WASM asset URL loading as current SDK behavior', () => {
    const architecture = readFileSync('.codestable/architecture/ARCHITECTURE.md', 'utf8');

    expect(architecture).not.toMatch(/WasmInitOptions.*后续自定义 WASM 加载/);
    expect(architecture).not.toMatch(/current loader 行为未改变/i);
    expect(architecture).toMatch(/`wasm\.wasmUrl`/);
    expect(architecture).toMatch(/传给 wasm-pack 初始化/);
  });

  it('keeps the production package contract aligned with current package exports', () => {
    const readme = readFileSync('README.md', 'utf8');
    const checklist = readFileSync('docs/production-release-checklist.md', 'utf8');
    const roadmap = readFileSync(
      '.codestable/roadmap/production-readiness/production-readiness-roadmap.md',
      'utf8',
    );

    expect(readme).toMatch(/xmermaid\/editor/);
    expect(checklist).toMatch(/xmermaid\/editor/);
    expect(checklist).toMatch(/LICENSE/);
    expect(roadmap).toMatch(/"\.\/editor"/);
    expect(roadmap).toMatch(/"LICENSE"/);
    expect(roadmap).toMatch(/fetch\?: typeof globalThis\.fetch/);
    expect(roadmap).toMatch(/首次初始化后后续 render 复用同一个 module/);
    expect(roadmap).toMatch(/sanitizeSvg: true/);
  });

  it('keeps future planning artifacts out of the current architecture map', () => {
    const architecture = readFileSync('.codestable/architecture/ARCHITECTURE.md', 'utf8');
    const forbiddenCurrentFacts = [
      /历史规划附录/,
      /XMermaid\.registerPlugin/,
      /XMermaid\.registerDSLExtension/,
      /PluginDefinition/,
      /renderToCanvas/,
      /xmermaid\/server/,
      /xmermaid-cli/,
      /支持 10\+ 图表类型/,
      /v1\.0\.0 — 全功能版本/,
    ];

    for (const forbidden of forbiddenCurrentFacts) {
      expect(architecture).not.toMatch(forbidden);
    }
    expect(architecture).toMatch(/## 当前架构边界/);
    expect(architecture).toMatch(/必须另起 roadmap \/ feature/);
  });

  it('does not leave fixed CodeStable issue reports in confirmed status', () => {
    const issueDirs = readdirSync('.codestable/issues', { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => `.codestable/issues/${entry.name}`);
    const staleReports = issueDirs.flatMap(dir => {
      const reportPath = readdirSync(dir)
        .find(file => file.endsWith('-report.md'));
      if (!reportPath || !existsSync(`${dir}/${reportPath.replace(/-report\.md$/, '-fix-note.md')}`)) {
        return [];
      }
      const report = readFileSync(`${dir}/${reportPath}`, 'utf8');
      return /^status:\s*confirmed$/m.test(report) ? [`${dir}/${reportPath}`] : [];
    });

    expect(staleReports).toEqual([]);
  });
});
