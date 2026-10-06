# `<br/>` 换行标签保真缺陷的修复方案（修订版）

- 状态：设计定稿（本文件只做设计，未修改任何 `crates/**`、`src/**`、`scripts/**`、`tests/**`）
- 目标仓库：XM `/Volumes/Data/Code/xmermaid`（本轮不涉及消费方 LIVE `/Volumes/Data/Code/xmermaid-live`）
- 输入证据：主理人两轮逐族探针实测（**28 族字面 `<br/>`，2 族正确**，`lost=0`）
- 约束：沿用 Rust + TS 技术栈；不改 LIVE；不引入新依赖；任何"标签→文本"处理**不得**让标签变成可信 HTML
- 修订说明：上一版基于"16 族"的不完整证据。本轮主理人补测后，受影响族由 16 修正为 **28**（30 族 − 2 正确），本文件按 12 + 16 重写。行文风格对齐 `docs/ai-syntax-support-plan.md`；所有行号均来自当前源码，可逐条核验

---

## 0. 缺陷定位与判定口径

### 0.1 渲染链（决定了修复层）

XM 的渲染链是 **两级门禁 + 一次解析**（`src/xmermaid.ts`）：

1. `normalizeSource(input)`（`src/xmermaid.ts:34`，`src/normalize.ts`）先归一化文本。
2. `analyzeSupport(source)`（`:37`，`src/support.ts`）与 `detectSecurityDiagnostics(source, policy)`（`:42`，`src/security.ts`）在 **WASM 之前**运行，`severity=error` 直接 throw。
3. 通过后才调用 `wasm.render(...)`（`:121/:123`）→ `crates/xmermaid-wasm` → `xmermaid-parser` → `xmermaid-layout`。
4. 渲染后若 `sanitizeSvg`（`:83`）再跑 `sanitizeSvgElement`（`src/xmermaid.ts:246`）作最后防线。
5. 诊断范围经 `mapDiagnosticsToOriginal` 回映原文。

> **关键结论**：`<br/>` 缺陷发生在 **Rust 解析层**（标签文本未走 sanitize），与 TS 门禁无关。本轮修复**只改 Rust 解析/布局 + 少量 TS 渲染器**，**不新增任何 TS 门禁"放行"语义**。

### 0.2 根因（已确认，不重新论证）

`crates/xmermaid-parser/src/parser.rs` 的 `sanitize_label_text`（**定义于 `:3472`**）负责把标签归一为"显式换行 + 字面字符"，文档注释（`:3464-3471`）明确顺序不可调换：

```rust
fn sanitize_label_text(text: &str) -> String {                       // parser.rs:3472
    let plain = strip_markdown_string_wrapper(
        strip_markup_tags(&convert_br_line_breaks(text)).trim());     // 3473
    let decoded = decode_label_entities(&decode_standard_entities(&plain)); // 3474
    decoded.trim().to_string()
}
```

- `convert_br_line_breaks`（`:3541`）把 `<br>` / `<br/>` / `<br />`（任意大小写）转 `\n`；
- `strip_markup_tags`（`:3571`）剥离 `<b>`/`</b>`/`<span style=…>` 等标记；
- `strip_markdown_string_wrapper`（`:3611`）去 markdown 强调符；
- `decode_standard_entities`（`:3482`）+ `decode_label_entities`（`:3655`）最后解码实体。

**实测调用点仅 7 处，全部落在 flowchart / sequence 路径**（`grep -rn "sanitize_label_text" crates/ src/`）：

| 调用点行号 | 所属函数 | 覆盖 |
| --- | --- | --- |
| `parser.rs:2559` | `parse_subgraph`（`:2427`） | flowchart 子图标题 |
| `parser.rs:2841` | `parse_edge_label`（`:2826`） | flowchart 边标签 |
| `parser.rs:2895` | `parse_node_occurrence`（`:2878`） | flowchart 节点（复用/引用） |
| `parser.rs:2966` | `parse_expanded_shape`（`:2924`） | flowchart `@{shape:…}` |
| `parser.rs:3134` | `parse_flowchart_statement`（`:3039`） | flowchart 语句标签 |
| `parser.rs:5446` | `parse_sequence_note`（`:5396`） | sequence note |
| `parser.rs:5793` | `parse_sequence_message`（`:5725`） | sequence 消息 |

> 交接稿称"8 个调用点"，实测 grep 为 **7 个**（第 8 个匹配是函数定义本身，非调用）。主理人已核验通过。

这解释了为何 **flowchart / sequence 正确**，而其余 **28 族**直接取原文、`<br/>` 被当字面文本画出。

### 0.3 判定口径（用于验收）

探针逐族渲染后读取**可见** `<text>`/`<tspan>` 的 `textContent`（排除 `<title>`/`<desc>`）。期望：可见文本中**出现真实换行**（多 `tspan` / `label_lines` 长度 >1）且**不出现字面 `<br/>`**。主理人补测确认 `lost=0`（注入后标签文本都在，无静默丢失）——这既是"修复前不会更糟"的证据，也说明**只差调用点**的族确实没有丢文本，只是没断行。

---

## 1. 逐图族调用点清单（文件 + 行号 + 函数）

