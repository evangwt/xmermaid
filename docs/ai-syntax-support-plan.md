# AI 非标准 Mermaid 语法的支持方案与安全边界设计

- 状态：设计定稿（本文件只做设计，未修改任何 `crates/**`、`src/**` 行为）
- 输入证据：`docs/ai-syntax-scan.md`（211 探针 × 30/30 图族，`renders 170 | throws 32 | security-blocked 8 | silent-drop 1 | security-leak 0`）
- 扫描工具：`scripts/ai-syntax-scan/{corpus.mjs,harness.mjs,run.mjs}`、`tests/ai-syntax-scan.test.ts`
- 目标仓库：XM `/Volumes/Data/Code/xmermaid`（本次只改渲染器；LIVE `/Volumes/Data/Code/xmermaid-live` 不在范围内）
- 约束：沿用 Rust + TS 技术栈；不改 LIVE；不引入新框架；每条结论可追溯到扫描报告实测证据

---

## 0. 关键前提：谁在"拦住"这些语法

XM 的渲染链是 **两级门禁 + 一次解析**：

1. `src/xmermaid.ts#renderToSVGElement` 先跑 `analyzeSupport(input)`（`src/support.ts`，TS 侧**独立**扫描器）与 `detectSecurityDiagnostics(input, policy)`（`src/security.ts`）。
2. 若支持扫描产生 `unsupported_syntax`（severity=error）或安全诊断，**在调用 WASM 之前就 throw**。
3. 通过后才调用 `wasm.render(...)`（`crates/xmermaid-wasm` → `xmermaid-parser` 词法/解析 → `xmermaid-layout`）。

由此得到一个对设计至关重要、容易被忽略的事实：

> **同一个"非标准语法"，可能被 TS 门禁拦住，也可能被 Rust 解析器拦住，两者的修复层不同。**

实证：

- `flowchart en-dash arrow (A –> B)` 抛出的消息 `Flowchart labels cannot be unterminated; add the matching closing delimiter.` 逐字来自 **`src/support.ts:376`**，而不是 Rust。也就是说这个 case 是 **TS 支持门禁**拦下的（扫描器没把 `–>` 识别成箭头，误判为"标签未闭合"）。
- `flowchart UTF-8 BOM` 抛出的 `PARSE_ERROR: …Expected Keyword, got Unknown` 来自 **Rust**（`Parser::parse` 未剥离 BOM）。
- `sequence full-width dash` 抛出的 `Invalid sequence statement` 来自 **Rust**（`parser.rs:247`）。

**结论**：任何"输入归一化"必须让 **TS 门禁与 Rust 解析器看到同一份文本**，否则会出现"归一化只做了一半、被 TS 门禁提前挡下"的假修复。

---

## 1. 缺口清单（按图族归类）

每条给出「现状 → 期望 → 归属层」。归属层取值：`Rust 词法器/解析器` / `TS 前处理（WASM 之前）` / `布局/渲染` / `LIVE 提取层（非渲染器职责）`。

### 1.1 flowchart

| 变体 | 现状（证据） | 期望 | 归属层 |
| --- | --- | --- | --- |
| 智能破折号箭头 `–>` / `—>` | throws；`RENDER_ERROR: Flowchart labels cannot be unterminated…`（**TS 门禁** `support.ts:376` 产生；Rust 亦未识别） | 渲染出 `A --> B` | **TS 前处理**（归一化） |
| UTF-8 BOM 前缀 `\uFEFF` | throws；`PARSE_ERROR: …Expected Keyword, got Unknown ('') at line 1`（**Rust**） | 渲染 | **TS 前处理**（归一化） |
| 源内含 ```mermaid 围栏 | throws；`UNSUPPORTED_DIAGRAM`（**Rust** 拿到 ```mermaid 当图类型） | 由调用方剥壳后渲染 | **LIVE 提取层（非渲染器职责）**；可选 TS 兜底剥离 |
| 反斜杠转义竖线 `A -->\|a \\\| b\| B` | throws；同"unterminated"（**TS 门禁 + Rust 词法**都未处理 `\|`） | 渲染出标签 `a \| b` | **Rust 词法器** + TS 门禁对齐 |
| 未闭合标签 `A[unterminated` | throws（**TS 门禁**，正确行为） | 保持报错 | 不修（预期） |
| `classDef fill:url(#ref)` / `url(javascript:)` | throws（Rust 样式校验器，**正确拦截**） | 保持报错 | 不修（安全预期） |

