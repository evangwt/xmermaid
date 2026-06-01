---
doc_type: requirement
slug: production-support-contract
pitch: 让用户在安装前就知道 xmermaid 当前支持什么、不支持什么
status: current
last_reviewed: 2026-06-02
implemented_by:
  - ARCHITECTURE
  - 2026-06-02-release-support-matrix
  - 2026-06-02-pack-install-render-smoke
  - 2026-06-02-render-svg-api
  - 2026-06-02-support-analyzer-v1
  - 2026-06-02-structured-diagnostics-v1
  - 2026-06-02-security-policy-v1
  - 2026-06-02-production-docs-release-checklist
tags: [production, support, release]
---

# 公开说明当前支持范围

## 用户故事

- 作为准备在文档站里安装 xmermaid 的开发者，我希望先知道哪些 Mermaid 图能跑，而不是装完才发现 sequence diagram 不能渲染。
- 作为维护发布包的人，我希望 README、package 描述和代码里的支持范围一致，而不是每次发布都靠人工记忆修文案。
- 作为遇到不支持语法的用户，我希望系统明确告诉我这是当前不支持，而不是把它包装成普通解析失败。
- 作为遇到不支持语法的用户，我希望系统指出具体不支持的是哪个 feature，并尽量告诉我在哪一行，而不是只说“partial support”。
- 作为 live editor 用户，我希望即使图还能渲染，也能看到当前 partial support 下不支持语法的 warning，而不是看到“没有诊断”。
- 作为把 Mermaid 输入嵌入同源应用的开发者，我希望默认安全策略把 click callback、HTML label 和危险 URL 明确阻断，而不是默认信任输入。
- 作为发布维护者，我希望 release gate 用真实 packed tarball 证明安装、类型解析、WASM 加载和浏览器最小渲染路径能跑，而不是只相信仓库内测试。
- 作为发布维护者，我希望 README、package 描述、support matrix、安全说明和 release checklist 不同步时发布失败，而不是靠人工记忆发现漂移。
- 作为 SDK 使用者，我希望能拿到 SVG element 或 SVG string，而不是必须把渲染结果写进某个 DOM container 后再反查。

## 为什么需要

生产发布最怕承诺比实现大。xmermaid 现在能稳定覆盖一部分 flowchart，但项目描述容易让人以为它是完整 Mermaid 替代品。用户一旦按这个预期安装，第一张不支持的图就会变成信任损失。

## 怎么解决

把当前支持范围做成公开合同：README 讲清楚，package 描述不夸大，代码提供可查询的支持矩阵。用户可以在渲染前判断一个图大概属于支持、部分支持还是不支持。发布前还必须跑真实消费者 smoke：packed tarball 安装进临时项目，消费者 TypeScript 解析 root public API，浏览器加载 installed package 的 ESM bundle 与 WASM asset 并渲染最小 flowchart。SDK 同时提供容器替换 API、SVG element API 和 SVG string API，方便应用层选择自己的挂载、序列化或存储方式。支持分析器提供 `detectUnsupportedFeatures(source)`，把 unsupported diagram family 和已知 unsupported flowchart syntax 转成 feature id + range；render API 会把这些结果转为结构化 diagnostics，unsupported diagram 预先失败，unsupported flowchart syntax 作为 warning 随成功 SVG 返回，live editor 也消费同一诊断合同。安全策略默认 strict，在调用 WASM 前用 `security_blocked_*` diagnostics 阻断 click、HTML label 和危险 URL；loose 只放宽 click/HTML 的 security blocking，不放开危险 URL。发布门禁包含 docs support matrix sync，README、package 描述、release checklist 和关键生产事实不同步时直接失败。

## 边界

- 它不新增任何图表渲染能力，只说明当前能力。
- support analyzer 是轻量扫描器，不替代完整 parser；v1 只覆盖当前 support matrix 声明的 unsupported diagram family 和常见 flowchart syntax。
- structured diagnostics 不替代 Rust parser 的完整错误定位；当前 parser 未输出结构化 offset/column 时，WASM parse error 的 range 保持 `null`。
- security policy v1 只做 source-level diagnostics，不执行 click callback、不渲染 HTML label、不实现 sanitizer/CSP/sandbox。
- consumer smoke 只承诺 browser SDK 最小路径；root ESM 可被 Node/SSR/构建工具解析，但不承诺 Node DOM 渲染。
- SVG string API 不代表 PNG、Canvas、Blob 或服务端渲染能力。

## 变更日志

- 2026-06-02：backfill 当前生产支持合同能力，覆盖 support matrix、README 和 package 描述同步。
- 2026-06-02：新增真实 packed consumer smoke release gate，覆盖 tarball 文件校验、消费者 typecheck、Node ESM import 和 Chrome/WASM 最小渲染。
- 2026-06-02：新增公开 SVG 输出 API，覆盖 `renderToSVGElement()`、`renderToSVGString()`、`RenderResult` 和 packed consumer typecheck。
- 2026-06-02：新增 support analyzer v1，覆盖 `detectUnsupportedFeatures()`、unsupported feature id 和 source range 输出。
- 2026-06-02：新增 structured diagnostics v1，覆盖 `XMermaidDiagnosticCode`、`SourceRange`、render preflight diagnostics、`XMermaidError.diagnostics` 和 live editor diagnostics 消费。
- 2026-06-02：新增 security policy v1，覆盖默认 strict、有限 loose、URL allowlist、`security_blocked_*` diagnostics 和 packed consumer typecheck。
- 2026-06-02：新增 production docs / release checklist，覆盖 README 生产用法、`docs/production-release-checklist.md` 和 `docs-support-matrix-sync` release gate。