下表逐族给出**标签文本在何处被取出并原样 `to_string()`**（即需要补 `sanitize_label_text` 的位置）。除特别标注外均为 `crates/xmermaid-parser/src/parser.rs`。

### 1.1 走 `flowchart::layout` 的 12 族（多行已支持，只差调用点）

| 图族 | 解析入口 | 标签取出点（行号） | engine.rs 转换点 |
| --- | --- | --- | --- |
| **class** | `parse_class`（`:268`） | 成员 `:294`、`:397`；注解 `:289`、`:492`、`:506`；类名=id（`upsert_class` `:2047` / `add_class_if_new` `:2041`）；关系标签 `parse_class_relation`（`:3793`）落点 `:3810` | `:18` |
| **state** | `parse_state`（`:525`） | 迁移标签 `parse_state_transition`（`:3262`）落点 `:3272`；别名标签 `parse_state_alias`（`:3294`）落点 `:3308`；note 文本 `:560-564`、`:589` | `:99` |
| **er** | `parse_er`（`:735`） | 实体名 `:745`；关系 from/to `:792-793`（`parse_er_relationship` `:3997`）；属性 `parse_er_attributes`（`:4053`，name/kind/comment） | `:164` |
| **architecture** | `parse_architecture`（`:1420`） | group label `:1435`；`parse_architecture_service`（`:4705`）落点 `:4714` | `:240` |
| **user-journey** | `parse_user_journey`（`:895`） | title `:900`；section `:901`；label `:903`；actors `:905` | `:296` |
| **timeline** | `parse_timeline`（`:912`） | title `:917`；section `:918`；period `:920`；event `:922` | `:299` |
| **mindmap** | `parse_mindmap`（`:927`） | `parse_mindmap_node_text`（`:3911`）落点 `:3933` / `:3942` | `:302` |
| **treeview** | `parse_treeview`（`:962`） | `label = raw.trim()`（`:965`） | `:308` |
| **requirement** | `parse_requirement`（`:972`） | 关系标签 `:982`；name `:991`；`text` 属性 `:1012` | `:311` |
| **gitgraph** | `parse_gitgraph`（`:1025`） | commit id `:1048`；tag/type `:1052`（默认 id `format!("commit-{}", …)`） | `:333` ⚠ |
| **c4** | `parse_c4`（`:1106`） | title `:1119`；boundary label `:1147`；element label/description `:1184`；relationship label `:1168` | `:355` |
| **zenuml** | `parse_zenuml`（`:1190`） | 消息标签 `:1227`、`:1242` | `:387` |

> `gitgraph` 标 ⚠：其 `id` 兼作显示标签与节点标识，见 §6 风险。

### 1.2 有自有 layout 模块的 16 族（必须动布局）

| 图族 | 解析入口 | 标签取出点（行号） | layout 模块 / engine.rs |
| --- | --- | --- | --- |
| **gantt** | `parse_gantt`（`:806`） | title `:823`；section `:819`；任务标签 `parse_gantt_task`（`:4261`）落点 `:4364`、`:4377`、`:4396` | `gantt.rs` / `:235` |
| **pie** | `parse_pie`（`:853`） | title `:874`、`:883`；slice 标签 `:887`、`:890` | `pie.rs` / `:236` |
| **xychart** | `parse_xychart`（`:1255`） | title `:1266`；x-axis 标签 `parse_xy_labels`（`:4505`）；x/y title（`parse_xy_axis_declaration` `:4449`） | `xychart.rs` / `:237` |
| **sankey** | `parse_sankey`（`:1322`） | 节点名 `:1338`（`parse_sankey_csv_record` `:4510`） | `sankey.rs` / `:238` |
| **quadrant** | `parse_quadrant`（`:1367`） | title `:1395`；轴标签 `parse_quadrant_axis`（`:4559`）落点 `:4564`；象限标签 `:1406`；点标签 `parse_quadrant_point`（`:4639`）落点 `:4695` | `quadrant.rs` / `:239` |
| **block** | `parse_block`（`:1484`） | `parse_block_cell`（`:4868`）落点 `:4888` | `block.rs` / `:285` |
| **kanban** | `parse_kanban`（`:1995`） | `parse_kanban_item`（`:4958`）落点 `:4963`、`:4970`、`:4975` | `kanban.rs` / `:286` |
| **treemap** | `parse_treemap`（`:1539`） | `parse_treemap_entry`（`:4793`）落点 `:4805` | `treemap.rs` / `:287` |
| **radar** | `parse_radar`（`:1598`） | title `:1618`；轴标签 `parse_radar_named_item`（`:4808`）；curve 标签 `:1632` | `radar.rs` / `:288` |
| **packet** | `parse_packet`（`:1680`） | title `:1695`；`parse_packet_label`（`:4833`）落点 `:4836` | `packet.rs` / `:289` |
| **venn** | `parse_venn`（`:1733`） | title `:1739`；set/union 标签 `parse_venn_named`（`:4840`） | `venn.rs` / `:290` |
| **swimlanes** | `parse_swimlanes`（`:1757`） | lane 标签 `parse_swimlane_lane`（`:4849`）落点 `:4853`；节点标签 `parse_swimlane_node`（`:4855`）落点 `:4859` | `swimlanes.rs` / `:291` |
| **ishikawa** | `parse_ishikawa`（`:1795`） | effect `:1805`；cause 标签 `:1841` | `ishikawa.rs` / `:292` |
| **event-modeling** | `parse_event_modeling`（`:1849`） | frame id `:1872`；entity `:1881` | `event_modeling.rs` / `:293` |
| **wardley** | `parse_wardley`（`:1894`） | title `:1905`；组件标签 `wardley_name`（`:4829`） | `wardley.rs` / `:294` |
| **cynefin** | `parse_cynefin`（`:1943`） | title `:1963`；transition 标签 `:1975`；item `:1989` | `cynefin.rs` / `:295` |

