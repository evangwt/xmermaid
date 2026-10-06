# AI-emitted Mermaid syntax — renderer gap scan

- Generated: 2026-10-06T12:57:26.025Z
- Renderer: `@evangwt/xmermaid@0.4.2` (Mermaid compatibility target 11.16.0)
- Corpus: 266 probes across 30/30 documented families
- Reproduce: `npx vitest run tests/ai-syntax-scan.test.ts`

Result vocabulary: `renders` (clean), `throws` (rejected, message captured),
`literal-markup` (declared substring — e.g. a raw `<br/>` — survived into the
visible text instead of being consumed), `silent-drop` (SVG produced but content
lost), `security-blocked` (policy rejected), `security-leak` (injection probe that
rendered executable content — must stay at zero).

## Summary

| Verdict | Count |
| --- | ---: |
| renders | 219 |
| literal-markup | 16 |
| silent-drop | 1 |
| security-blocked | 11 |
| throws | 19 |
| security-leak | 0 |
| **total** | **266** |

## Coverage by family

| Family | Probes | renders | non-renders |
| --- | ---: | ---: | ---: |
| flowchart | 76 | 60 | 16 |
| swimlanes | 4 | 3 | 1 |
| sequence | 22 | 22 | 0 |
| class | 16 | 15 | 1 |
| state | 11 | 11 | 0 |
| er | 5 | 5 | 0 |
| user-journey | 4 | 4 | 0 |
| gantt | 9 | 8 | 1 |
| pie | 6 | 5 | 1 |
| quadrant | 9 | 6 | 3 |
| requirement | 4 | 4 | 0 |
| gitgraph | 5 | 5 | 0 |
| c4 | 5 | 5 | 0 |
| mindmap | 9 | 7 | 2 |
| timeline | 5 | 5 | 0 |
| zenuml | 6 | 5 | 1 |
| sankey | 6 | 2 | 4 |
| xychart | 6 | 5 | 1 |
| block | 6 | 4 | 2 |
| packet | 5 | 4 | 1 |
| kanban | 8 | 5 | 3 |
| architecture | 5 | 4 | 1 |
| radar | 4 | 3 | 1 |
| event-modeling | 4 | 3 | 1 |
| treemap | 6 | 5 | 1 |
| venn | 5 | 3 | 2 |
| ishikawa | 3 | 2 | 1 |
| wardley | 4 | 2 | 2 |
| cynefin | 5 | 4 | 1 |
| treeview | 3 | 3 | 0 |

## Gaps — every non-`renders` probe

