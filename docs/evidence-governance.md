# Evidence Governance

This repository keeps durable engineering evidence in git and excludes local runtime state. The rules below implement the `visual-rendering-readiness` roadmap asset contract.

## Asset Classes

| Class | Repository rule |
| --- | --- |
| `repo-spec` | Track durable CodeStable material such as `.codestable/roadmap/**`, `.codestable/features/**`, `.codestable/audits/**`, `.codestable/architecture/**`, and `.codestable/reference/**`. |
| `diagnostic-tool` | Track maintained scripts only when they live in a stable location such as `scripts/` and their purpose is clear from the file name, tests, or nearby docs. |
| `runtime-cache` | Ignore locally generated caches such as `.codegraph/**`. They must be reproducible from source. |
| `visual-evidence` | Ignore ad hoc `screenshots/**` output by default. Commit visual evidence only after moving it to an explicit baseline or fixture path used by tests or review. |
| `private-log` | Ignore local agent/session state such as `.omx/**`. |

## Path Policy

- `.codestable/roadmap/**`, `.codestable/features/**`, and `.codestable/audits/**` are `repo-spec` and should be reviewed like source changes.
- `.omx/**` is `private-log` and must not be committed.
- `.codegraph/**` is `runtime-cache` and must not be committed.
- `screenshots/**` is ignored until a later feature promotes specific images to a baseline or fixture path.
- Root-level `cdp-*.cjs` and `cdp-*.mjs` files are temporary browser diagnostic scratch files. Promote one to `scripts/` with a clear name before committing it.