### 1.3 `radar` / `event-modeling` / `venn` 的判定（主理人未实测，本方案读代码判定）

主理人无法用自动注入构造这三族的变体（语料缺 `mustContain` 字面标签）。读代码结论：**三者都受影响、都必须动布局**。

| 图族 | 是否走 flowchart | 标签来源（用户文本？） | 可见文本绘制点 | 结论 |
| --- | --- | --- | --- | --- |
| **radar** | ❌ 自有 `radar.rs`（engine `:288`） | 是：`axis "Label"` / `title`（`parse_radar` `:1618/:1621`） | 轴标签 `svg.ts:702-713` `textContent`；标题 `:746`。curve 标签仅作 `<title>`（不可见） | **需动布局**（轴标签 + 标题多行） |
| **event-modeling** | ❌ 自有 `event_modeling.rs`（engine `:293`） | 是：`tf <id> <type> <entity…>` 的 id/entity（`parse_event_modeling` `:1872/:1881`） | 节点 `format!("{} · {}", id, entity)` 经 `renderNode`；但 `label_lines: vec![]`（`event_modeling.rs:48`）→ 回退单行 | **需动布局**（切行 + LANE_HEIGHT 增长） |
| **venn** | ❌ 自有 `venn.rs`（engine `:290`） | 是：`set`/`union`/`title`（`parse_venn` `:1739/:1741/:1746`） | set 标签 `svg.ts:830`、union `:832`、title `:833`，均 `textContent` | **需动布局**（三处多行） |

> 因此最终划分：**12 族只差调用点 + 16 族必须动布局 = 28 族受影响**（30 族 − flowchart/sequence 2 族正确）。

---

## 2. 布局是否支持多行（关键）

**这是本缺陷的真正难点**：只把 `<br/>` 换成 `\n`，若布局/渲染忽略 `\n`，文本会静默挤成一行（SVG `<text>` 内 `\n` 被折叠为空白），**比现在更糟**。逐族核查结果：

### 2.1 走 `flowchart::layout`（多行已支持）——共 12 族

`flowchart.rs` 的 `wrap_label`（**`:298`**）按 `\n` 切行（**`:305`** `for explicit_line in normalized.split('\n')`），`label_size`（`:420`）/ `node_size`（`:442`）按行数计算包围盒；`renderNode`（`svg.ts:1255`）用 `node.label_lines`，`setTextLines`（`svg.ts:2007`）多行时生成多个 `tspan`。以下 12 族经 `engine.rs` 转成 `FlowchartAst`，标签最终走 `wrap_label`：`class`(18)、`state`(99)、`er`(164)、`architecture`(240)、`user-journey`(296)、`timeline`(299)、`mindmap`(302)、`treeview`(308)、`requirement`(311)、`gitgraph`(333)、`c4`(355)、`zenuml`(387)。

**子图/边界标题是例外**：`subgraph_boxes` 的标题在 **`svg.ts:189-199`**（`label.textContent = box.label`，`:191`）单行绘制。因此 `c4` 的 boundary label、`architecture` 的 group label **即使含 `\n` 也不会分行**。本次报告的 c4/architecture 缺陷均来自**节点标签**（已 OK），子图标题属"顺带加固"，需改渲染器。

### 2.2 `LayoutNode` 但 `label_lines` 为单元素/空——共 4 族（小改）

| 图族 | 布局文件 | 现状 | 需要的改动 |
| --- | --- | --- | --- |
| gantt | `gantt.rs` | `label = format!("{} · {}", section, label)`（`:35`）后 `label_lines: vec![label]`（`:59`）；`label_size` 只量单行（`:36`） | 按 `\n` 切行填 `label_lines`；按行数增长 `ROW_HEIGHT`（`:6`，70）与任务条高度 |
| block | `block.rs` | `BlockLayout.label`（`:16`）单串；渲染器 `svg.ts:533` 写死 `label_lines: [block.label]` | `BlockLayout` 增 `label_lines`（或渲染器切行）；`CELL_HEIGHT`（`:5`，72）按行数增长 |
| swimlanes | `swimlanes.rs` | 节点 `label_lines: vec![]`（`:19`，回退单行）；lane 标题 `textContent`（`svg.ts:1055`） | 节点切行；lane 标题改 `setTextLines`；`LANE_HEIGHT`（`:5`，146）增长 |
| event-modeling | `event_modeling.rs` | 节点 `label_lines: vec![]`（`:48`）；lane 标题为**硬编码常量**（`:8-12`） | 节点切行；`LANE_HEIGHT`（`:5`，116）增长 |

### 2.3 自有布局、纯字符串标签、`textContent` 直绘——共 12 族（必须动布局）