### 1.2 sequence

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| 全角破折号箭头 `A－>>B` | throws；`Invalid sequence statement: A－>>B: x`（**Rust** `parser.rs:247`） | 渲染 | **TS 前处理**（归一化） |
| 源内含围栏 | throws；`UNSUPPORTED_DIAGRAM` | 同上 | **LIVE 提取层** |
| 全套箭头 `->`/`-->`/`-x`/`--x`/`<<->>`/`<<-->>` | 已在途完成（未提交，见 §4） | — | 已完成 |

### 1.3 class

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| 独立行 `<<interface>> A` | throws；`Invalid class statement: <<interface>> A`（**Rust** `parser.rs:325`） | 渲染为 `A` 带 stereotype | **Rust 解析器** |
| 独立行 `<<Service>> A` | throws；同根因 | 同上 | **Rust 解析器** |
| `note for A "hello"` | silent-drop（出图但文本丢失） | 接受并跳过（已在途）或渲染 | 已完成（接受并跳过，见 §4） |
| 块内 `class A { <<interface>> }` / 后缀 `A <<interface>>` | renders（对照，证明 AST 已支持 stereotype） | 保持 | 不修 |

### 1.4 state

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| 并发区域 `--` | throws；`Invalid state statement: --`（**Rust** `parser.rs:3221`） | 接受（渲染状态，区域分隔降级并告警） | **Rust 解析器** |

### 1.5 quadrant

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| `classDef` + `:::class`（矩阵宣称支持） | throws；`Unsupported Quadrant style property 'fill': classDef x fill:#f00`（**Rust** `parser.rs:4576`） | 接受 `fill` 等属性 | **Rust 解析器**（**行为修复**，见 §4 一致性） |

### 1.6 c4

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| `Enterprise_Boundary(b,"B") { … }` 块 | throws；`C4 statements must close their argument list`（**Rust** `parser.rs:3927`） | 接受块形式（复用既有容器模型） | **Rust 解析器** |

### 1.7 zenuml

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| `participant`/`actor` 声明（矩阵宣称支持） | throws；`ZenUML … not supported`（**Rust**） | 接受声明 | **Rust 解析器**（**行为修复**） |
| `if` 块（已文档化不支持） | throws | 保持报错 | 不修（预期） |

### 1.8 treemap

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| 2 空格缩进（含中文标签） | throws；`Treemap entries must use four-space indentation`（**Rust** `parser.rs:1526`） | 按相对缩进推断层级（AI 几乎总用 2 空格） | **Rust 解析器** |
| 4 空格缩进 | renders（对照） | 保持 | 不修 |

### 1.9 kanban

| 变体 | 现状 | 期望 | 归属层 |
| --- | --- | --- | --- |
| 中文列 id `完成[Done]` | throws；泛化报错（**Rust**） | 放宽 id 字符集，接受非 ASCII id | **Rust 解析器** |
| ASCII id + 中文标签 `done[完成]` | renders（对照） | 保持 | 不修 |

### 1.10 明确不修（已文档化不支持，保持显式报错）

`block` 嵌套块、`sankey` 环/`config:`/非数值权重、`architecture` `align`、`wardley` `evolve`、`zenuml` `if` 块。这些在 `src/support.ts` 与 Rust 中均已显式报错，属**预期 fail-closed**，不属缺口。

### 1.11 主理人已纠错、不得当作缺口

`class A { +method() }` 的成员**正常渲染**（`textContent` 含 `+method()`）。先前"静默丢成员"的推断有误，**不作为缺口**。

---

## 2. 每项的支持策略（接受 / 归一化 / 显式报错）

