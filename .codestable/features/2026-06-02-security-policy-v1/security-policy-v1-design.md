---
doc_type: feature-design
feature: 2026-06-02-security-policy-v1
requirement: production-support-contract
roadmap: production-readiness
roadmap_item: security-policy-v1
status: approved
summary: 落地 strict/loose 安全策略、URL/click/html label 处理和安全 diagnostics
tags: [production, security, diagnostics]
---

# security-policy-v1 design

## 0. 术语约定

- **SecurityPolicy**：渲染前安全检查使用的策略对象，默认 strict。
- **SecurityLevel**：`strict` 或 `loose`。strict 用于不可信 Mermaid input；loose 只放宽 click/HTML 的 security blocking，不新增执行能力。
- **Security diagnostic**：`security_blocked_url`、`security_blocked_html`、`security_blocked_click` 三类结构化诊断。
- **Unsafe URL**：protocol 不在 allowlist 中的 URL，例如 `javascript:`、`data:`、`vbscript:`。

## 1. 决策与约束

### 需求摘要

生产默认不能把不可信 Mermaid 输入当成可信 HTML/JS。当前 support analyzer 已能识别 `click` 和 HTML label，但它们只是 unsupported syntax warning；本 feature 要给 SDK 一个明确安全策略：默认 strict 产生安全 diagnostics，阻断 click、HTML label 和危险 URL；loose 可以把 click/HTML 从安全阻断降回普通 unsupported syntax warning，但危险 URL 仍然阻断。

成功标准：

- root public API 导出 `SecurityLevel`、`SecurityPolicy`、`DEFAULT_SECURITY_POLICY`。
- `RenderOptions.securityLevel` 和 `RenderOptions.securityPolicy` 可控制单次 render 的安全诊断。
- strict 默认：`click` 产生 `security_blocked_click` error diagnostic；HTML label 产生 `security_blocked_html` error diagnostic；危险 URL 产生 `security_blocked_url` error diagnostic。
- loose：`click` / HTML label 不产生 security diagnostics，仍保留 support analyzer 的 `unsupported_syntax` warning；危险 URL 仍产生 `security_blocked_url`。
- packed consumer typecheck 能 import security 类型并传入 render options。

明确不做：

- 不执行 click callback，不新增 link/click 渲染能力。
- 不把 HTML label 渲染为 HTML，不实现 sanitizer。
- 不新增 URL 渲染能力；只做 source-level policy diagnostics。
- 不新增 CSP header 或浏览器运行时 sandbox。
- 不新增 Mermaid diagram/parser 支持。

### 复杂度档位

走“小型 SDK 安全策略 + diagnostics”档位。偏离点：安全默认值属于生产承诺，必须用测试证明 strict 默认生效且 loose 行为有限。

### 关键决策

- **D1：默认 strict。** `DEFAULT_SECURITY_POLICY.securityLevel` 为 `strict`，输入默认按 untrusted Mermaid 处理。
- **D2：security diagnostics 独立于 support diagnostics。** strict 下 click/HTML 会同时表达为安全阻断；loose 下只保留 unsupported syntax warning。
- **D3：危险 URL 不随 loose 放开。** `javascript:`/`data:` 这类 protocol 总是 `security_blocked_url`。
- **D4：v1 只做 source preflight。** 当前 renderer 不支持 click/HTML/link 执行，本 feature 不新增这些能力，只让风险可见且默认阻断。

### 前置依赖

`structured-diagnostics-v1` 已完成，提供 `security_blocked_*` diagnostic codes、`SourceRange` 和 render result/error diagnostics。

## 2. 名词与编排

### 2.1 名词层

#### 现状

- `RenderOptions` 没有安全选项。
- `src/support.ts` 能识别 `flowchart.click` 和 `flowchart.htmlLabel`，但没有安全 policy 语义。
- `XMermaidDiagnosticCode` 已保留 `security_blocked_url`、`security_blocked_html`、`security_blocked_click`。

#### 变化

新增类型：

```ts
type SecurityLevel = 'strict' | 'loose';

interface SecurityPolicy {
  securityLevel: SecurityLevel;
  allowedUrlProtocols: string[];
  allowHtmlLabels: boolean;
  allowClickCallbacks: boolean;
}

const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  securityLevel: 'strict',
  allowedUrlProtocols: ['http:', 'https:', 'mailto:'],
  allowHtmlLabels: false,
  allowClickCallbacks: false,
};
```

`RenderOptions` 追加：

```ts
interface RenderOptions {
  securityLevel?: SecurityLevel;
  securityPolicy?: Partial<SecurityPolicy>;
}
```

### 2.2 编排层

```mermaid
flowchart TD
  A[renderToSVGElement(input, options)] --> B[support analyzer diagnostics]
  A --> C[resolve security policy]
  C --> D[detect security diagnostics]
  B --> E[merge diagnostics]
  D --> E
  E --> F{blocking security or unsupported diagram?}
  F -->|yes| G[throw XMermaidError with diagnostics]
  F -->|no| H[WASM render + SVG]
  H --> I[RenderResult.diagnostics]
```