| 图族 | 布局文件（行数） | 渲染器直绘点 | 需要的改动 | 改造量 |
| --- | --- | --- | --- | --- |
| xychart | `xychart.rs`（**237**） | `addText`→`textContent`（`svg.ts:302-337`） | title/x_labels/x_title/y_title 多行；x_labels 在**按槽位算的坐标**上（`:316-334`），需轴边距（`PLOT_BOTTOM/PLOT_LEFT`）与槽高重算 | **高** |
| sankey | `sankey.rs`（82） | 节点标签 `textContent`（`svg.ts:433-444`） | `SankeyNode` 增 `label_lines`；节点**高度随流量缩放**（`sankey.rs:55`），多行需在变高节点内垂直居中/改锚点 | **中高** |
| ishikawa | `ishikawa.rs`（43） | cause `textContent`（`svg.ts:934`）；effect `:953` | 分支标签位置由固定偏移（`±122`/`±42`，`ishikawa.rs:24/28`）决定；effect 盒固定 128×62（`:36`）→ 需偏移/盒高增长 | **中** |
| kanban | `kanban.rs`（31） | `appendKanbanText`→`setTextLines([value])`（`svg.ts:1226-1235`） | 列/任务增 `label_lines`；`HEADER_HEIGHT`(46)/`TASK_HEIGHT`(64) 增长 | 中 |
| treemap | `treemap.rs`（95） | `textContent`（`svg.ts:635-644`） | `TreemapNodeLayout` 增 `label_lines`；单元格高度与 `GROUP_LABEL_HEIGHT`(22) 核算 | 中 |
| packet | `packet.rs`（36） | `textContent`（`svg.ts:803-814`） | `PacketFieldLayout` 增 `label_lines`；`ROW_HEIGHT`(56) 增长 | 中 |
| quadrant | `quadrant.rs`（32） | `appendQuadrantText`→`textContent`（`svg.ts:514-521`） | 点/象限/轴/标题多行；点标签锚点改多行居中 | 中 |
| radar | `radar.rs`（53） | 轴标签 `textContent`（`svg.ts:702-713`）；标题 `:746` | `RadarAxisLayout` 增 `label_lines`；`LABEL_RADIUS`(212) 与边距增长 | 中 |
| venn | `venn.rs`（20） | set/union/title `textContent`（`svg.ts:830/832/833`） | `VennSetLayout/VennUnionLayout` 增 `label_lines`；圆心/半径不变，仅文本多行 | 中低 |
| wardley | `wardley.rs`（23） | 组件标签 `textContent`（`svg.ts:1017`）；标题 `:1021` | 组件盒固定 96×32（`svg.ts:1015`）→ 按行数增高 | **低** |
| cynefin | `cynefin.rs`（49） | `textContent`（`svg.ts:853-860`） | `CynefinItemLayout` 增 `label_lines`；`DOMAIN_HEIGHT`(226) 内 items 按行数累计 | 中 |
| pie | `pie.rs`（9） | `textContent`（`svg.ts:252-271`） | `PieSlice` 增 `label_lines`；扇区外标签与 `showData` 图例行高/`dimensions` 核算 | 中低 |

> **划分定论**：**12 族"只差调用点"**（§1.1），**16 族"必须动布局"**（§2.2 的 4 族小改 + §2.3 的 12 族）。其中 gantt/block/swimlanes/event-modeling 只需切行+高度；xychart/sankey/ishikawa 最麻烦。

---

## 3. 安全不变量（不可退让）

任何改动**不得**让标签变成可信 HTML。实现层必须复用既有 `sanitize_label_text`（不重写、不调整顺序），从而天然保持下列语义：

### 3.1 必须保持的语义

| 不变量 | 机制 | 证据锚点 |
| --- | --- | --- |
| `&lt;br/&gt;`（实体转义）**保持字面文本**，**不**变换行 | `convert_br_line_breaks` 只认字面 `<br`；实体解码在**最后**，`&lt;br/&gt;` 到解码阶段才变 `<br/>` 字面文本 | `parser.rs:3473-3474`；测试 `syntax_coverage_test.rs:638-639` |
| `<script>` / `<img onerror>` / `<foreignObject>` 等**继续被剥离**为惰性文本 | `strip_markup_tags`（`:3571`）在实体解码**之前**运行，标签被移除而非复活 | `syntax_coverage_test.rs:627-644`；扫描 `security-leak 0` |
| 裸 `<` 不吞掉整行 | `strip_markup_tags` 要求标签在**同一行、有界跨度（128）**内闭合 | `parser.rs:3571-3605`；测试 `:640-641` |
| 诊断 range 可回映原文 | 不改 TS 归一化；Rust 只改标签内容，不影响 token 位置 | `src/xmermaid.ts:42` `mapDiagnosticsToOriginal` |

### 3.2 禁止事项