统一策略三选一，并说明"为何不放松安全"。

### 2.1 归一化（Normalize）—— 输入等价改写，不改语义

适用于**纯字形差异**，不承载任何语义：智能/全角破折号箭头、BOM、全角标点。做法是把它们**无损折叠成 ASCII 等价物**，让下游看到规范输入。

- `–`(U+2013) / `—`(U+2014) / `－`(U+FF0D) → `-`（仅在箭头/连字符位置）
- `\uFEFF` BOM → 删除（仅出现在流首）
- 全角 `：`、`（）` 等**已能渲染**，不改动；只折叠会影响**结构性 token**（箭头、冒号）的全角变体

**为何不放松安全**：归一化只做"同码位、等语义"的字符替换，**不做实体解码、不做百分号解码、不拼接跨行 token**。它绝不把文本变成可执行内容，也绝不把转义文本变成"活"链接。归一化后仍要**重新**跑一次安全扫描（见 §3）。

### 2.2 接受（Accept）—— 扩语法，进入 AST

适用于 AI 高频、且能映射到既有模型的结构：

- class 独立行 `<<interface>> A` → 视为"给 `A` 设置 stereotype"（复用既有 stereotype 字段，**无新增 AST 概念**）。
- state `--` → 接受为"并发区域分隔符"；渲染侧若暂无区域线，**降级为告警**（warning，非阻断），不静默丢弃。
- c4 `Enterprise_Boundary(...) { … }` 块 → 解析为既有容器 + 子元素；不支持的深层嵌套降级为告警。
- quadrant `classDef` 的 `fill` → 接受为点样式属性（`fill` 视作 `color` 别名）。
- zenuml `participant`/`actor` 声明 → 注册参与者（消息仍会隐式建参与者，声明只影响顺序/命名）。
- treemap 2 空格缩进 → 由**相对缩进增量**推断层级，不再硬编码 4 空格。
- kanban 非 ASCII 列 id → 放宽 id 字符集（保持 `[label]` 语义不变）。

**为何不放松安全**：这些新接受的 token **仍全部走"标签一律纯文本 + 转义"的既有通道**；没有新增任何 `href`/`click`/`style:url()` 出口。新增结构只是"更多文本能进图"，不改变"文本如何被转义/渲染"的契约。

### 2.3 显式报错（Error）—— 保持 fail-closed

- 未闭合标签、危险 URL、`classDef/style fill:url(...)`、`click` 回调：**继续报错/拦截**。
- 已文档化不支持的高级特性：继续显式报错。

### 2.4 转义（Escape）—— 词法层

- `A -->|a \| b| B`：`\|` 是**边标签内的转义竖线**，不闭合标签。Rust 词法器 `read_edge_label` 需识别反斜杠转义；TS 支持扫描器的语句切分需采用**同一规则**（见 §4 的单一事实源风险）。

---

## 3. 安全边界规范

### 3.1 放宽后仍必须拦截（不可退让清单）

| 类别 | 必须保持的行为 | 证据锚点 |
| --- | --- | --- |
| 危险 URL | `javascript:` / `data:` / `vbscript:`（含大小写混淆、Tab 拆分）在 label / `click` / `href` 一律拦截 | 扫描 `security_blocked_url/click` 8 条 |
| 危险样式 | `classDef fill:url(#ref)`、`style fill:url(javascript:)` 拦截 | `sec-classdef-url-ref` 等 |
| HTML 标签 | `<script>`/`onerror`/`onload`/`<foreignObject>`/`<iframe>`/大小写混淆/实体编码，一律**按纯文本渲染并转义** | 35 条注入探针 `security-leak 0` |
| `click` 回调 | strict 下 `allowClickCallbacks:false`，全部 `click` 拦截 | `sec-click-https` |
| 源内降级指令 | `%%{init:{securityLevel:'loose'}}%%` **不得**降低策略等级 | `sec-loose-init-directive` |
| 渲染后消毒器 | `sanitizeSvg`（移除 `script/foreignObject`、`on*`、危险 `href`、危险 `style:url()`）**保留为最后防线** | `src/xmermaid.ts#sanitizeSvgElement` |

