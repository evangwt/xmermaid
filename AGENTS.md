# AGENTS.md

This file is the operating contract for agents working in this repository.

Use a first-principles, high-accountability style: remove illusion, ship working systems, verify every claim. Do not imitate any person. Use the useful part of the "Musk style": brutal clarity, physics-before-politics thinking, speed only after truth.

## Mission

xmermaid is a browser SDK for rendering Mermaid-like flowcharts through a Rust/WASM parser and layout pipeline with a TypeScript SVG renderer.

The mission is not to sound compatible with Mermaid. The mission is to make the current supported subset work, expose unsupported syntax honestly, and keep every public claim backed by code and tests.

## Current Truth

The current production contract is partial Mermaid support, focused on flowcharts.

Do not claim full Mermaid compatibility. Historical planning docs may contain aspirational language about complete compatibility; treat those as archived intent, not current fact. Current fact comes from:

1. Source code and tests.
2. README current support section.
3. `.codestable/requirements/production-support-contract.md`.
4. Latest accepted CodeStable feature reports.
5. `.codestable/architecture/ARCHITECTURE.md` sections that describe current landed behavior.

If these disagree, code and passing tests win for behavior; update CodeStable docs so the documentation catches up.

## Non-Negotiables

- Do not fake a closed loop. If a feature says parse + render, both must be verified.
- Do not expand support claims to unsupported Mermaid syntax.
- Do not silently drop user semantics in visual editing.
- Do not add abstractions because they look clean. Add them only when they remove real coupling or protect a real contract.
- Do not add new dependencies without an explicit need and explicit user request.
- Do not ship documentation that describes plans as current architecture.
- Do not commit generated or local tool artifacts unless they are deliberately promoted as fixtures.
- Do not revert user changes or unrelated work.
- Do not hide failed verification behind "should work".

## Repository Map

- `src/xmermaid.ts`: public renderer orchestration.
- `src/wasm.ts`: WASM module boundary.
- `src/security.ts`: source-level security policy.
- `src/support.ts`: production support matrix and unsupported feature detection.
- `src/editor/`: live editor, sharing/export helpers, visual flowchart edit model.
- `src/renderer/`: SVG and edge geometry rendering.
- `src/types/`: public TypeScript contracts.
- `crates/xmermaid-parser/`: Rust parser.
- `crates/xmermaid-layout/`: Rust layout engine.
- `crates/xmermaid-wasm/`: wasm-bindgen API.
- `tests/`: TypeScript unit and contract tests.
- `.codestable/`: requirements, architecture, roadmap, features, evidence.
- `examples/live-editor.html`: browser live editor smoke surface.

## CodeStable Rules

Before CodeStable work, read `.codestable/attention.md`.

Use the right layer:

- Requirements describe what capability users need and why.
- Architecture describes what is true now.
- Roadmap describes how a large change is split and sequenced.
- Feature design/checklist/acceptance describe one implemented slice.
- Review docs record hard findings, not vibes.

When a feature is accepted:

1. Check implementation against the design.
2. Update architecture if current system behavior changed.
3. Update requirements if user-visible capability or contract changed.
4. Update roadmap items if the feature came from a roadmap.
5. Write the acceptance report.
6. Run verification before marking anything done.

Never mark a roadmap complete while any item is `planned` or `in-progress`.

## Execution Protocol

For every non-trivial task:

1. State the assumption in one sentence.
2. Inspect current files before relying on memory.
3. Identify the smallest real closed loop.
4. Implement only what closes that loop.
5. Write or update tests around the risk.
6. Run the strongest practical verification.
7. Update CodeStable evidence when contracts changed.
8. If committing, commit only the scoped work.

If a task is broad, first reduce it to the contract that must become true. If you cannot name the contract, you are not ready to code.

## Design Bar

Ask these before adding code:

- What exact user or maintainer failure does this prevent?
- Can this be deleted and still satisfy the contract?
- Is this a current fact or future wish?
- Does this create a second source of truth?
- Does this preserve supported AST semantics?
- Does this fail closed on unsupported syntax?
- Can a test prove this, or is it just plausible?

If the answer is weak, simplify.

## Visual Editor Contract

Visual flowchart editing must be AST-backed.

- Use `analyzeFlowchartForVisualEdit()` as the semantic entry.
- Do not use `parseFlowchartToGraph()` as the authority for visual rewrite support. It is a legacy/simple helper.
- Preserve supported shape, edge style, edge label, direction, `min_length`, and subgraph semantics.
- Use the support analyzer safety gate for known unsupported syntax.
- Validate visual output through parse and render/layout before committing source.
- On failure, keep the original source and emit diagnostics.

The live editor has two direction paths:

- Layout direction select: preview-only `layoutConfig.direction`.
- Apply direction button: source edit through the visual validation pipeline.

Do not collapse those paths.

## Security Contract

Default security posture is strict.

Strict mode blocks before rendering when it sees risky click callbacks, HTML labels, or disallowed URL protocols. Loose mode only relaxes click and HTML blocking; dangerous URLs remain blocked.

Do not add behavior that executes Mermaid click callbacks or renders HTML labels as trusted HTML.

## Testing And Verification

Use the smallest command that proves the claim, then escalate when the blast radius is broader.

Core commands:

```bash
npm run build
npm test
npm run typecheck
cargo test
python3 .codestable/tools/validate-yaml.py --file <path>
git diff --check
```

Release/package commands:

```bash
npm run verify:release
npm run smoke:consumer -- --json
```

Browser verification:

```bash
python3 -m http.server 4173
# open http://127.0.0.1:4173/examples/live-editor.html with Playwright or a browser
```

For frontend or browser behavior, TypeScript passing is not enough. Use a browser smoke for changed workflows.

For WASM/parser/layout contracts, JavaScript mocks are not enough. Use real Rust/WASM tests or a real `pkg/xmermaid_wasm_bg.wasm` roundtrip where the contract requires it.

## Generated Artifacts

Do not commit these by default:

- `.playwright-cli/`
- `dist/`
- `pkg/`
- `.omx/`
- `.codegraph/`
- temporary screenshots, traces, and local logs

Commit generated output only when the repository explicitly treats it as a release artifact, fixture, or baseline.

## Git And Commit Rules

Keep diffs scoped. A commit should have one reason to exist.

Use the Lore commit protocol:

```text
<intent line: why the change was made>

<body: context, constraints, approach>

Constraint: <external constraint>
Rejected: <alternative> | <reason>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Reversibility: <clean|messy|irreversible>
Directive: <future warning>
Tested: <verification>
Not-tested: <known gap>
```

The intent line explains why. The diff shows what.

## Harsh Review Gate

Before claiming done, run this review:

1. What is the fake demo path?
2. What can pass tests but fail in the browser?
3. What can parse but fail render/layout?
4. What user data or semantics could be dropped silently?
5. What unsupported syntax could be misrepresented as supported?
6. What doc now lies because the code changed?
7. What generated file accidentally entered the commit?
8. What old helper became a shadow source of truth?
9. What would break if this ran from a packed package instead of the repo?
10. What verification would embarrass this change if skipped?

Fix hard findings. Record important ones in CodeStable review or acceptance docs.

## Communication

Be direct.

- Say what changed.
- Say what was verified.
- Say what remains risky.
- Do not pad with optimism.
- Do not bury failures.

The standard is simple: make the system more true than it was before.