1. **不得**在 Rust 侧新增任何"放行 / 信任 HTML"语义；标签**永远**只走纯文本通道。
2. **不得**把 `sanitize_label_text` 拆成"先解码实体、后剥标签"等任何换序实现（会把 `&lt;script&gt;` 复活成活标签）。
3. **不得**在解析层引入解码新路径（不新增 `%xx`、`\u` 解码）；新增族只复用同一函数。
4. **不得**改动 TS 门禁（`support.ts`/`security.ts`）的拦截语义；`<br/>` 缺陷与门禁无关。
5. **保留三层防线**：TS 门禁 + Rust 纯文本 + 渲染后 `sanitizeSvgElement`（`src/xmermaid.ts:246`），任一层不删。
6. 每个新增族都要有"**同语法 + 注入 payload**"断言（见 §7），证明新通道不是新注入面。

### 3.3 一个易错点

`mustContain`/`mustNotContain` 的语料里，**`&lt;br/&gt;` 探针的期望输出是字面 `<br/>`**（这是正确的惰性文本，不是缺陷）。因此该类探针**不得**设置 `mustNotContain: ['<br/>']`（详见 §5.3）。

---

## 4. 契约一致性（`src/support.ts` 支持矩阵）

现状：**只有** `flowchart.htmlLabel` 宣称该契约——

```ts
// src/support.ts:127
{ id: 'flowchart.htmlLabel',
  label: 'HTML labels sanitized to plain text with <br> line breaks (never rendered as markup)',
  status: 'supported' },
```

而 `AGENTS.md`「Security Contract」也把它当作**全局事实**（"HTML labels are not gated: the parser sanitizes them to plain text and line breaks"）。

**推荐：扩展契约（改行为），而非收窄。** 理由：

1. **矩阵是公开契约**：`<br/>` 是 Mermaid 通用标签语法，用户会跨族使用；只 flowchart 支持会造成"同语法不同结果"的困惑。
2. **修复成本可分层**：12 族本就"只差调用点"，另 16 族加布局支持即可全量覆盖；不存在无法实现的技术障碍。
3. **收窄代价更高**：若只保留 flowchart，需在其余 27 族显式报错或文档降级，制造大量"宣称 vs 行为"缺口，与 `AGENTS.md`「不要扩展支持声明」的**反向**目标一致——应让**行为追上已宣称的通用语义**。

**落地方式**（二选一，推荐 A）：

- **A（推荐）**：新增**跨族**条目 `labels.htmlSanitized`，label 写明"`<br>` 变真实换行；其余标记剥离为纯文本；实体转义保持字面"，各族 `supportedSyntax` 引用；保留 `flowchart.htmlLabel` 作为 flowchart 别名。
- **B**：逐族新增 `<family>.htmlLabel` 条目（粒度细、重复度高）。

无论哪种，均须同步 `tests/support-matrix.test.ts` 的"宣称=行为"断言，并更新 `README.md` / `README.zh-CN.md`（**不得把计划写成现状**，按 `AGENTS.md`）。

---

## 5. 扫描（gap scan）升级设计

现状：`scripts/ai-syntax-scan/{corpus.mjs,harness.mjs,run.mjs}` + `tests/ai-syntax-scan.test.ts`。判定只有 `renders | throws | silent-drop | security-blocked | security-leak`（`harness.mjs:186` `VERDICT_ORDER`）。语料条目支持 `mustContain`（必须出现）与 `expect`（文档化预期）。阈值：`RENDERS_FLOOR=205` / `THROWS_CEILING=19` / `SILENT_DROP_CEILING=1`（`tests/ai-syntax-scan.test.ts:43-45`）。

**为什么现有扫描看不见本缺陷**：字面 `<br/>` 也是"文本存在"，`mustContain: ['line1','line2']` 仍满足（现有 flowchart 探针 `corpus.mjs:330-332`），故判定仍是 `renders`。

### 5.1 扩展方案：新增 `mustNotContain` + 新判定 `literal-markup`

**语料侧**（`corpus.mjs`）：新增可选字段

```js
mustNotContain?: string[]   // 这些子串不得出现在可见文本里；出现即内容保真缺陷
```

**分类器侧**（`harness.mjs`）：

1. 在 `VERDICT_ORDER`（`:186`）加入 `'literal-markup'`。
2. 在 `classifyOutcome` 的 **非安全分支**（`renders` 判定处，`:159-167`）插入：

```js
const forbidden = (entry.mustNotContain || []).filter(token => text.includes(token));
if (forbidden.length > 0) {
  row.verdict = 'literal-markup';
  row.detail = `literal markup in visible text: ${forbidden.join(', ')}`;
  return row;
}
```

3. `buildReport`（`:207`）：把 `literal-markup` 纳入结果词汇（`:223-225`）与 Summary 表；`nonRendering`（`:210`）已按 `!== 'renders'` 过滤，**自动进入 Gaps 表**，无需额外改。

### 5.2 为什么不会误报现有安全探针（关键）

**安全探针在 `classifyOutcome` 中提前 return**（`:151-157`，`entry.security` 分支），根本不进入 `mustContain`/`mustNotContain` 求值。因此 `sec-script-tag-label`（`corpus.mjs:1628`）、`sec-img-onerror`（`:1636`）、`sec-br-then-script`（`:1676`）等**永不受**影响；且这些探针**不设置** `mustNotContain`，即便未来调整分支顺序也不会被误判。

**进一步**：`mustNotContain` 的判据**只应**用**已知换行 token**（`'<br/>'`、`'<br>'`、`'<br />'`）——它们恰好是**本应被消费掉**的语法，安全探针从不把它们写进标签。