### 3.2 加固建议（防御纵深）

1. **跨行 URL 归一化（必须做）**：`src/security.ts#unsafeUrls` 目前**逐行**检测，`javascript:` 被换行拆成 `java`+`\n`+`script:` 时**未拦截**（扫描 `sec-newline-split-js` = renders）。当前因"标签一律纯文本"而无实际危害，**但一旦未来标签被渲染为链接/`href`，即成真漏洞**。加固方式：检测前先做**跨行去空白归一化**（在候选 scheme 内折叠 `\t\r\n`），再匹配协议。**要求：该加固不得引入新的解码（不解实体、不解百分号）**。
2. **安全扫描必须跑在归一化后的文本上**：归一化后重新 `detectSecurityDiagnostics`，保证"解析器看到的文本 == 安全扫描看到的文本"，避免归一化制造未扫描路径。
3. **归一化必须幂等且保守**：只做等价字符替换；不得解码、不得跨行拼接除 URL scheme 检测外的任何 token。
4. **保留 TS 门禁 + Rust 解析器 + 渲染后消毒器三层**：任何一层都不删除；新语法只能走既有转义通道。
5. **新增探针入语料**：把每一条"新接受/新归一化"的语法都加一条**带 payload** 的注入探针到 `scripts/ai-syntax-scan/corpus.mjs`，使 `security-leak` 恒为 0。

### 3.3 新语法容错的注入回归断言要求

**每新增一条语法容忍，必须配套至少一条"同语法 + 注入 payload"的断言**，证明新语法不是新的注入面：

| 新容忍语法 | 必备注入断言 | 期望 |
| --- | --- | --- |
| 破折号/BOM/全角归一化 | 归一化后的源内 `<script>` / `javascript:` | 纯文本 / 拦截 |
| `\|` 转义 | 转义标签内 `<img onerror>` | 纯文本 |
| class 独立 `<<interface>>` | stereotype 名或类名带 `<script>` | 纯文本 |
| state `--` | 并发分隔附近带 `<script>` | 纯文本 |
| quadrant `classDef fill` | `fill:url(javascript:)` | 拦截 |
| c4 boundary 块 | 边界名带 `<script>` | 纯文本 |
| zenuml 声明 | 参与者名带 `<script>` | 纯文本 |
| treemap 2 空格 | 标签带 `<script>` | 纯文本 |
| kanban 中文 id | 列 id/标签带 `<img onerror>` | 纯文本 |

并要求一个**硬断言测试**：扫描语料中 `security-leak` 计数必须为 **0**（当前扫描是"诊断型、不 fail"，需新增 fail 断言）。

---

## 4. 文档一致性修复（矩阵 vs 行为）

`src/support.ts` 的支持矩阵是**公开契约**。扫描发现两处"宣称支持但实际抛错"，另有两处需对齐措辞。结论如下：

| 项 | 矩阵现状 | 实际行为 | 结论 |
| --- | --- | --- | --- |
| `quadrant.classes`（`classDef` + `:::class`） | 宣称 `supported` | throws（`fill` 被样式校验器拒绝） | **改行为**：Rust 接受 `fill/stroke/color/stroke-color/stroke-width`（`fill` 视作 `color` 别名）。理由：契约已宣称支持；Mermaid 的 quadrant `classDef` 用 `fill`；改动小、无安全面扩大 |
| `zenuml.declarations`（`participant`/`actor`） | 宣称 `supported` | throws | **改行为**：Rust 接受声明（注册参与者）。理由：契约已宣称支持；声明接受成本低 |
| `c4.boundaries`（矩阵称"enterprise boundaries"支持） | 宣称 `supported` | **块形式** throws | **改行为**：接受块形式并复用既有容器模型（§2.2） |
| `class.notes` | 在途已加 `unsupported`："accepted and skipped, not drawn" | 接受并跳过（silent-drop 按扫描定义） | **措辞已对齐**（在途）。**待明确**：是否进一步渲染 note 文本（见 §7） |
| `sequence.cross-ending` / `sequence.links` / `class.direction` | 在途已更新措辞 | 与在途行为一致 | 已完成，无需再动 |

