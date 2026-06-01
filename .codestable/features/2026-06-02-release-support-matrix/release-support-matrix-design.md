---
doc_type: feature-design
feature: 2026-06-02-release-support-matrix
requirement:
roadmap: production-readiness
roadmap_item: release-support-matrix
status: approved
summary: 收敛公开定位、支持矩阵、README/package 描述和限制清单
tags: [production, release, support-matrix]
---

# release-support-matrix design

## 0. 术语约定

- **Support matrix**：机器可读的支持范围清单，描述 diagram type 与 syntax capability 的 `supported` / `partial` / `unsupported` 状态。grep 当前代码无同名实现，本 feature 新增该名词。
- **Support report**：针对一段 Mermaid source 的轻量支持判断结果。本 feature 只提供 diagram-level report，不做完整 syntax analyzer。
- **Production contract**：README/package/support matrix 共同表达的对外承诺。防冲突结论：它不是 release verification，也不是完整 architecture doc。

## 1. 决策与约束

### 需求摘要

本 feature 为生产发布第一步：把项目公开承诺从“高性能 Mermaid renderer”收敛为“Rust WASM powered flowchart renderer with partial Mermaid support”，并提供一份可被代码、测试和文档共同引用的 support matrix。

成功标准：

- root public API 导出 support matrix 查询能力。
- package 描述不再暗示完整 Mermaid 替代。
- README 存在并明确当前支持范围、限制和下一步。
- 支持矩阵能区分 flowchart partial support 与 sequence/class/state/ER 等 unsupported diagrams。

明确不做：

- 不实现新的 diagram type。
- 不实现 flowchart class/style/click 等 unsupported syntax。
- 不做 source-range 级 support analyzer；只做最小 diagram-level report。
- 不改 renderer/layout/parser 行为。

### 复杂度档位

走“小型公开 SDK 合同”默认档位，无高并发、持久化或 UI 偏离。偏离点：这是对外 API，因此命名和导出稳定性按生产面处理。

### 关键决策

- **D1：support matrix 用 TS 常量先落地，不从 Rust parser 动态生成。** 当前目标是收敛公开合同，不是重写 parser。动态生成会把 release contract 绑到 parser 内部实现，过早。
- **D2：README/package/support matrix 三者同步测试。** 只改文案没有约束力；测试必须防止 package 描述再次漂回“完全兼容”叙述。
- **D3：只做 diagram-level support report。** Syntax-level analyzer 已拆到 roadmap 后续 `support-analyzer-v1`，本 feature 不偷跑。

### 前置依赖

无。roadmap item `release-support-matrix` 无前置依赖。

## 2. 名词与编排

### 2.1 名词层

#### 现状

- `src/index.ts` 导出 renderer、editor、theme、WASM 和类型，但没有支持范围 API。
- `package.json.description` 是 `"High-performance Mermaid diagram renderer powered by Rust WASM"`，容易被理解成完整 Mermaid renderer。
- 仓库根目录没有 README，消费者无法从包入口看到当前支持范围。

#### 变化

新增支持范围类型和函数：

```ts
// 来源：新增 src/support.ts
type DiagramType = 'flowchart' | 'sequence' | 'class' | 'state' | 'er' | 'gantt' | 'pie' | 'mindmap' | 'unknown';
type SupportStatus = 'supported' | 'partial' | 'unsupported';

interface SyntaxCapability {
  id: string;
  label: string;
  status: SupportStatus;
  notes?: string;
}

interface DiagramSupportEntry {
  diagramType: DiagramType;
  status: SupportStatus;
  supportedSyntax: SyntaxCapability[];
  unsupportedSyntax: SyntaxCapability[];
}

interface SupportMatrix {
  version: string;
  entries: DiagramSupportEntry[];
}

interface SupportReport {
  diagramType: DiagramType;
  status: SupportStatus;
  message: string;
}

function getSupportMatrix(): SupportMatrix;
function getDiagramSupport(diagramType: DiagramType): DiagramSupportEntry | undefined;
function analyzeSupport(source: string): SupportReport;
```

示例：