### 5.3 语义边界（避免把"正确"误判为"缺陷"）

- **缺陷探针**：源里写**未转义** `<br/>`，配 `mustContain: ['Line one','Line two']` + `mustNotContain: ['<br/>']` → 期望修复后为 `renders`。
- **对照探针**：源里写**实体转义** `&lt;br/&gt;`，期望输出**字面 `<br/>`**；该探针**只设** `mustContain: ['<br/>']`，**不设** `mustNotContain`（否则会把正确行为判成缺陷）。
- **安全探针**：`security: true`，走独立分支，恒不参与 `mustNotContain`。

### 5.4 对既有阈值数字的影响与调整（修正）

阈值公式：`RENDERS_FLOOR_new = RENDERS_FLOOR_old + (修复后转为 renders 的新增探针数)`。原按 16 族的 `205→221` **作废**，按 28 族修正如下：

1. **受影响族加 28 条缺陷探针**（每族 1 条，`mustNotContain: ['<br/>']`）：修复后 +28 → `RENDERS_FLOOR` **205 → 233**。
2. **推荐再加 2 条对照探针**（flowchart、sequence 各 1，正向控制，防这两族回归）：修复后 +30 → `RENDERS_FLOOR` **205 → 235**。
3. **新增 `LITERAL_MARKUP_CEILING`**：修复前锁 **28**（诚实记录已知缺口，随各批修复逐步下调），修复后 **0**（硬断言：任何字面 `<br/>` 回归即 fail）。
4. `THROWS_CEILING` / `SILENT_DROP_CEILING`：**不变**（本缺陷不涉及 throws / silent-drop）。
5. `security-leak` 硬断言（`tests/ai-syntax-scan.test.ts:158-161`）：**不变**，恒为 0。

> 注：主理人给出的"205→235（25 族）/205→240（30 族）"中，**235** 与"全 30 族各加 1 条 → 205+30"一致（推荐值）；"25 族→235"疑为笔误（25 族应为 230）。本方案以公式为准，最终数字随语料实际条数在 T01 落地时锁定。

---

## 6. 分批与风险

按"布局改动量 / 风险"分 4 批（批内可并行，批间线性：后者依赖前者的 `types.rs`/渲染器约定）。

### 批 1（P0，低风险，只差调用点）— 12 族
`class`、`state`、`er`、`architecture`、`user-journey`、`timeline`、`mindmap`、`treeview`、`requirement`、`gitgraph`、`c4`、`zenuml`
- **改动**：仅在各 parser 取出点套 `sanitize_label_text`（§1.1）。布局走 `flowchart::layout`，多行天然支持。
- **验收**：逐族探针可见文本出现真实换行、无字面 `<br/>`；`syntax_coverage_test.rs:626-644` 扩测这 12 族；flowchart/sequence 不回归。
- **风险**：低。`gitgraph` 见下；`c4`/`architecture` 的**子图标题**为可选加固（改 `svg.ts:189-199`）。

### 批 2（P1，LayoutNode 切行 + 高度）— 4 族
`gantt`、`block`、`swimlanes`、`event-modeling`
- **改动**：`gantt.rs:59` / `block.rs` + `svg.ts:533` / `swimlanes.rs:19` / `event_modeling.rs:48` 按 `\n` 切行；`ROW_HEIGHT`(70)/`CELL_HEIGHT`(72)/`LANE_HEIGHT`(146/116) 按行数增长；swimlanes lane 标题改 `setTextLines`。
- **验收**：高度随行数增长、多行居中；单行用例尺寸不回归。
- **风险**：中。高度增长会改变 `dimensions`，需确认不影响既有尺寸断言。

### 批 3（P1/P2，纯字符串布局，简单到中）— 9 族
`kanban`、`treemap`、`packet`、`quadrant`、`cynefin`、`pie`、`radar`、`venn`、`wardley`
- **改动**：`types.rs` 为对应 Layout 结构增 `label_lines`；渲染器改走 `setTextLines`；各布局按行数核算包围盒/行高。
- **验收**：换行且不越界、不裁剪；小单元格（treemap 叶、quadrant 点、wardley 组件盒）在行数增加时行为明确（增长或截断，不得静默丢失）。
- **风险**：中。

### 批 4（P2，复杂布局）— 3 族
`xychart`、`sankey`、`ishikawa`
- **改动**：`xychart.rs` 轴标签槽位与轴边距重算（`svg.ts:302-337`）；`sankey.rs` 变高节点内标签垂直居中（`svg.ts:433-444`）；`ishikawa.rs` 分支偏移/effect 盒增长（`svg.ts:934/953`）。
- **验收**：多行不重叠、不溢出图幅；轴/节点/分支几何自洽。
- **风险**：**最高**（见下）。

### 新增 5 个自绘布局族的改造量排序（主理人点名）
**xychart（237 行，轴槽位+边距）> sankey（82 行，变高节点内居中）> ishikawa（43 行，固定几何偏移）> swimlanes（31 行，lane 标题+节点空 label_lines）> wardley（23 行，固定 96×32 盒增高）**。
- `xychart`/`sankey` 明显比 `pie.rs`（9 行）麻烦：前者标签落在**计算坐标**上、后者节点**高度随流量变化**，都不是"加个字段切行"就能了事。
- `swimlanes`/`event-modeling` 复用同一 `SwimlaneLaneLayout`（`event_modeling.rs:28`），改造应**同批同约定**，避免两处漂移。