| Family | Variant | Verdict | Evidence |
| --- | --- | --- | --- |
| flowchart | fence naming another language (```js) | throws | UNSUPPORTED_DIAGRAM: Unknown diagram type is not supported yet. |
| flowchart | unterminated node label | throws | RENDER_ERROR: Flowchart labels cannot be unterminated; add the matching closing delimiter. |
| class | note for A "..." (documented skip) | silent-drop | missing text: hello |
| zenuml | if block (documented unsupported) | throws | RENDER_ERROR: ZenUML blocks, async messages, and advanced control syntax are not supported yet. |
| sankey | cyclic flow (documented unsupported) | throws | RENDER_ERROR: Sankey diagrams cannot contain cycles. |
| sankey | config block (documented unsupported) | throws | RENDER_ERROR: Sankey configuration directives are not supported yet. |
| sankey | non-numeric weight | throws | RENDER_ERROR: Sankey values must be finite positive numbers. |
| block | nested block (documented unsupported) | throws | RENDER_ERROR: Block nesting, block arrows, custom shapes, classes, styles, configuration, and edge labels are not supported yet. |
| kanban | metadata key beyond ticket (documented unsupported) | throws | RENDER_ERROR: Kanban task metadata beyond `ticket` is not supported yet. |
| architecture | align directive (documented unsupported) | throws | RENDER_ERROR: Architecture alignment directives, configuration, icon glyphs, and junctions inside groups are not supported yet. |
| wardley | evolve directive (documented unsupported) | throws | RENDER_ERROR: Wardley evolution, pipelines, annotations, strategies, styles, and configuration are not supported yet. |
| flowchart | javascript: URL in edge label | security-blocked | diagnostics=security_blocked_url |
| flowchart | javascript: URL in node label | security-blocked | diagnostics=security_blocked_url |
| flowchart | click with javascript: URL | security-blocked | diagnostics=security_blocked_click,security_blocked_url |
| flowchart | click with https URL (strict blocks all clicks) | security-blocked | diagnostics=security_blocked_click |
| flowchart | classDef fill:url(#ref) | throws | RENDER_ERROR: Flowchart classDef statements support fill, stroke, color, stroke-width, stroke-dasharray, and cosmetic properties with valid values. |
| flowchart | classDef fill:url(javascript:) | throws | RENDER_ERROR: Flowchart classDef statements support fill, stroke, color, stroke-width, stroke-dasharray, and cosmetic properties with valid values. |
| flowchart | style fill:url(javascript:) | throws | RENDER_ERROR: Flowchart style statements only support fill, stroke, and color with safe color values plus numeric stroke-width and stroke-dasharray. |
| flowchart | data:text/html URL in node label | security-blocked | diagnostics=security_blocked_url |
| flowchart | vbscript: URL in node label | security-blocked | diagnostics=security_blocked_url |
| flowchart | javascript: split across newline | security-blocked | diagnostics=security_blocked_url |
| flowchart | javascript: split by tab | security-blocked | diagnostics=security_blocked_url |
| flowchart | click A href "javascript:" | security-blocked | diagnostics=security_blocked_click,security_blocked_url |
| mindmap | <img onerror> in mindmap node | throws | PARSE_ERROR: Parse error: Unexpected token: Unbalanced or unsupported mindmap shape delimiters: <img src=x onerror=alert(1)> |
| venn | <script> in venn set name | throws | PARSE_ERROR: Parse error: Empty input |
| kanban | <img onerror> as a kanban column id | throws | RENDER_ERROR: Kanban task metadata, ticket configuration, YAML, custom styles, and advanced syntax are not supported yet. |
| quadrant | <script> as a quadrant classDef name | throws | PARSE_ERROR: Parse error: Unexpected token: Invalid Quadrant classDef name: classDef <script> fill:#f00 |
| quadrant | <script> as a trailing :::class point reference | throws | PARSE_ERROR: Parse error: Unexpected token: Invalid quadrant point class reference: A: [0.3, 0.6]:::<script> |
| mindmap | <img onerror> as an inline mindmap icon name | throws | PARSE_ERROR: Parse error: Unexpected token: Unbalanced or unsupported mindmap shape delimiters: >) Docs |
| flowchart | javascript: URL behind a stripped UTF-8 BOM | security-blocked | diagnostics=security_blocked_url |
| flowchart | javascript: URL inside a ```mermaid fence | security-blocked | diagnostics=security_blocked_url |
| swimlanes | <br/> line break inside a lane node label | literal-markup | literal markup in visible text: <br (near "You Them Report<br/>BRPROBE Fix") |
| gantt | <br/> line break inside a task name | literal-markup | literal markup in visible text: <br (near "S · Task<br/>BRPROBE") |
| pie | <br/> line break inside a slice label | literal-markup | literal markup in visible text: <br (near "a<br/>BRPROBE 1 b 2") |
| quadrant | <br/> line break inside a point label | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE") |
| sankey | <br/> line break inside a node name | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE B") |
| xychart | <br/> line break inside the title | literal-markup | literal markup in visible text: <br (near "T<br/>BRPROBE 10 0 a") |
| block | <br/> line break inside a block label | literal-markup | literal markup in visible text: <br (near "Label<br/>BRPROBE B") |
| packet | <br/> line break inside a field label | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE") |
| kanban | <br/> line break inside a task label | literal-markup | literal markup in visible text: <br (near "A Task<br/>BRPROBE") |
| radar | <br/> line break inside an axis label | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE B C") |
| event-modeling | <br/> line break inside a frame entity | literal-markup | literal markup in visible text: <br (near "el Events 01 · A<br/>BRPROBE") |
| treemap | <br/> line break inside a leaf label | literal-markup | literal markup in visible text: <br (near "Root Child<br/>BRPROBE · 10") |
| venn | <br/> line break inside a set name | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE B") |
| ishikawa | <br/> line break inside the effect label | literal-markup | literal markup in visible text: <br (near "ory Cause Effect<br/>BRPROBE") |
| wardley | <br/> line break inside the map title | literal-markup | literal markup in visible text: <br (near "Commodity A Map<br/>BRPROBE") |
| cynefin | <br/> line break inside a quoted item | literal-markup | literal markup in visible text: <br (near "otic Confusion a<br/>BRPROBE") |

## Security — injection probes

Method: every probe is rendered twice — once under the default strict policy
(`sanitizeSvg: true`, `allowClickCallbacks: false`) and once with `sanitizeSvg: false`
so the renderer's own escaping is observed without the post-render sanitizer.
The returned SVG is scanned at the DOM level for `script`/`foreignObject`/`iframe`/
`object`/`embed`/`animate`/`set`/`handler` elements, `on*` event attributes, and
`javascript:`/`data:`/`vbscript:` URLs in `href`/`src`/`style`; the serialized markup is
also scanned for unescaped executable tags.

| Family | Variant | Default-policy verdict | sanitizeSvg:false leaks |
| --- | --- | --- | --- |
| flowchart | <script> in node label | renders | — |
| flowchart | <img onerror> in node label | renders | — |
| flowchart | <svg onload> in node label | renders | — |
| flowchart | <foreignObject> with onload in label | renders | — |
| flowchart | <iframe src=javascript:> in label | renders | — |
| flowchart | <svg><script> nested in label | renders | — |
| flowchart | <br/> followed by <script> in label | renders | — |
| flowchart | javascript: URL in edge label | security-blocked | blocked (RENDER_ERROR) |
| flowchart | javascript: URL in node label | security-blocked | blocked (RENDER_ERROR) |
| flowchart | click with javascript: URL | security-blocked | blocked (RENDER_ERROR) |
| flowchart | click with https URL (strict blocks all clicks) | security-blocked | blocked (RENDER_ERROR) |
| flowchart | classDef fill:url(#ref) | throws | blocked (RENDER_ERROR) |
| flowchart | classDef fill:url(javascript:) | throws | blocked (RENDER_ERROR) |
| flowchart | style fill:url(javascript:) | throws | blocked (RENDER_ERROR) |
| flowchart | data:text/html URL in node label | security-blocked | blocked (RENDER_ERROR) |
| flowchart | vbscript: URL in node label | security-blocked | blocked (RENDER_ERROR) |
| flowchart | mixed-case <ScRiPt> tag | renders | — |
| flowchart | entity-encoded &#60;script&#62; | renders | — |
| flowchart | javascript: split across newline | security-blocked | blocked (RENDER_ERROR) |
| flowchart | javascript: split by tab | security-blocked | blocked (RENDER_ERROR) |
| flowchart | %%{init securityLevel loose}%% directive | renders | — |
| flowchart | click A href "javascript:" | security-blocked | blocked (RENDER_ERROR) |
| sequence | <script> in sequence message | renders | — |
| class | <script> in class member | renders | — |
| pie | <img onerror> in pie slice label | renders | — |
| gantt | <script> in gantt task name | renders | — |
| quadrant | <svg onload> in quadrant point label | renders | — |
| xychart | <script> in xychart title | renders | — |
| mindmap | <img onerror> in mindmap node | throws | blocked (PARSE_ERROR) |
| timeline | <script> in timeline event | renders | — |
| state | <script> in state note | renders | — |
| cynefin | <script> in cynefin quoted item | renders | — |
| treemap | <script> in treemap label | renders | — |
| venn | <script> in venn set name | throws | blocked (PARSE_ERROR) |
| packet | <script> in packet field label | renders | — |
| kanban | <img onerror> as a kanban column id | throws | blocked (RENDER_ERROR) |
| quadrant | <script> as a quadrant classDef name | throws | blocked (PARSE_ERROR) |
| quadrant | <script> as a trailing :::class point reference | throws | blocked (PARSE_ERROR) |
| c4 | <img onerror> in a C4 boundary label (block on call line) | renders | — |
| class | <script> in an accepted-and-skipped class note | renders | — |
| sequence | <img onerror> on a bare no-head arrow label | renders | — |
| mindmap | <img onerror> as an inline mindmap icon name | throws | blocked (PARSE_ERROR) |
| flowchart | <script> in a node label reached via a normalized en-dash arrow | renders | — |
| flowchart | javascript: URL behind a stripped UTF-8 BOM | security-blocked | blocked (RENDER_ERROR) |
| flowchart | <img onerror> inside a backslash-escaped pipe edge label | renders | — |
| class | <script> as the class name on a standalone <<interface>> line | renders | — |
| state | <script> in a note next to a concurrent-region separator (--) | renders | — |
| zenuml | <script> as a declared zenuml participant name | renders | — |
| kanban | <img onerror> as the label of a non-ASCII kanban column id | renders | — |
| flowchart | <script> in a node label inside a ```mermaid fence | renders | — |
| flowchart | javascript: URL inside a ```mermaid fence | security-blocked | blocked (RENDER_ERROR) |
| flowchart | <img onerror> inside a ~~~mermaid fence | renders | — |
| flowchart | <script> placed after the closing fence | renders | — |
| flowchart | <svg onload> in a truncated (unclosed) fence | renders | — |

**Conclusion: no injection probe produced executable content, with or without the SVG sanitizer.**

## Expectation surprises

_Every documented expectation matched the observed verdict._

## Full results

| id | Family | Category | Variant | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| flow-smart-quotes | flowchart | punctuation | smart quotes in node label | renders | texts=2 |
| flow-smart-single-quotes | flowchart | punctuation | smart single quotes in label | renders | texts=2 |
| flow-en-dash-arrow | flowchart | punctuation | en-dash arrow (A –> B) | renders | texts=2 |
| flow-em-dash-arrow | flowchart | punctuation | em-dash arrow (A —> B) | renders | texts=2 |
| flow-fullwidth-colon | flowchart | punctuation | full-width colon inside label | renders | texts=2 |
| flow-fullwidth-parens | flowchart | punctuation | full-width parentheses as shape delimiters | renders | texts=3 |
| flow-bom | flowchart | punctuation | UTF-8 BOM prefix | renders | texts=2 |
| flow-zero-width-space | flowchart | punctuation | zero-width space inside label | renders | texts=2 |
| flow-nbsp | flowchart | punctuation | non-breaking space inside label | renders | texts=2 |
| flow-ellipsis | flowchart | punctuation | ellipsis character in label | renders | texts=2 |
| flow-trailing-whitespace | flowchart | punctuation | trailing whitespace on lines | renders | texts=3 |
| flow-crlf | flowchart | punctuation | CRLF line endings | renders | texts=3 |
| flow-semicolon | flowchart | structure | semicolon-separated statements | renders | texts=3 |
| flow-one-line-chain | flowchart | structure | chained edges on one line | renders | texts=3 |
| flow-ampersand-fanout | flowchart | structure | ampersand fan-out (A --> B & C) | renders | texts=3 |
| flow-no-spaces | flowchart | structure | no spaces around arrow (A-->B) | renders | texts=2 |
| flow-graph-keyword | flowchart | structure | graph keyword instead of flowchart | renders | texts=2 |
| flow-fence-included | flowchart | structure | source wrapped in ```mermaid fence | renders | texts=2 |
| flow-fence-tilde | flowchart | structure | source wrapped in ~~~mermaid fence | renders | texts=2 |
| flow-fence-no-language | flowchart | structure | source wrapped in a bare ``` fence | renders | texts=2 |
| flow-fence-unclosed | flowchart | structure | truncated fence (opener, no closer) | renders | texts=2 |
| flow-fence-trailing-prose | flowchart | structure | fence followed by trailing prose | renders | texts=2 |
| flow-fence-other-language | flowchart | structure | fence naming another language (```js) | throws | UNSUPPORTED_DIAGRAM: Unknown diagram type is not supported yet. |
| flow-fence-smart-dash | flowchart | punctuation | fenced source with an en-dash arrow | renders | texts=2 |
| flow-init-directive | flowchart | structure | %%{init}%% theme directive | renders | texts=2 |
| flow-comment | flowchart | structure | %% comment line | renders | texts=2 |
| flow-leading-blank-lines | flowchart | structure | leading blank lines before header | renders | texts=2 |
| flow-unterminated-label | flowchart | structure | unterminated node label | throws | RENDER_ERROR: Flowchart labels cannot be unterminated; add the matching closing delimiter. |
| flow-subgraph-direction | flowchart | structure | direction inside subgraph | renders | texts=3 |
| flow-inline-class | flowchart | structure | inline :::class assignment | renders | texts=2 |
| flow-style-statement | flowchart | structure | style directive | renders | texts=2 |
| flow-linkstyle | flowchart | structure | linkStyle directive | renders | texts=2 |
| flow-classdef-hex | flowchart | structure | classDef with hex colors | renders | texts=2 |
| flow-label-br | flowchart | labels | label containing <br/> | renders | texts=2 |
| flow-label-bold | flowchart | labels | label containing <b> markup | renders | texts=2 |
| flow-label-span-style | flowchart | labels | label containing <span style> | renders | texts=2 |
| flow-label-backtick | flowchart | labels | markdown backtick string label | renders | texts=2 |
| flow-label-colon | flowchart | labels | colon inside label | renders | texts=2 |
| flow-edge-label-escaped-pipe | flowchart | labels | backslash-escaped pipe in edge label (a \\| b) | renders | texts=3 |
| flow-edge-label-entity-pipe | flowchart | labels | entity-escaped pipe in edge label (a #124; b) | renders | texts=3 |
| flow-label-embedded-quotes | flowchart | labels | quoted label with escaped inner quotes | renders | texts=2 |
| flow-label-emoji | flowchart | labels | emoji in label | renders | texts=2 |
| flow-label-chinese | flowchart | labels | Chinese label | renders | texts=2 |
| flow-label-entity | flowchart | labels | HTML entity code label (&#9829;) | renders | texts=2 |
| flow-label-fontawesome | flowchart | labels | FontAwesome icon label | renders | texts=2 |
| swim-basic | swimlanes | family-specific | two lanes with cross-lane edge | renders | texts=4 |
| swim-labeled-edge | swimlanes | family-specific | labeled edge between lanes | renders | texts=5 |
| swim-no-direction | swimlanes | structure | swimlane without explicit direction | renders | texts=4 |
| seq-all-arrows | sequence | family-specific | every arrow form on one diagram | renders | texts=10 |
| seq-spaced-colon | sequence | structure | spaces around message colon (A ->> B : x) | renders | texts=3 |
| seq-note-over-two | sequence | family-specific | note over two participants | renders | texts=4 |
| seq-loop | sequence | family-specific | loop block | renders | texts=4 |
| seq-alt-else | sequence | family-specific | alt/else block | renders | texts=7 |
| seq-par | sequence | family-specific | par/and block | renders | texts=7 |
| seq-critical | sequence | family-specific | critical block | renders | texts=4 |
| seq-break | sequence | family-specific | break block | renders | texts=4 |
| seq-rect | sequence | family-specific | rect color frame | renders | texts=3 |
| seq-box | sequence | family-specific | box participant group | renders | texts=4 |
| seq-activate | sequence | family-specific | activation/deactivation (+/-) | renders | texts=4 |
| seq-autonumber | sequence | family-specific | autonumber directive | renders | texts=4 |
| seq-participant-alias | sequence | family-specific | participant with alias (as) | renders | texts=3 |
| seq-actor | sequence | family-specific | actor declaration | renders | texts=3 |
| seq-chinese-message | sequence | labels | Chinese message text | renders | texts=3 |
| seq-smart-quote | sequence | punctuation | smart quotes in message | renders | texts=3 |
| seq-fence-included | sequence | structure | source wrapped in ```mermaid fence | renders | texts=3 |
| seq-init-directive | sequence | structure | %%{init}%% directive before sequence | renders | texts=3 |
| seq-fullwidth-arrow | sequence | punctuation | full-width dash in arrow | renders | texts=3 |
| class-member-block | class | family-specific | class member block { +method() } | renders | texts=1 |
| class-interface-annotation | class | family-specific | <<interface>> annotation on its own line before the name | renders | texts=2 |
| class-interface-in-block | class | family-specific | <<interface>> annotation inside a member block | renders | texts=1 |
| class-interface-postfix | class | family-specific | <<interface>> annotation postfix after the name | renders | texts=2 |
| class-note | class | family-specific | note for A "..." (documented skip) | silent-drop | missing text: hello |
| class-direction | class | family-specific | direction TB directive | renders | texts=2 |
| class-namespace | class | family-specific | namespace container | renders | texts=3 |
| class-generic | class | family-specific | generic type (Box~T~) | renders | texts=3 |
| class-member-shorthand | class | family-specific | member shorthand (A : +foo()) | renders | texts=1 |
| class-member-classifiers | class | family-specific | member classifiers ($ static, * abstract) | renders | texts=1 |
| class-stereotype | class | family-specific | <<Service>> stereotype line | renders | texts=2 |
| class-smart-quote-label | class | punctuation | smart quotes in relation label | renders | texts=3 |
| state-pseudo | state | family-specific | start/end pseudostates ([*]) | renders | texts=3 |
| state-alias | state | family-specific | state alias (state "desc" as s1) | renders | texts=2 |
| state-composite | state | family-specific | composite state block | renders | texts=5 |
| state-concurrent | state | family-specific | concurrent regions (--) | renders | texts=3 |
| state-choice | state | family-specific | choice pseudostate (<<choice>>) | renders | texts=3 |
| state-fork | state | family-specific | fork pseudostate (<<fork>>) | renders | texts=3 |
| state-note | state | family-specific | note right of state | renders | texts=3 |
| state-chinese | state | labels | Chinese state name | renders | texts=2 |
| er-cardinality | er | family-specific | crow-foot cardinality (\|\|--o{) | renders | texts=3 |
| er-attributes | er | family-specific | entity attribute block with PK | renders | texts=3 |
| er-quoted-attribute | er | family-specific | quoted attribute name | renders | texts=1 |
| er-comment | er | structure | %% comment in er | renders | texts=3 |
| journey-basic | user-journey | family-specific | sectioned scored task | renders | texts=1 |
| journey-emoji | user-journey | labels | emoji in task label | renders | texts=1 |
| journey-chinese | user-journey | labels | Chinese task and actor | renders | texts=1 |
| gantt-basic | gantt | family-specific | dated task with done state | renders | texts=1 |
| gantt-dateformat | gantt | family-specific | dateFormat YYYY-MM-DD | renders | texts=1 |
| gantt-axisformat | gantt | family-specific | axisFormat directive | renders | texts=1 |
| gantt-excludes | gantt | family-specific | excludes weekends | renders | texts=1 |
| gantt-milestone | gantt | family-specific | milestone task | renders | texts=1 |
| gantt-after | gantt | family-specific | after dependency | renders | texts=2 |
| gantt-crit | gantt | family-specific | crit task state | renders | texts=1 |
| pie-basic | pie | family-specific | title + numeric slices | renders | texts=3 |
| pie-showdata | pie | family-specific | showData directive | renders | texts=5 |
| pie-emoji | pie | labels | emoji slice labels | renders | texts=2 |
| pie-chinese | pie | labels | Chinese slice label | renders | texts=1 |
| quadrant-basic | quadrant | family-specific | axes, quadrants, one point | renders | texts=7 |
| quadrant-point-links | quadrant | family-specific | point-to-point connector (A --> B) | renders | texts=2 |
| quadrant-point-style | quadrant | family-specific | direct point styling (radius/color/stroke) | renders | texts=1 |
| quadrant-classdef | quadrant | family-specific | classDef + :::class point (advertised in matrix) | renders | texts=1 |
| quadrant-smart-quote-title | quadrant | punctuation | smart quotes in title | renders | texts=2 |
| requirement-basic | requirement | family-specific | typed requirement block | renders | texts=1 |
| requirement-relation | requirement | family-specific | labeled semantic relationship | renders | texts=3 |
| requirement-functional | requirement | family-specific | functionalRequirement block | renders | texts=1 |
| gitgraph-branch-merge | gitgraph | family-specific | branch, checkout, merge | renders | texts=3 |
| gitgraph-tag | gitgraph | family-specific | commit with tag | renders | texts=1 |
| gitgraph-type | gitgraph | family-specific | commit type: HIGHLIGHT | renders | texts=1 |
| gitgraph-cherry-pick | gitgraph | family-specific | cherry-pick across branches | renders | texts=3 |
| c4-context | c4 | family-specific | Person/System/Rel | renders | texts=3 |
| c4-container | c4 | family-specific | C4Container with Container() | renders | texts=2 |
| c4-boundary | c4 | family-specific | Enterprise_Boundary block | renders | texts=2 |
| mindmap-icon-inline | mindmap | family-specific | ::icon prefix on same line as label | renders | texts=2 |
| mindmap-shapes | mindmap | family-specific | multiple node shapes | renders | texts=4 |
| mindmap-indent | mindmap | family-specific | space-indented hierarchy | renders | texts=4 |
| mindmap-markdown | mindmap | labels | markdown bold string node | renders | texts=2 |
| mindmap-icon-unknown | mindmap | family-specific | unknown FontAwesome icon degrades to text | renders | texts=2 |
| mindmap-chinese | mindmap | labels | Chinese node labels | renders | texts=2 |
| timeline-basic | timeline | family-specific | period : event | renders | texts=1 |
| timeline-sections | timeline | family-specific | section groupings | renders | texts=2 |
| timeline-multi-event | timeline | family-specific | multiple events per period | renders | texts=1 |
| zenuml-call | zenuml | family-specific | labeled direct call | renders | texts=3 |
| zenuml-return | zenuml | family-specific | call and return | renders | texts=4 |
| zenuml-participant | zenuml | family-specific | participant declaration | renders | texts=3 |
| zenuml-if-block | zenuml | family-specific | if block (documented unsupported) | throws | RENDER_ERROR: ZenUML blocks, async messages, and advanced control syntax are not supported yet. |
| sankey-basic | sankey | family-specific | three-column CSV records | renders | texts=3 |
| sankey-quoted-fields | sankey | family-specific | quoted CSV fields with spaces | renders | texts=2 |
| sankey-cycle | sankey | family-specific | cyclic flow (documented unsupported) | throws | RENDER_ERROR: Sankey diagrams cannot contain cycles. |
| sankey-config | sankey | family-specific | config block (documented unsupported) | throws | RENDER_ERROR: Sankey configuration directives are not supported yet. |
| sankey-invalid-value | sankey | family-specific | non-numeric weight | throws | RENDER_ERROR: Sankey values must be finite positive numbers. |
| xychart-bar | xychart | family-specific | categorical bar series | renders | texts=6 |
| xychart-line | xychart | family-specific | line series with numeric x-axis | renders | texts=5 |
| xychart-axis-titles | xychart | family-specific | quoted axis titles | renders | texts=6 |
| xychart-chinese-title | xychart | labels | Chinese title | renders | texts=4 |
| block-columns | block | family-specific | columns grid | renders | texts=3 |
| block-span | block | family-specific | span declaration (A:3) | renders | texts=1 |
| block-relationship | block | family-specific | direct --> relationship | renders | texts=2 |
| block-labeled | block | family-specific | bracketed block label (with columns) | renders | texts=2 |
| block-nested | block | family-specific | nested block (documented unsupported) | throws | RENDER_ERROR: Block nesting, block arrows, custom shapes, classes, styles, configuration, and edge labels are not supported yet. |
| packet-plus-width | packet | family-specific | +width bit fields | renders | texts=3 |
| packet-bit-range | packet | family-specific | absolute bit range (64-127) | renders | texts=1 |
| packet-chinese | packet | labels | Chinese field label | renders | texts=1 |
| kanban-columns | kanban | family-specific | column with bracketed label and task | renders | texts=2 |
| kanban-ticket | kanban | family-specific | @{ ticket } metadata | renders | texts=2 |
| kanban-chinese | kanban | labels | ASCII ids with Chinese column/task labels | renders | texts=2 |
| kanban-chinese-id | kanban | structure | Chinese column id (完成[Done]) | renders | texts=2 |
| kanban-unsupported-metadata | kanban | family-specific | metadata key beyond ticket (documented unsupported) | throws | RENDER_ERROR: Kanban task metadata beyond `ticket` is not supported yet. |
| architecture-services | architecture | family-specific | two services with port relationship | renders | texts=2 |
| architecture-groups | architecture | family-specific | group membership (in) | renders | texts=2 |
| architecture-junction | architecture | family-specific | junction node | renders | texts=2 |
| architecture-align | architecture | family-specific | align directive (documented unsupported) | throws | RENDER_ERROR: Architecture alignment directives, configuration, icon glyphs, and junctions inside groups are not supported yet. |
| radar-basic | radar | family-specific | named axes + one curve | renders | texts=3 |
| radar-two-curves | radar | family-specific | two curves | renders | texts=3 |
| radar-graticule | radar | family-specific | graticule + ticks | renders | texts=3 |
| eventmodeling-basic | event-modeling | family-specific | tf timeframes | renders | texts=6 |
| eventmodeling-reset | event-modeling | family-specific | rf reset frame | renders | texts=5 |
| eventmodeling-readmodel | event-modeling | family-specific | readmodel entity | renders | texts=4 |
| treemap-four-space | treemap | family-specific | four-space indentation (canonical form) | renders | texts=2 |
| treemap-basic | treemap | structure | two-space indentation with leaf value | renders | texts=2 |
| treemap-nested | treemap | structure | two-space nested hierarchy | renders | texts=3 |
| treemap-chinese | treemap | labels | Chinese labels with two-space indent | renders | texts=2 |
| venn-basic | venn | family-specific | two named sets | renders | texts=2 |
| venn-union | venn | family-specific | labeled union | renders | texts=3 |
| venn-title | venn | family-specific | quoted title | renders | texts=3 |
| ishikawa-basic | ishikawa | family-specific | effect with category and cause | renders | texts=3 |
| ishikawa-nested | ishikawa | family-specific | nested cause | renders | texts=3 |
| wardley-basic | wardley | family-specific | anchor, component, dependency | renders | texts=7 |
| wardley-evolve | wardley | family-specific | evolve directive (documented unsupported) | throws | RENDER_ERROR: Wardley evolution, pipelines, annotations, strategies, styles, and configuration are not supported yet. |
| wardley-chinese-title | wardley | labels | Chinese map title | renders | texts=6 |
| cynefin-basic | cynefin | family-specific | domains with quoted items | renders | texts=8 |
| cynefin-transition | cynefin | family-specific | labeled transition between domains | renders | texts=8 |
| cynefin-chinese | cynefin | labels | Chinese item | renders | texts=6 |
| treeview-basic | treeview | family-specific | indented hierarchy | renders | texts=3 |
| treeview-chinese | treeview | labels | Chinese node labels | renders | texts=2 |
| sec-script-tag-label | flowchart | security | <script> in node label | renders | neutralized (no executable content in output) |
| sec-img-onerror | flowchart | security | <img onerror> in node label | renders | neutralized (no executable content in output) |
| sec-svg-onload | flowchart | security | <svg onload> in node label | renders | neutralized (no executable content in output) |
| sec-foreignobject | flowchart | security | <foreignObject> with onload in label | renders | neutralized (no executable content in output) |
| sec-iframe | flowchart | security | <iframe src=javascript:> in label | renders | neutralized (no executable content in output) |
| sec-nested-svg-script | flowchart | security | <svg><script> nested in label | renders | neutralized (no executable content in output) |
| sec-br-then-script | flowchart | security | <br/> followed by <script> in label | renders | neutralized (no executable content in output) |
| sec-js-edge-label | flowchart | security | javascript: URL in edge label | security-blocked | diagnostics=security_blocked_url |
| sec-js-node-label | flowchart | security | javascript: URL in node label | security-blocked | diagnostics=security_blocked_url |
| sec-click-javascript | flowchart | security | click with javascript: URL | security-blocked | diagnostics=security_blocked_click,security_blocked_url |
| sec-click-https | flowchart | security | click with https URL (strict blocks all clicks) | security-blocked | diagnostics=security_blocked_click |
| sec-classdef-url-ref | flowchart | security | classDef fill:url(#ref) | throws | RENDER_ERROR: Flowchart classDef statements support fill, stroke, color, stroke-width, stroke-dasharray, and cosmetic properties with valid values. |
| sec-classdef-js-url | flowchart | security | classDef fill:url(javascript:) | throws | RENDER_ERROR: Flowchart classDef statements support fill, stroke, color, stroke-width, stroke-dasharray, and cosmetic properties with valid values. |
| sec-style-js-url | flowchart | security | style fill:url(javascript:) | throws | RENDER_ERROR: Flowchart style statements only support fill, stroke, and color with safe color values plus numeric stroke-width and stroke-dasharray. |
| sec-data-url-label | flowchart | security | data:text/html URL in node label | security-blocked | diagnostics=security_blocked_url |
| sec-vbscript-url | flowchart | security | vbscript: URL in node label | security-blocked | diagnostics=security_blocked_url |
| sec-mixed-case-script | flowchart | security | mixed-case <ScRiPt> tag | renders | neutralized (no executable content in output) |
| sec-entity-bypass | flowchart | security | entity-encoded &#60;script&#62; | renders | neutralized (no executable content in output) |
| sec-newline-split-js | flowchart | security | javascript: split across newline | security-blocked | diagnostics=security_blocked_url |
| sec-tab-split-js | flowchart | security | javascript: split by tab | security-blocked | diagnostics=security_blocked_url |
| sec-loose-init-directive | flowchart | security | %%{init securityLevel loose}%% directive | renders | neutralized (no executable content in output) |
| sec-click-href-javascript | flowchart | security | click A href "javascript:" | security-blocked | diagnostics=security_blocked_click,security_blocked_url |
| sec-sequence-html | sequence | security | <script> in sequence message | renders | neutralized (no executable content in output) |
| sec-class-html-member | class | security | <script> in class member | renders | neutralized (no executable content in output) |
| sec-pie-html-label | pie | security | <img onerror> in pie slice label | renders | neutralized (no executable content in output) |
| sec-gantt-html-task | gantt | security | <script> in gantt task name | renders | neutralized (no executable content in output) |
| sec-quadrant-html-point | quadrant | security | <svg onload> in quadrant point label | renders | neutralized (no executable content in output) |
| sec-xychart-html-title | xychart | security | <script> in xychart title | renders | neutralized (no executable content in output) |
| sec-mindmap-html-node | mindmap | security | <img onerror> in mindmap node | throws | PARSE_ERROR: Parse error: Unexpected token: Unbalanced or unsupported mindmap shape delimiters: <img src=x onerror=alert(1)> |
| sec-timeline-html-event | timeline | security | <script> in timeline event | renders | neutralized (no executable content in output) |
| sec-state-html-note | state | security | <script> in state note | renders | neutralized (no executable content in output) |
| sec-cynefin-html-item | cynefin | security | <script> in cynefin quoted item | renders | neutralized (no executable content in output) |
| sec-treemap-html-label | treemap | security | <script> in treemap label | renders | neutralized (no executable content in output) |
| sec-venn-html-set | venn | security | <script> in venn set name | throws | PARSE_ERROR: Parse error: Empty input |
| sec-packet-html-field | packet | security | <script> in packet field label | renders | neutralized (no executable content in output) |
| sec-kanban-html-id | kanban | security | <img onerror> as a kanban column id | throws | RENDER_ERROR: Kanban task metadata, ticket configuration, YAML, custom styles, and advanced syntax are not supported yet. |
| sec-quadrant-classdef-html | quadrant | security | <script> as a quadrant classDef name | throws | PARSE_ERROR: Parse error: Unexpected token: Invalid Quadrant classDef name: classDef <script> fill:#f00 |
| sec-quadrant-trailing-class-html | quadrant | security | <script> as a trailing :::class point reference | throws | PARSE_ERROR: Parse error: Unexpected token: Invalid quadrant point class reference: A: [0.3, 0.6]:::<script> |
| sec-c4-boundary-html-label | c4 | security | <img onerror> in a C4 boundary label (block on call line) | renders | neutralized (no executable content in output) |
| sec-class-note-html | class | security | <script> in an accepted-and-skipped class note | renders | neutralized (no executable content in output) |
| sec-sequence-bare-arrow-html | sequence | security | <img onerror> on a bare no-head arrow label | renders | neutralized (no executable content in output) |
| sec-mindmap-icon-html | mindmap | security | <img onerror> as an inline mindmap icon name | throws | PARSE_ERROR: Parse error: Unexpected token: Unbalanced or unsupported mindmap shape delimiters: >) Docs |
| sec-en-dash-arrow-html | flowchart | security | <script> in a node label reached via a normalized en-dash arrow | renders | neutralized (no executable content in output) |
| sec-bom-js-url | flowchart | security | javascript: URL behind a stripped UTF-8 BOM | security-blocked | diagnostics=security_blocked_url |
| sec-escaped-pipe-html | flowchart | security | <img onerror> inside a backslash-escaped pipe edge label | renders | neutralized (no executable content in output) |
| sec-class-standalone-interface-html | class | security | <script> as the class name on a standalone <<interface>> line | renders | neutralized (no executable content in output) |
| sec-state-concurrent-html | state | security | <script> in a note next to a concurrent-region separator (--) | renders | neutralized (no executable content in output) |
| sec-zenuml-declaration-html | zenuml | security | <script> as a declared zenuml participant name | renders | neutralized (no executable content in output) |
| sec-kanban-chinese-id-html | kanban | security | <img onerror> as the label of a non-ASCII kanban column id | renders | neutralized (no executable content in output) |
| sec-fence-script-label | flowchart | security | <script> in a node label inside a ```mermaid fence | renders | neutralized (no executable content in output) |
| sec-fence-js-url | flowchart | security | javascript: URL inside a ```mermaid fence | security-blocked | diagnostics=security_blocked_url |
| sec-fence-tilde-html | flowchart | security | <img onerror> inside a ~~~mermaid fence | renders | neutralized (no executable content in output) |
| sec-fence-trailing-payload | flowchart | security | <script> placed after the closing fence | renders | neutralized (no executable content in output) |
| sec-fence-unclosed-payload | flowchart | security | <svg onload> in a truncated (unclosed) fence | renders | neutralized (no executable content in output) |
| br-flowchart | flowchart | labels | <br/> line break inside a node label (positive control) | renders | texts=2 |
| br-swimlanes | swimlanes | labels | <br/> line break inside a lane node label | literal-markup | literal markup in visible text: <br (near "You Them Report<br/>BRPROBE Fix") |
| br-sequence | sequence | labels | <br/> line break inside a message (positive control) | renders | texts=3 |
| br-class | class | labels | <br/> line break inside a relation label | renders | texts=3 |
| br-state | state | labels | <br/> line break inside a state alias description | renders | texts=2 |
| br-er | er | labels | <br/> line break inside a relationship label | renders | texts=3 |
| br-user-journey | user-journey | labels | <br/> line break inside a task label | renders | texts=1 |
| br-gantt | gantt | labels | <br/> line break inside a task name | literal-markup | literal markup in visible text: <br (near "S · Task<br/>BRPROBE") |
| br-pie | pie | labels | <br/> line break inside a slice label | literal-markup | literal markup in visible text: <br (near "a<br/>BRPROBE 1 b 2") |
| br-quadrant | quadrant | labels | <br/> line break inside a point label | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE") |
| br-requirement | requirement | labels | <br/> line break inside a requirement text | renders | texts=1 |
| br-gitgraph | gitgraph | labels | <br/> line break inside a commit id | renders | texts=1 |
| br-c4 | c4 | labels | <br/> line break inside a C4 element label | renders | texts=3 |
| br-mindmap | mindmap | labels | <br/> line break inside a node label | renders | texts=2 |
| br-timeline | timeline | labels | <br/> line break inside an event | renders | texts=1 |
| br-zenuml | zenuml | labels | <br/> line break inside a message | renders | texts=3 |
| br-sankey | sankey | labels | <br/> line break inside a node name | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE B") |
| br-xychart | xychart | labels | <br/> line break inside the title | literal-markup | literal markup in visible text: <br (near "T<br/>BRPROBE 10 0 a") |
| br-block | block | labels | <br/> line break inside a block label | literal-markup | literal markup in visible text: <br (near "Label<br/>BRPROBE B") |
| br-packet | packet | labels | <br/> line break inside a field label | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE") |
| br-kanban | kanban | labels | <br/> line break inside a task label | literal-markup | literal markup in visible text: <br (near "A Task<br/>BRPROBE") |
| br-architecture | architecture | labels | <br/> line break inside a service label | renders | texts=2 |
| br-radar | radar | labels | <br/> line break inside an axis label | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE B C") |
| br-event-modeling | event-modeling | labels | <br/> line break inside a frame entity | literal-markup | literal markup in visible text: <br (near "el Events 01 · A<br/>BRPROBE") |
| br-treemap | treemap | labels | <br/> line break inside a leaf label | literal-markup | literal markup in visible text: <br (near "Root Child<br/>BRPROBE · 10") |
| br-venn | venn | labels | <br/> line break inside a set name | literal-markup | literal markup in visible text: <br (near "A<br/>BRPROBE B") |
| br-ishikawa | ishikawa | labels | <br/> line break inside the effect label | literal-markup | literal markup in visible text: <br (near "ory Cause Effect<br/>BRPROBE") |
| br-wardley | wardley | labels | <br/> line break inside the map title | literal-markup | literal markup in visible text: <br (near "Commodity A Map<br/>BRPROBE") |
| br-cynefin | cynefin | labels | <br/> line break inside a quoted item | literal-markup | literal markup in visible text: <br (near "otic Confusion a<br/>BRPROBE") |
| br-treeview | treeview | labels | <br/> line break inside a node label | renders | texts=2 |

_Diagnostic only — the renderer source was not modified by this scan._