```ts
getDiagramSupport('flowchart')?.status; // 'partial'
analyzeSupport('sequenceDiagram\n  A->>B: Hi');
// { diagramType: 'sequence', status: 'unsupported', message: 'sequence diagrams are not supported yet.' }
```

### 2.2 编排层

```mermaid
flowchart TD
  A[Consumer imports xmermaid] --> B[getSupportMatrix]
  A --> C[analyzeSupport(source)]
  C --> D{diagram type}
  D -->|flowchart/graph| E[partial flowchart report]
  D -->|known unsupported| F[unsupported report]
  D -->|unknown| G[unknown unsupported report]
```

#### 现状

当前支持范围只隐含在 parser tests 和 docs 中：flowchart 可渲染，sequence/class/state/ER/gantt/pie/mindmap 等在 tests 中作为 unsupported/falsification 存在。没有一个公共 API 或 README 把这些事实统一表达。

#### 变化

- public API 增加 support matrix 查询函数。
- README 使用 support matrix 的同一组术语描述当前能力。
- package description 改为 partial/flowchart-focused 表述。
- 新增测试同时约束 API、README、package 描述，防止三者漂移。

流程级约束：

- support matrix 返回值对调用者不可变：`getSupportMatrix()` 返回深拷贝或只读等价结构，避免消费者修改模块级常量。
- `analyzeSupport()` 不抛异常；空输入和未知输入返回 `unknown` / `unsupported`。
- package 描述不得包含 “fully compatible” 或暗示完整 Mermaid 替代。

### 2.3 挂载点清单

- root public API：`src/index.ts` — 新增 support matrix 函数和类型导出。
- package metadata：`package.json.description` — 修改为真实生产定位。
- root documentation：`README.md` — 新增安装、当前支持范围、限制和 roadmap 指向。

### 2.4 推进策略

1. RED 测试：新增 support matrix/package/README 同步测试，先确认失败。
   退出信号：目标测试因缺少 API/README 或旧描述失败。
2. 名词层实现：新增 support matrix 类型、常量和 diagram-level report。
   退出信号：support matrix 测试通过。
3. 挂载点接入：导出 API、更新 package 描述和 README。
   退出信号：同步测试和 typecheck 通过。
4. 回归验证：跑相关单测、全量 JS 测试和 typecheck。
   退出信号：验证命令全部通过。

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `src/index.ts`：已有导出聚合，追加一组导出即可；不需要拆文件。
- 文件级 — `package.json`：只改 description，不做脚本或依赖调整。
- 目录级 — `src/`：当前按类型分为 `types/`、`renderer/`、`editor/` 和根入口；新增 `src/support.ts` 是顶层公共 SDK 合同，未达到目录摊平阈值。
- 目录级 — repo root：新增 README 是标准包入口，不引入新目录。

##### 结论：不做微重构

本 feature 只新增一个独立 support module 和一个 README，触碰现有文件少且挂载点清晰。结构性问题是 architecture 文档仍含未来愿景叙述，但本 feature 不改 architecture，acceptance 阶段再判断是否归并当前事实。

## 3. 验收契约

关键场景：

- **S1**：调用 `getSupportMatrix()` → 返回版本和 entries，且 flowchart entry 是 `partial`。
- **S2**：调用 `analyzeSupport('graph TD\n  A-->B')` → 返回 `diagramType: 'flowchart'` 和 `status: 'partial'`。
- **S3**：调用 `analyzeSupport('sequenceDiagram\n  A->>B: Hi')` → 返回 `diagramType: 'sequence'` 和 `status: 'unsupported'`，不抛异常。
- **S4**：读取 `package.json.description` 和 README → 都明确 flowchart/partial Mermaid support，不宣称完整 Mermaid 兼容。
- **S5**：消费者可从 root public API import support matrix 函数和类型。

反向核对项：

- 不应新增 sequence/class/state/ER/gantt/pie/mindmap parser 或 renderer 实现。
- 不应修改 layout/render 行为。
- 不应新增 PNG/server/CLI API。

## 4. 与项目级架构文档的关系

本 feature 新增系统级可见的 production support contract。acceptance 阶段需要评估是否把 `Support matrix` 作为当前应用层 / SDK 层能力写入 `ARCHITECTURE.md`，同时记录当前支持范围仍是 flowchart partial support。
