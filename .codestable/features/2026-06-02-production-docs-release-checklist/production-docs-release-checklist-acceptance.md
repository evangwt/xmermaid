---
doc_type: feature-acceptance
feature: 2026-06-02-production-docs-release-checklist
status: accepted
summary: 验收 production docs 和 release checklist
tags: [production, docs, release]
---

# production-docs-release-checklist 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-06-02
> 关联方案 doc：.codestable/features/2026-06-02-production-docs-release-checklist/production-docs-release-checklist-design.md

## 1. 接口契约核对

- [x] README 已扩成生产用户文档，覆盖安装、browser usage、SVG API、support matrix、diagnostics、安全策略、WASM/Chrome smoke 和 troubleshooting。
- [x] `docs/production-release-checklist.md` 已新增，覆盖 release matrix、环境要求、package 文件要求、docs sync 和失败归属。
- [x] `scripts/verify-release.cjs` 已新增 `--check-docs` 模式。
- [x] 默认 release matrix 已新增 `docs-support-matrix-sync`，命令为 `node scripts/verify-release.cjs --check-docs`。

## 2. 行为与决策核对

- [x] D1：README 首屏明确 flowchart-focused / partial Mermaid support。
- [x] D2：release checklist 单独写入 `docs/production-release-checklist.md`。
- [x] D3：docs sync gate 只检查关键生产事实，不做全文 lint。
- [x] D4：docs sync gate 是 required release blocker。
- [x] 挂载点反向核对：新增/修改命中均在 design 2.3 清单内：`README.md`、`docs/production-release-checklist.md`、`scripts/verify-release.cjs`、`tests/verify-release.test.ts`、`tests/support-matrix.test.ts`、CodeStable roadmap/req/architecture。

## 3. 验收场景核对

- [x] S1：README 明确 partial flowchart support、unsupported diagram families、diagnostics、安全 strict、Chrome/`CHROME_BIN`、consumer smoke。
  - 证据：`node scripts/verify-release.cjs --check-docs --json` 通过；`tests/verify-release.test.ts` 覆盖 docs gate。
- [x] S2：production release checklist 列出 build、consumer smoke、docs sync、JS tests、typecheck、cargo、diff whitespace。
  - 证据：`docs/production-release-checklist.md` 表格包含全部默认 matrix command id。
- [x] S3：默认 release matrix 包含 `docs-support-matrix-sync` 且在 consumer smoke 之后。
  - 证据：`tests/verify-release.test.ts` matrix order 断言通过。
- [x] S4：`--check-docs` 当前文档返回 0。
  - 证据：`node scripts/verify-release.cjs --check-docs --json` 返回 `passed: true`。
- [x] S5：缺少关键 docs 短语时 docs gate 返回非 0。
  - 证据：`tests/verify-release.test.ts` 使用临时 README/checklist 断言 failure JSON。

## 4. 术语一致性

- `docs-support-matrix-sync`、`consumer-pack-install`、`partial Mermaid support`、`security_blocked_*`、`CHROME_BIN` 均与 README、release checklist、verify-release matrix 和 roadmap 文案一致。
- README 没有承诺完整 Mermaid 兼容，也没有承诺 Node/server rendering。

## 5. 架构归并

- [x] `.codestable/architecture/ARCHITECTURE.md` 已写入 docs support matrix sync 的默认矩阵位置、检查范围和边界。

## 6. requirement 回写

- [x] `.codestable/requirements/production-support-contract.md` 已追加 `2026-06-02-production-docs-release-checklist` 到 `implemented_by`。
- [x] 用户故事、解决方式和变更日志已补充 docs sync release gate。

## 7. roadmap 回写

- [x] `.codestable/roadmap/production-readiness/production-readiness-items.yaml` 中 `production-docs-release-checklist` 已改为 `done`。
- [x] `.codestable/roadmap/production-readiness/production-readiness-roadmap.md` 已改为 `status: completed`，子 feature 清单已同步状态、feature 目录和备注。
- [x] YAML 校验通过。

## 8. attention.md 候选盘点

- 候选：consumer smoke 依赖真实 Chrome/Chromium；CI 无默认浏览器时设置 `CHROME_BIN`。这已进入 README 和 release checklist，不再重复写入 attention。

## 9. 遗留

- 未新增 changelog 管理系统。
- 未新增完整 API reference；当前只覆盖生产最小用法和 release checklist。

## 验证记录

- [x] `npm test -- tests/verify-release.test.ts tests/support-matrix.test.ts tests/consumer-smoke.test.ts`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run smoke:consumer -- --json`
- [x] `node scripts/verify-release.cjs --check-docs --json`
- [x] `node scripts/verify-release.cjs --list-matrix --json`
- [x] YAML validation for production docs checklist and production-readiness items.