#### 现状

Render preflight 只把 unsupported feature 转成 diagnostics。安全风险没有单独 code，用户无法区分“当前不支持”和“默认安全策略阻断”。

#### 变化

- 在 SDK render preflight 中解析 security policy。
- 扫描 source line，定位 click、HTML label 和 URL token。
- strict 下生成 `security_blocked_click` / `security_blocked_html` / `security_blocked_url` diagnostics。
- loose 下 click/HTML 不生成 security diagnostics，但 URL allowlist 仍生效。
- 存在 error severity security diagnostics 时，render 前抛 `XMermaidError('RENDER_ERROR')` 并携带 diagnostics；不让不安全输入继续进入 render pipeline。

流程级约束：

- Security diagnostics 不替代 support analyzer；两者可同时存在。
- Security URL detection 只做常见 source-level URL protocol 检查，不承诺完整 Mermaid link grammar。
- `render(input)` 仍走默认 strict，因为它调用 `renderToSVGElement(input)`。
- live editor 默认 render path 自然继承 strict diagnostics。

### 2.3 挂载点清单

- `src/types/options.ts`：新增 security option/types。
- `src/security.ts`：新增 policy resolve 与 source-level diagnostics。
- `src/xmermaid.ts`：合并 security diagnostics，并在 blocking security diagnostics 时抛错。
- `src/index.ts` / `src/types/index.ts`：导出 security 类型和值。
- `tests/xmermaid.test.ts` / `tests/live-editor.test.ts`：覆盖 strict/loose/default editor 行为。
- `scripts/consumer-smoke.cjs`：packed consumer typecheck 引用 security 类型和 options。

### 2.4 推进策略

1. RED 测试：新增 strict 默认、loose 放宽、dangerous URL、live editor default 和 consumer typecheck 期望。
   退出信号：测试因安全类型缺失或 diagnostics 缺失失败。
2. 名词层实现：新增 security types/default policy 并导出。
   退出信号：typecheck 能识别 security API。
3. 计算实现：新增 source-level security diagnostics。
   退出信号：security unit/render tests 通过。
4. 编排接入：SDK render preflight 合并 security diagnostics 并在 blocking error 时抛 `XMermaidError`。
   退出信号：`tests/xmermaid.test.ts` 目标场景通过。
5. Editor/consumer 接入验证：live editor 默认 strict 行为和 packed typecheck。
   退出信号：`tests/live-editor.test.ts` 目标场景、`npm run build && npm run smoke:consumer -- --json` 通过。
6. 回归验证：相关单测、全量 JS、typecheck、build、consumer smoke。
   退出信号：验证命令全部通过。

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `src/xmermaid.ts` 已承担 render orchestration，不适合继续塞 source-level URL/click/html 扫描。
- 文件级 — `src/support.ts` 是 production support contract，不应混入安全策略默认值。
- 目录级 — `src/` 已有 `support.ts` 这类顶层 SDK helper，新增 `security.ts` 与其并列。

##### 结论：做微重构（新文件）

新增 `src/security.ts` 放置 `SecurityPolicy`、`DEFAULT_SECURITY_POLICY`、`resolveSecurityPolicy()` 和 `detectSecurityDiagnostics()`。`xmermaid.ts` 只负责调用和合并，不内联扫描规则。

## 3. 验收契约

关键场景：

- **S1**：默认 `renderToSVGElement('graph TD\n  click A javascript:alert(1)')` → 抛 `XMermaidError`，diagnostics 含 `security_blocked_click` 和 `security_blocked_url`。
- **S2**：默认 `renderToSVGElement('graph TD\n  A[<b>Hi</b>]')` → 抛 `XMermaidError`，diagnostics 含 `security_blocked_html`。
- **S3**：`renderToSVGElement(source, { securityLevel: 'loose' })` 对 click/HTML 不产生 security diagnostics，但仍保留 unsupported syntax warning。
- **S4**：`securityLevel: 'loose'` 遇到 `javascript:` URL → 仍抛 `security_blocked_url`。
- **S5**：live editor 默认 render 遇到 click/HTML 风险 → diagnostics panel 显示 security code。
- **S6**：packed consumer typecheck 能 import `SecurityLevel` / `SecurityPolicy` / `DEFAULT_SECURITY_POLICY` 并传入 render options。

反向核对项：

- 不执行 click callback。
- 不渲染 HTML label。
- 不实现 sanitizer/CSP。
- 不新增 Mermaid diagram/parser 支持。
- loose 不允许危险 URL。

## 4. 与项目级架构文档的关系

acceptance 阶段需要把默认 strict policy、loose 的有限含义、URL allowlist、security diagnostics 和“不执行 click/HTML、不实现 sanitizer”的边界写入 `ARCHITECTURE.md` 与 `production-support-contract`，并回写 production-readiness roadmap。