**原则**：凡是矩阵已宣称支持的，优先"让行为追上契约"；只有确实做不到、且成本远高于价值时才"改文档降级"。上表两处（quadrant、zenuml）均属低成本行为修复，故选改行为。

---

## 5. 任务分解（按依赖排序）

> 硬约束：任务数 ≤ 5；每任务 ≥ 3 个相关文件；按功能模块分组；T01 为打底任务。
> 归属层与 §1、§2 严格对应。**"已完成（在途）"不再列入任务**（见 §4 末行与本节备注）。

### T01 — 输入归一化层 + 支持门/安全对齐（TS 前处理，打底）｜P0
- **涉及文件**
  - `src/normalize.ts`（新增）：`normalizeSource(input)` 单一入口——剥 BOM、折叠智能/全角破折号箭头为 ASCII、共享的"转义感知分隔符"规则；返回 `{ text, offsetMap }` 以保持诊断 range 可回溯。
  - `src/xmermaid.ts`（修改）：在 `renderToSVGElement` **最前面**调用 `normalizeSource`，用归一化文本喂给 `analyzeSupport`、`detectSecurityDiagnostics` 与 `wasm.render`（同一份文本，单一事实源）。
  - `src/security.ts`（修改）：跨行 URL 归一化加固（§3.2-1）。
  - `src/support.ts`（修改）：支持扫描器采用归一化文本 + 与词法一致的转义规则（消除 `–>` 误判为 unterminated）。
  - `tests/normalize.test.ts`（新增）：归一化单测（幂等、offsetMap、各变体）。
- **依赖**：无（基础设施）
- **验收标准**
  - `flow-en-dash-arrow`/`flow-em-dash-arrow`/`flow-bom`/`seq-fullwidth-arrow` 经 SDK 渲染成功。
  - `sec-newline-split-js` 归一化后**被拦截**（跨行加固生效）。
  - 现有 `npx vitest run` 全绿；`npm run typecheck` 通过。
  - 归一化幂等：`normalize(normalize(x)) == normalize(x)`。

### T02 — Rust 词法器/解析器：边标签转义 + class 独立注解｜P0
- **涉及文件**
  - `crates/xmermaid-parser/src/lexer.rs`：`read_edge_label` 识别 `\|` 转义（不闭合标签）。
  - `crates/xmermaid-parser/src/parser.rs`：边标签转义贯通；独立行 `<<interface>> A` / `<<Service>> A` → 设置 stereotype（复用既有字段，无新 AST 概念）。
  - `crates/xmermaid-parser/tests/`（新增/扩展，如 `parser_ai_tolerance_test.rs`）：转义、独立注解用例。
- **依赖**：T01（共享转义规则；归一化输出即其输入）
- **验收标准**
  - `flow-edge-label-escaped-pipe`、`class-interface-annotation`、`class-stereotype` 渲染成功（`textContent` 含 `a`/`b`、类名）。
  - `cargo test` 全绿。
  - 对照项（`flow-edge-label-entity-pipe`、`class-interface-postfix`）不回归。

### T03 — Rust 解析器/布局：图族结构容错｜P1
- **涉及文件**
  - `crates/xmermaid-parser/src/parser.rs`：state `--`（接受+告警）、c4 `Enterprise_Boundary` 块、treemap 相对缩进、kanban 非 ASCII id、zenuml 声明、quadrant `classDef` 接受 `fill`。
  - `crates/xmermaid-parser/src/ast.rs`：仅在需要新增字段时改动（如 c4 边界类型/嵌套、state 区域标记）；否则保持最小。
  - `crates/xmermaid-layout/src/engine.rs`（+ 按需 `c4.rs`/`kanban.rs`/`treemap.rs`/`zenuml.rs` 等）：让新接受结构进入既有布局路径；无法静态表达的降级为告警。
  - `crates/xmermaid-layout/src/types.rs`：如新增降级标记/诊断载体。
  - `crates/xmermaid-parser/tests/` 与 `crates/xmermaid-layout/` 测试：各图族用例。
