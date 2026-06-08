# Multi-Diagram Live Editor Harsh Review

> 日期：2026-06-07
> 范围：`multi-diagram-live-editor` roadmap 完成态、visual edit 前后端合同、核心闭环

## Musk 视角：闭环是假的吗？

结论：第一轮不合格，第二轮合格。

- **硬伤 1：parse-only validation 不是 roundtrip。**
  - 发现：roadmap 4.5 要求 visual apply 后执行 `nextSource -> Rust/WASM parse -> render/layout`，但 runtime 原先只在 `validateVisualEditResult()` 里 parse，真实 render 只存在于测试 fixture 和后续 preview。
  - 风险：parse 过但 layout/render 失败的 source 会先污染 document，然后 UI 才报错。这不是 fail-closed，是“先撞墙再告诉用户墙很硬”。
  - 处理：`validateVisualEditResult()` 已补 render/layout gate，失败返回 `visual_render_failed` 并阻断 commit；`tests/live-editor.test.ts` 增加 parse-ok/render-fail 回归测试。

- **硬伤 2：测试如果只 mock AST，等于没测核心风险。**
  - 发现：旧 live editor 测试主要证明 TypeScript helper 工作，不证明 Rust/WASM parser 和 renderer 接得住 serializer 输出。
  - 处理：新增 `tests/visual-roundtrip.test.ts`，直接初始化 `pkg/xmermaid_wasm.js` + `pkg/xmermaid_wasm_bg.wasm`，覆盖 supported shape/style/label、subgraph、direction edit 和 blocked `classDef`。

- **硬伤 3：subgraph 不能吹完整保真。**
  - 发现：当前 parser 的 subgraph 支持是 partial，不能把验收写成完整 membership 保真。
  - 处理：验收只锁“subgraph 仍存在且可 render”，不伪造比 parser 更强的承诺。

## Robo Pike 视角：接口是不是又胖又乱？

结论：勉强合格，有边界。

- **接口新增是必要的，不是装饰。**
  - `FlowchartDslRenderer` / `renderFlowchartDsl` 是为了让 runtime render gate 可测试、可注入；不是泛化炫技。
  - `VisualEditDiagnostic` 里原本已有 `visual_render_failed`，现在终于有真实产生路径。

- **仍然保留 legacy helper，但不能让它做权威。**
  - `parseFlowchartToGraph()` 仍适合简单 helper 和旧测试。
  - visual rewrite 的语义权威必须是 `analyzeFlowchartForVisualEdit()` 的 Rust/WASM AST，不是 regex。

- **复杂度债务没有消失。**
  - `tests/live-editor.test.ts` 已经偏胖，但真实 WASM fixture 已隔离到独立文件，暂不做无关拆分。
  - Visual UI 仍是表单式，不是拖拽画布；这符合 roadmap 边界。

## Merge Verdict

通过，但只因为已修掉 parse-only gate。

当前闭环证据：

- `npm run build`
- `npm test`
- `npm run typecheck`
- `cargo test`
- YAML validate
- Packed Chrome/CDP consumer smoke：visual rename、preview-only direction、source direction edit、unsupported safety gate

剩余限制：

- 不保留原始 Mermaid 注释、空白和格式。
- 不支持完整 Mermaid flowchart 语法。
- Subgraph 支持仍按当前 parser partial 能力声明，不扩大承诺。