### 最大风险点（单点）
**批 3 + 批 4 的 `types.rs` + 渲染器契约**：一旦 `label_lines` 字段与 `setTextLines` 的语义在 16 个模块间不一致（某族仍传单元素数组、或行高与包围盒不同步），会出现"换行了但被裁剪/溢出"的**新静默缺陷**。缓解：先在 `types.rs` 定统一约定（`label_lines: Vec<String>` 非空、`label` 保留为 `join("\n")` 兼容字段），再逐族接入，每族配一条布局单测。

### 复核风险点（主理人要求给文件+行号证据）

1. **`wrap_label` 已按 `\n` 切行**：`crates/xmermaid-layout/src/flowchart.rs:298`（`fn wrap_label`）、**`:305`**（`for explicit_line in normalized.split('\n')`）。证据成立。
2. **子图标题仍单行**：`src/renderer/svg.ts:189-199`，其中 `:191` `label.textContent = box.label`（无 `setTextLines`）。证据成立 → c4 boundary / architecture group 标题需额外改渲染器。
3. **gitgraph `id` 兼作显示标签、含 `\n` 可能破坏精确匹配**：`parser.rs:1048`（取 id）、`:1049`（重复检测 `commit.id == id`）、`:1052`（存入）、**`:1075`（cherry-pick 精确查找 `commits.iter().find(|commit| commit.id == target_id)`）**；显示侧 `engine.rs:343`（`id: commit.id.clone()` + `format!("{}\n{}{}", commit.id, …)`）、`:347`（parents 引用 id）。**推荐**：为 `GitCommit` 增 `display_label`（或等价字段），id 保持原文用于标识，仅对显示串 sanitize；**次选**：直接 sanitize id 并接受 id 含 `\n`（风险低但非零）。

---

## 7. 测试策略

### 7.1 Rust 侧
- **解析**：扩展 `crates/xmermaid-parser/tests/syntax_coverage_test.rs` 的 `test_html_labels_are_sanitized_to_text`（`:626-644`，现仅覆盖 flowchart）——对 28 族各加断言：`label` 含 `\n` 且**不含** `<br`；保留现有 4 条不变量断言（`&lt;b&gt;` 字面、裸 `<`、`<b>` 剥离）。
- **布局**：在 `crates/xmermaid-layout/tests/`（`layout_comprehensive_test.rs` / `layout_deep_test.rs`）为批 2/3/4 各族加断言：`label_lines.len() > 1` 且包围盒高度随行数增长。
- **回归**：`cargo test --workspace` 全绿。

### 7.2 TS 侧
- `tests/syntax-upgrade-real-wasm.test.ts`（已有 `layoutFor` 辅助，`:36`）：把 §1 各族探针补为"label 含 `\n`"正例。
- `tests/support-matrix.test.ts`：断言 §4 新增/修改的矩阵条目"宣称=行为"。
- **注入回归**：新增"同语法 + payload"断言（`<br/>` 与 `<script>`/`<img onerror>` 混排 → 可见文本无 `<br/>`、无活标签）。

### 7.3 扫描
- `scripts/ai-syntax-scan/corpus.mjs` 加 §5.4 的 28+2 条探针；`tests/ai-syntax-scan.test.ts` 加 `LITERAL_MARKUP_CEILING` 并调 `RENDERS_FLOOR`；重生成 `docs/ai-syntax-scan.md`（由测试写入，不手工编辑）。

### 7.4 构建（**硬性提醒**）
- **改 Rust 后必须 `npm run build:wasm` 重建 `pkg/`**（`wasm-pack build crates/xmermaid-wasm --out-dir ../../pkg --target web`）。`pkg/` 是 vitest 直连的 WASM（`tests/*-real-wasm.test.ts` 与 `tests/ai-syntax-scan.test.ts` import `../pkg/xmermaid_wasm.js`）；**只 `build:js` 不重建 `pkg/` 会跑旧 wasm = 假绿**。
- 全量 TS：`npx vitest run --no-file-parallelism`（约 39 文件 / 624 例，约 10 分钟；**必须**加该参数才稳定）。
- 其它：`npm run typecheck`、`git diff --check`。
- 本机 zsh 会打印一行无害的 `/etc/zshenv:2: parse error near 'disown'`，可忽略。

---

## 8. 非目标（本次不做）

1. **不**把标签渲染为可信 HTML，**不**新增任何 `href`/`click`/`style:url()` 出口。
2. **不**修改 `sanitize_label_text` 的处理顺序或语义；**不**新写一份等价函数。
3. **不**改动 TS 门禁（`support.ts`/`security.ts`）的拦截逻辑，**不**新增"放行"语义。
4. **不**触碰消费方 LIVE 仓库；**不**改发布包 `dist/`（除非另行发布流程）。
5. **不**实现 Mermaid 的完整 markdown/HTML 渲染（只做"剥离为纯文本 + `<br>` 换行"）。
6. **不**新增图族或新语法特性；**不**改诊断码体系。
7. **不**顺带重排/美化无关代码；改动限定在标签通道与必要布局/渲染点。
8. **不**把 c4 boundary / architecture group 子图标题的换行作为本次**硬性**目标（列为批 1 可选加固）。