- **依赖**：T01
- **验收标准**
  - `state-concurrent`、`c4-boundary`、`treemap-basic`/`treemap-nested`/`treemap-chinese`、`kanban-chinese-id`、`zenuml-participant`、`quadrant-classdef` 渲染成功。
  - 对照项（`treemap-four-space`、`kanban-columns`、`c4-context`、`zenuml-call`）不回归。
  - 任何"降级"必须产生 **warning 诊断**，不静默丢弃。
  - `cargo test` 全绿。

### T04 — 矩阵/文档一致性 + 注入回归断言｜P1
- **涉及文件**
  - `src/support.ts`：按 §4 更新 `quadrant.classes` / `zenuml.declarations` / `c4.boundaries` 措辞与检测逻辑，使"宣称=行为"。
  - `README.md`、`README.zh-CN.md`：同步支持范围描述（不得把计划写成现状）。
  - `tests/support-matrix.test.ts`：断言矩阵条目与实际渲染行为一致。
  - `tests/injection-regression.test.ts`（新增）：§3.3 的逐项注入断言 + `security-leak == 0` 硬断言。
- **依赖**：T01、T03（需行为已定稿才能写匹配文档）
- **验收标准**
  - 矩阵中每条 `supported` 都有对应渲染断言；无"宣称支持却抛错"项。
  - 注入回归测试通过，`security-leak` 计数为 0。
  - `npx vitest run tests/support-matrix.test.ts` 全绿。

### T05 — 集成与端到端回归｜P2
- **涉及文件**
  - `tests/ai-emitted-real-wasm.test.ts`：补充 T01–T03 覆盖的语法为正例（现基线 9/9）。
  - `scripts/ai-syntax-scan/corpus.mjs`：新增各语法 + 注入 payload 探针。
  - `tests/ai-syntax-scan.test.ts`：重跑并断言 gap 数下降、`security-leak == 0`。
  - `docs/ai-syntax-scan.md`：由测试重新生成（不手工编辑）。
- **依赖**：T02、T03、T04
- **验收标准**
  - `npx vitest run tests/ai-syntax-scan.test.ts` 重新生成报告，`throws` 数显著下降，`security-leak == 0`。
  - `npx vitest run tests/ai-emitted-real-wasm.test.ts` 全绿。
  - 全量 `npm test` + `cargo test` 绿。

### 已完成（在途未提交，不在任务清单内，避免重复造）
- sequence 全套箭头（`->`/`-->`/`-x`/`--x`/`<<->>`/`<<-->>`，含旧 `<->`/`<-->`）
- class `direction` 指令、class `note` 接受并跳过
- quadrant 点连线（`A --> B` 接受并跳过）
- mindmap 行内 `::icon`
- 相关文件：`crates/xmermaid-parser/src/{parser.rs,ast.rs}`、`crates/xmermaid-layout/src/{engine.rs,sequence.rs}`、`src/{support.ts,renderer/svg.ts,types/layout.ts}`、`tests/support-matrix.test.ts`；`pkg/` 已重建，`npx vitest run tests/ai-emitted-real-wasm.test.ts` 9/9 绿。
- **注意**：T02/T03 与在途改动同触 `parser.rs`，实现时应在在途改动之上叠加，避免冲突。

---

## 6. 构建与验证约束

### 6.1 WASM 重建（改 Rust 后**必须**执行）
- 实际命令（已在仓库核实）：
  - `npm run build:wasm` → `node scripts/build-wasm.cjs` → `wasm-pack build crates/xmermaid-wasm --out-dir ../../pkg --target web`
  - `npm run build` → `build:wasm --clean-output` + `build:js`（`rollup -c`）+ `node scripts/copy-wasm-dist.cjs`
  - `bash build.sh`（等价串行：wasm-pack → rollup → `cargo test --workspace` → `npx vitest run`）
