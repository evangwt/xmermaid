---
doc_type: audit-finding
audit: 2026-05-24-visual-edge-rendering
finding_id: bug-02
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: resolved
resolved_by: 2026-05-25-svg-geometry-regression-suite
---

# Finding 02: step 连线路径没有真正截短到箭头尾部

## 速答

`computeStepPath` 声称会把路径截短到箭头尾部，但生成的 SVG path 最后是 `H {end.x}`，`replacePathEndpoint` 查找的是完整 `{x} {y}`，因此替换失败，线条仍画到 arrow tip。

## 关键证据

- `src/renderer/edge.ts:588` - 两点 step path 固定生成 H-V-H 模式。
- `src/renderer/edge.ts:591` - path parts 最后只包含 `H ${end.x}`，没有完整 endpoint 坐标对。
- `src/renderer/edge.ts:621` - 代码计算了 `arrowBase`。
- `src/renderer/edge.ts:626` - 通过 `replacePathEndpoint(path, end, arrowBase)` 试图替换 endpoint。
- `src/renderer/edge.ts:551` - `replacePathEndpoint` 构造查找串为 `${oldEnd.x} ${oldEnd.y}`。
- `src/renderer/edge.ts:556` - 找不到完整坐标对时直接返回原 path。
- `tests/edge.test.ts:255` - 测试只断言 `pathEnd` 对象，不检查 `result.path` 是否真的被截短。

## 影响

使用 `curveStyle: 'step'` 时，edge path 会继续画到 arrow tip，箭头和线段重叠。结合 finding-01 时，目标端视觉间距和箭头尾部都会不准。

## 修复方向

step path 需要用可替换的最终 `L x y`，或在构造 H/V 命令时直接把最后一段终点设为 `arrowBase`，并从实际最后一段计算箭头角度。

## 建议动作

`cs-issue`，因为这是确定的路径字符串生成 bug，修复范围集中在 `computeStepPath` 和相关测试。
