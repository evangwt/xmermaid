---
doc_type: audit-finding
audit: 2026-05-24-visual-edge-rendering
finding_id: maintainability-06
nature: maintainability
severity: P2
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 06: 测试没有锁定真实 SVG 几何输出

## 速答

当前测试覆盖了 helper 返回对象和 SVG 元素数量，但没有验证最终 path `d`、arrow DOM 元素类型、marker/shape 输出、label 位置等关键视觉几何，因此多处绘制错误能通过测试。

## 关键证据

- `tests/renderer.test.ts:55` - edge renderer 测试只检查存在 path。
- `tests/renderer.test.ts:60` - 断言为 `paths.length >= 1`，没有检查 path `d` 或 arrow 元素。
- `tests/edge.test.ts:255` - step path 截短测试只检查 `pathEnd` 存在。
- `tests/edge.test.ts:263` - 断言 `pathEnd` 的 y 值，但没有检查 `result.path` 是否包含 arrow base。
- `tests/edge.test.ts:355` - open arrow 测试只检查字符串分段数。
- `tests/edge.test.ts:365` - circle arrow 测试只检查字符串包含 radius。

## 影响

视觉细节回归会持续漏测。finding-02 和 finding-03 都属于“helper 看似返回了数据，但最终 SVG 并没有正确画出来”的类型。

## 修复方向

补 DOM 级和 path 字符串级回归测试：检查 step path 最终坐标、open/circle/cross 的 SVG 元素类型、arrow tip 与节点边界关系，以及关键主题下的输出。

## 建议动作

`cs-refactor`，因为这是测试质量和可维护性补强，适合和渲染修复一起推进。