- 前置依赖：`wasm-pack` 在 PATH；`rustup target add wasm32-unknown-unknown`。

### 6.2 `pkg/` 与 `dist/` 的关系
- `pkg/`：wasm-bindgen 原始产物，**测试直接消费**（`tests/*-real-wasm.test.ts` 与 `tests/ai-syntax-scan.test.ts` import `../pkg/xmermaid_wasm.js` 并读 `pkg/xmermaid_wasm_bg.wasm`）。
- `dist/`：对外发布包（`xmermaid.esm.js`/`xmermaid.cjs` + 由 `copy-wasm-dist.cjs` 拷入的 `xmermaid_wasm_bg.wasm`）。
- **推论**：改 Rust 后，若只 `npm run build:js` 而不重建 `pkg/`，vitest 仍跑旧 wasm → 假绿。**必须先 `npm run build:wasm`**。只改 TS（T01）无需重建 wasm。

### 6.3 测试命令
- Rust：`cargo test`（或 `cargo test --workspace`）
- TS 单测：`npx vitest run`
- 关键回归：`npx vitest run tests/ai-emitted-real-wasm.test.ts`（基线 9/9）
- 扫描/报告：`npx vitest run tests/ai-syntax-scan.test.ts`（重生成 `docs/ai-syntax-scan.md`）
- 矩阵：`npx vitest run tests/support-matrix.test.ts`
- 类型：`npm run typecheck`
- 空白：`git diff --check`

---

## 7. 待明确事项（不确定 / 有取舍）

1. **归一化放 TS 还是 Rust（核心取舍）**：本方案主张 **TS 单一入口归一化**，理由是 TS 门禁（`support.ts`/`security.ts`）在 WASM 之前跑，归一化必须同时被门禁看到；放 Rust 会导致"门禁先挡下"的假修复，且会造成 TS/Rust 两份归一化实现漂移。**代价**：直接调用 WASM（绕过 TS SDK）的消费者不享受归一化。**待定**：是否需要为直连 WASM 的消费者在 `xmermaid-wasm` 入口镜像一份归一化（会增加第二事实源，不推荐）。
2. **诊断 range 与归一化的偏移**：BOM 删除是 0→1 的长度变化，会平移后续所有 offset。方案要求归一化返回 `offsetMap` 以回映原始源。**待定**：是否需要把映射精度做到"列级"（成本更高），还是"行级 + 首行偏移"即可。
3. **`\|` 的单一事实源**：Rust 词法器与 TS `support.ts` 语句切分需同一转义规则，但两语言无法共享代码。**待定**：是否引入一个"跨层一致性测试"（同一语料同时喂两边、断言结论一致）来防止漂移。
4. **state 并发区域 / c4 边界嵌套的降级**：静态 SVG 暂无法完整表达区域线/深层嵌套。**待定**：降级为 warning 是否足够（AGENTS.md 要求"不静默丢语义"），还是本轮先"接受并渲染可见分隔"。
5. **class note 是否渲染**：在途为"接受并跳过"。**待定**：是否进一步把 note 文本渲染为附加标注（更诚实，但需布局支持）。
6. **fence 兜底剥离**：归属为 LIVE 提取层（非渲染器职责）。**待定**：渲染器是否仍加一条"仅在流首/流尾"的保守兜底剥离（P2，低风险但属职责外延）。
7. **扫描测试是否升级为 fail 断言**：当前扫描是诊断型（不因 gap fail）。**待定**：`security-leak == 0` 应升级为**硬断言**（§3.3 建议必须），而 gap 数是否设阈值需与主理人确认。
8. **zenuml/quadrant 采用"改行为"**：依据是"矩阵已宣称支持"。**待定**：若产品侧认为这两个图族优先级低，可退化为"改文档降级"——但需同步 README 与矩阵，且会收窄公开契约。

---

_本文件为设计产出，未修改任何源码；所有归属层与策略结论均可追溯至 `docs/ai-syntax-scan.md` 的实测证据。_