---

## 附 A. 关键文件与行号索引（便于实现时定位）

| 关注点 | 位置 |
| --- | --- |
| `sanitize_label_text` 定义 | `crates/xmermaid-parser/src/parser.rs:3472` |
| `convert_br_line_breaks` / `strip_markup_tags` / `strip_markdown_string_wrapper` | `parser.rs:3541` / `:3571` / `:3611` |
| `decode_standard_entities` / `decode_label_entities` | `parser.rs:3482` / `:3655` |
| 现有 7 个调用点 | `parser.rs:2559/2841/2895/2966/3134/5446/5793` |
| flowchart 多行实现 | `crates/xmermaid-layout/src/flowchart.rs:298(wrap_label)`, `:305(split('\n'))`, `:420(label_size)` |
| 12 族→flowchart 转换 | `engine.rs:18(class)/99(state)/164(er)/240(architecture)/296(user-journey)/299(timeline)/302(mindmap)/308(treeview)/311(requirement)/333(gitgraph)/355(c4)/387(zenuml)` |
| 16 族自有模块 | `engine.rs:235(gantt)/236(pie)/237(xychart)/238(sankey)/239(quadrant)/285(block)/286(kanban)/287(treemap)/288(radar)/289(packet)/290(venn)/291(swimlanes)/292(ishikawa)/293(event-modeling)/294(wardley)/295(cynefin)` |
| 单行渲染点（需改） | `svg.ts:191(子图标题)`、`:533(block)`、`:514(quadrant)`、`:643(treemap)`、`:805(packet)`、`:853(cynefin)`、`:253/271(pie)`、`:1226(kanban)`、`:702(radar)`、`:830/832/833(venn)`、`:1017(wardley)`、`:934/953(ishikawa)`、`:433(sankey)`、`:302-337(xychart)`、`:1055(swimlanes)` |
| 多行渲染器 | `src/renderer/svg.ts:2007(setTextLines)`, `:1255(renderNode)` |
| 契约 | `src/support.ts:127(flowchart.htmlLabel)` |
| 扫描 | `scripts/ai-syntax-scan/harness.mjs:186(VERDICT_ORDER)`, `:151-167(classifyOutcome)`；`tests/ai-syntax-scan.test.ts:43-45(阈值)` |
| 既有 `<br>` 断言 | `crates/xmermaid-parser/tests/syntax_coverage_test.rs:626-644` |

## 附 B. 任务分解（按依赖，≤5）

> 与 §6 分批对应；每任务 ≥3 个相关文件；T01 打底。

- **T01 — 扫描门禁与判定升级（打底）｜P0**
  - 文件：`scripts/ai-syntax-scan/harness.mjs`、`scripts/ai-syntax-scan/corpus.mjs`、`tests/ai-syntax-scan.test.ts`
  - 依赖：无
  - 验收：新增 `mustNotContain` + `literal-markup`；28+2 条探针入库；`LITERAL_MARKUP_CEILING=28`；`security-leak==0` 硬断言保持。

- **T02 — 纯调用点修复（批 1，12 族）｜P0**
  - 文件：`crates/xmermaid-parser/src/parser.rs`、`crates/xmermaid-parser/tests/syntax_coverage_test.rs`、（gitgraph）`crates/xmermaid-parser/src/ast.rs` + `crates/xmermaid-layout/src/engine.rs`
  - 依赖：无（可与 T01 并行）
  - 验收：12 族标签换行；flowchart/sequence 不回归；`cargo test --workspace` 绿。

- **T03 — LayoutNode 切行 + 高度（批 2，4 族）｜P1**
  - 文件：`crates/xmermaid-layout/src/{gantt,block,swimlanes,event_modeling}.rs`、`crates/xmermaid-layout/src/types.rs`、`src/renderer/svg.ts`
  - 依赖：T02
  - 验收：4 族多行且高度增长；单行尺寸不回归。

- **T04 — 纯字符串布局（批 3，9 族）｜P1**
  - 文件：`crates/xmermaid-layout/src/{kanban,treemap,packet,quadrant,cynefin,pie,radar,venn,wardley}.rs`、`crates/xmermaid-layout/src/types.rs`、`src/renderer/svg.ts`
  - 依赖：T03（`types.rs`/渲染器约定）
  - 验收：9 族换行、不裁剪、不静默丢失；逐族布局单测绿。

- **T05 — 复杂布局 + 契约/文档 + 全量回归（批 4，3 族）｜P2**
  - 文件：`crates/xmermaid-layout/src/{xychart,sankey,ishikawa}.rs`、`crates/xmermaid-layout/src/types.rs`、`src/renderer/svg.ts`、`src/support.ts`、`tests/support-matrix.test.ts`、`README.md`、`README.zh-CN.md`
  - 依赖：T04
  - 验收：3 族多行几何自洽；矩阵"宣称=行为"；`LITERAL_MARKUP_CEILING=0`、`RENDERS_FLOOR=235`；`npm run build:wasm` 后 `npx vitest run --no-file-parallelism` 全绿。

---

_本文件为设计产出，未修改任何源码；所有行号与结论均可逐条回到当前源码核验。_
