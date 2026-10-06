/**
 * AI-emitted Mermaid syntax scan corpus.
 *
 * Data-only module (no imports, no DOM) so it can be consumed by the vitest
 * runner (`tests/ai-syntax-scan.test.ts`) and inspected by tooling. Every
 * entry is one probe: the renderer is fed `source` and the outcome is
 * classified into one of `renders | throws | silent-drop | security-blocked`.
 *
 * Fields:
 *   id          stable kebab-case identifier (unique)
 *   family      one of FAMILIES (the documented diagram catalog)
 *   category    punctuation | structure | labels | family-specific | security
 *   variant     human-readable description of the AI quirk under test
 *   source      the exact Mermaid source fed to the renderer
 *   mustContain optional substrings that MUST appear in the rendered SVG text
 *               for the case to count as `renders`; any missing substring is
 *               objective evidence of a silent content drop
 *   mustNotContain
 *               optional substrings that MUST NOT appear in the *visible* text
 *               (the textContent of `<text>`/`<tspan>`, with `<title>`/`<desc>`
 *               metadata excluded); any substring that is present is objective
 *               evidence of a content-fidelity defect and classifies the row as
 *               `literal-markup`. This check is opt-in: it only runs for entries
 *               that declare the field, so the security probes — which put raw
 *               `<script>`/`<img onerror>` text in labels and expect it to be
 *               neutralized to literal text — are never affected.
 *   security    true for injection probes (reported in the security section,
 *               additionally re-rendered with sanitizeSvg disabled)
 *   expect      optional documented expectation, used only to flag surprises
 *   note        optional context
 */

export const FAMILIES = [
  'flowchart',
  'swimlanes',
  'sequence',
  'class',
  'state',
  'er',
  'user-journey',
  'gantt',
  'pie',
  'quadrant',
  'requirement',
  'gitgraph',
  'c4',
  'mindmap',
  'timeline',
  'zenuml',
  'sankey',
  'xychart',
  'block',
  'packet',
  'kanban',
  'architecture',
  'radar',
  'event-modeling',
  'treemap',
  'venn',
  'ishikawa',
  'wardley',
  'cynefin',
  'treeview',
];

const NL = '\n';

/** Small helper so multi-line sources stay readable in this file. */
const lines = (...parts) => parts.join(NL);

export const CORPUS = [
  // =========================================================================
  // flowchart — punctuation / characters
  // =========================================================================
  {
    id: 'flow-smart-quotes',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'smart quotes in node label',
    source: lines('flowchart TD', '  A[\u201CSmart quotes\u201D] --> B'),
    mustContain: ['Smart', 'quotes'],
  },
  {
    id: 'flow-smart-single-quotes',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'smart single quotes in label',
    source: lines('flowchart TD', '  A[\u2018curly\u2019] --> B'),
    mustContain: ['curly'],
  },
  {
    id: 'flow-en-dash-arrow',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'en-dash arrow (A \u2013> B)',
    source: lines('flowchart TD', '  A \u2013> B'),
    expect: 'renders',
  },
  {
    id: 'flow-em-dash-arrow',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'em-dash arrow (A \u2014> B)',
    source: lines('flowchart TD', '  A \u2014> B'),
    expect: 'renders',
  },
  {
    id: 'flow-fullwidth-colon',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'full-width colon inside label',
    source: lines('flowchart TD', '  A[\u4e2d\u6587\uff1a\u6807\u7b7e] --> B'),
    mustContain: ['\u4e2d\u6587'],
  },
  {
    id: 'flow-fullwidth-parens',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'full-width parentheses as shape delimiters',
    source: lines('flowchart TD', '  A\uff08x\uff09 --> B'),
  },
  {
    id: 'flow-bom',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'UTF-8 BOM prefix',
    source: '\uFEFF' + lines('flowchart TD', '  A --> B'),
    expect: 'renders',
  },
  {
    id: 'flow-zero-width-space',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'zero-width space inside label',
    source: lines('flowchart TD', '  A[\u200BZero] --> B'),
    mustContain: ['Zero'],
  },
  {
    id: 'flow-nbsp',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'non-breaking space inside label',
    source: lines('flowchart TD', '  A[\u00A0Space] --> B'),
    mustContain: ['Space'],
  },
  {
    id: 'flow-ellipsis',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'ellipsis character in label',
    source: lines('flowchart TD', '  A[Wait\u2026] --> B'),
    mustContain: ['Wait'],
  },
  {
    id: 'flow-trailing-whitespace',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'trailing whitespace on lines',
    source: 'flowchart TD   \n  A --> B   \n  B --> C\t',
    mustContain: ['A'],
  },
  {
    id: 'flow-crlf',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'CRLF line endings',
    source: 'flowchart TD\r\n  A --> B\r\n  B --> C',
    mustContain: ['A'],
  },

  // =========================================================================
  // flowchart — structure
  // =========================================================================
  {
    id: 'flow-semicolon',
    family: 'flowchart',
    category: 'structure',
    variant: 'semicolon-separated statements',
    source: 'flowchart TD; A-->B; B-->C',
  },
  {
    id: 'flow-one-line-chain',
    family: 'flowchart',
    category: 'structure',
    variant: 'chained edges on one line',
    source: lines('flowchart TD', '  A --> B --> C'),
  },
  {
    id: 'flow-ampersand-fanout',
    family: 'flowchart',
    category: 'structure',
    variant: 'ampersand fan-out (A --> B & C)',
    source: lines('flowchart TD', '  A --> B & C'),
  },
  {
    id: 'flow-no-spaces',
    family: 'flowchart',
    category: 'structure',
    variant: 'no spaces around arrow (A-->B)',
    source: lines('flowchart TD', '  A-->B'),
  },
  {
    id: 'flow-graph-keyword',
    family: 'flowchart',
    category: 'structure',
    variant: 'graph keyword instead of flowchart',
    source: lines('graph TD', '  A --> B'),
  },
  {
    id: 'flow-fence-included',
    family: 'flowchart',
    category: 'structure',
    variant: 'source wrapped in ```mermaid fence',
    source: '```mermaid\nflowchart TD\n  A --> B\n```',
    mustContain: ['A', 'B'],
  },
  {
    id: 'flow-fence-tilde',
    family: 'flowchart',
    category: 'structure',
    variant: 'source wrapped in ~~~mermaid fence',
    source: '~~~mermaid\nflowchart TD\n  A --> B\n~~~',
    mustContain: ['A', 'B'],
  },
  {
    id: 'flow-fence-no-language',
    family: 'flowchart',
    category: 'structure',
    variant: 'source wrapped in a bare ``` fence',
    source: '```\nflowchart TD\n  A --> B\n```',
    mustContain: ['A', 'B'],
  },
  {
    id: 'flow-fence-unclosed',
    family: 'flowchart',
    category: 'structure',
    variant: 'truncated fence (opener, no closer)',
    source: '```mermaid\nflowchart TD\n  A --> B',
    mustContain: ['A', 'B'],
  },
  {
    id: 'flow-fence-trailing-prose',
    family: 'flowchart',
    category: 'structure',
    variant: 'fence followed by trailing prose',
    source: '```mermaid\nflowchart TD\n  A --> B\n```\nHere is how the flow works.',
    mustContain: ['A', 'B'],
    note: 'the block ends at the first matching closer, so the trailing prose is outside the diagram; before fence support this rendered the prose as extra nodes or threw',
  },
  {
    id: 'flow-fence-other-language',
    family: 'flowchart',
    category: 'structure',
    variant: 'fence naming another language (```js)',
    source: '```js\nflowchart TD\n  A --> B\n```',
    expect: 'throws',
    note: 'a fence naming another language is somebody\'s code sample and must stay untouched',
  },
  {
    id: 'flow-fence-smart-dash',
    family: 'flowchart',
    category: 'punctuation',
    variant: 'fenced source with an en-dash arrow',
    source: '```mermaid\nflowchart TD\n  A \u2013> B\n```',
    mustContain: ['A', 'B'],
  },
  {
    id: 'flow-init-directive',
    family: 'flowchart',
    category: 'structure',
    variant: '%%{init}%% theme directive',
    source: lines("%%{init: {'theme':'dark'}}%%", 'flowchart TD', '  A --> B'),
  },
  {
    id: 'flow-comment',
    family: 'flowchart',
    category: 'structure',
    variant: '%% comment line',
    source: lines('%% a comment', 'flowchart TD', '  A --> B'),
  },
  {
    id: 'flow-leading-blank-lines',
    family: 'flowchart',
    category: 'structure',
    variant: 'leading blank lines before header',
    source: '\n\n  flowchart TD\n  A --> B',
  },
  {
    id: 'flow-unterminated-label',
    family: 'flowchart',
    category: 'structure',
    variant: 'unterminated node label',
    source: lines('flowchart TD', '  A["unterminated --> B'),
    expect: 'throws',
  },
  {
    id: 'flow-subgraph-direction',
    family: 'flowchart',
    category: 'structure',
    variant: 'direction inside subgraph',
    source: lines('flowchart TD', '  subgraph one', '    direction LR', '    A --> B', '  end'),
  },
  {
    id: 'flow-inline-class',
    family: 'flowchart',
    category: 'structure',
    variant: 'inline :::class assignment',
    source: lines('flowchart TD', '  A:::cls --> B', '  classDef cls fill:#f00'),
  },
  {
    id: 'flow-style-statement',
    family: 'flowchart',
    category: 'structure',
    variant: 'style directive',
    source: lines('flowchart TD', '  A --> B', '  style A fill:#f9f,stroke:#333'),
  },
  {
    id: 'flow-linkstyle',
    family: 'flowchart',
    category: 'structure',
    variant: 'linkStyle directive',
    source: lines('flowchart TD', '  A-->B', '  linkStyle 0 stroke:#f00'),
  },
  {
    id: 'flow-classdef-hex',
    family: 'flowchart',
    category: 'structure',
    variant: 'classDef with hex colors',
    source: lines('flowchart TD', '  A --> B', '  classDef hot fill:#ff0000,stroke:#990000,color:#ffffff', '  class A hot'),
  },

  // =========================================================================
  // flowchart — labels
  // =========================================================================
  {
    id: 'flow-label-br',
    family: 'flowchart',
    category: 'labels',
    variant: 'label containing <br/>',
    source: lines('flowchart TD', '  A["line1<br/>line2"] --> B'),
    mustContain: ['line1', 'line2'],
  },
  {
    id: 'flow-label-bold',
    family: 'flowchart',
    category: 'labels',
    variant: 'label containing <b> markup',
    source: lines('flowchart TD', '  A["<b>bold</b>"] --> B'),
    mustContain: ['bold'],
  },
  {
    id: 'flow-label-span-style',
    family: 'flowchart',
    category: 'labels',
    variant: 'label containing <span style>',
    source: lines('flowchart TD', '  A["<span style=\'color:red\'>red</span>"] --> B'),
    mustContain: ['red'],
  },
  {
    id: 'flow-label-backtick',
    family: 'flowchart',
    category: 'labels',
    variant: 'markdown backtick string label',
    source: lines('flowchart TD', '  A[`code`] --> B'),
    mustContain: ['code'],
  },
  {
    id: 'flow-label-colon',
    family: 'flowchart',
    category: 'labels',
    variant: 'colon inside label',
    source: lines('flowchart TD', '  A[Deploy: prod] --> B'),
    mustContain: ['Deploy', 'prod'],
  },
  {
    id: 'flow-edge-label-escaped-pipe',
    family: 'flowchart',
    category: 'labels',
    variant: 'backslash-escaped pipe in edge label (a \\| b)',
    source: lines('flowchart TD', '  A -->|a \\| b| B'),
    mustContain: ['a', 'b'],
    expect: 'renders',
  },
  {
    id: 'flow-edge-label-entity-pipe',
    family: 'flowchart',
    category: 'labels',
    variant: 'entity-escaped pipe in edge label (a #124; b)',
    source: lines('flowchart TD', '  A -->|a #124; b| B'),
    mustContain: ['a', 'b'],
  },
  {
    id: 'flow-label-embedded-quotes',
    family: 'flowchart',
    category: 'labels',
    variant: 'quoted label with escaped inner quotes',
    source: lines('flowchart TD', '  A["He said \\"hi\\""] --> B'),
    mustContain: ['hi'],
  },
  {
    id: 'flow-label-emoji',
    family: 'flowchart',
    category: 'labels',
    variant: 'emoji in label',
    source: lines('flowchart TD', '  A[\uD83D\uDE80 Launch] --> B'),
    mustContain: ['Launch'],
  },
  {
    id: 'flow-label-chinese',
    family: 'flowchart',
    category: 'labels',
    variant: 'Chinese label',
    source: lines('flowchart TD', '  A[\u4e2d\u6587\u6807\u7b7e] --> B'),
    mustContain: ['\u4e2d\u6587\u6807\u7b7e'],
  },
  {
    id: 'flow-label-entity',
    family: 'flowchart',
    category: 'labels',
    variant: 'HTML entity code label (&#9829;)',
    source: lines('flowchart TD', '  A[&#9829;] --> B'),
  },
  {
    id: 'flow-label-fontawesome',
    family: 'flowchart',
    category: 'labels',
    variant: 'FontAwesome icon label',
    source: lines('flowchart TD', '  A[fa:fa-rocket Launch] --> B'),
    mustContain: ['Launch'],
  },

  // =========================================================================
  // swimlanes
  // =========================================================================
  {
    id: 'swim-basic',
    family: 'swimlanes',
    category: 'family-specific',
    variant: 'two lanes with cross-lane edge',
    source: lines('swimlane-beta LR', '  subgraph You', '    a[Report]', '  end', '  subgraph Them', '    b[Fix]', '  end', '  a --> b'),
    mustContain: ['Report', 'Fix'],
  },
  {
    id: 'swim-labeled-edge',
    family: 'swimlanes',
    category: 'family-specific',
    variant: 'labeled edge between lanes',
    source: lines('swimlane-beta LR', '  subgraph You', '    a[Ask]', '  end', '  subgraph Them', '    b[Answer]', '  end', '  a -->|question| b'),
    mustContain: ['Ask', 'Answer'],
  },
  {
    id: 'swim-no-direction',
    family: 'swimlanes',
    category: 'structure',
    variant: 'swimlane without explicit direction',
    source: lines('swimlane-beta', '  subgraph A', '    x[X]', '  end', '  subgraph B', '    y[Y]', '  end', '  x --> y'),
  },

  // =========================================================================
  // sequence
  // =========================================================================
  {
    id: 'seq-all-arrows',
    family: 'sequence',
    category: 'family-specific',
    variant: 'every arrow form on one diagram',
    source: lines(
      'sequenceDiagram',
      '  A->>B: solid-head',
      '  A-->>B: dashed-head',
      '  A->B: solid-line',
      '  A-->B: dashed-line',
      '  A-xB: solid-cross',
      '  A--xB: dashed-cross',
      '  A-)B: solid-open',
      '  A--)B: dashed-open',
    ),
  },
  {
    id: 'seq-spaced-colon',
    family: 'sequence',
    category: 'structure',
    variant: 'spaces around message colon (A ->> B : x)',
    source: lines('sequenceDiagram', '  A ->> B : hello'),
    mustContain: ['hello'],
  },
  {
    id: 'seq-note-over-two',
    family: 'sequence',
    category: 'family-specific',
    variant: 'note over two participants',
    source: lines('sequenceDiagram', '  A->>B: x', '  Note over A,B: shared'),
    mustContain: ['shared'],
  },
  {
    id: 'seq-loop',
    family: 'sequence',
    category: 'family-specific',
    variant: 'loop block',
    source: lines('sequenceDiagram', '  loop every minute', '    A->>B: ping', '  end'),
    mustContain: ['ping'],
  },
  {
    id: 'seq-alt-else',
    family: 'sequence',
    category: 'family-specific',
    variant: 'alt/else block',
    source: lines('sequenceDiagram', '  alt yes', '    A->>B: x', '  else no', '    A->>C: y', '  end'),
    mustContain: ['x', 'y'],
  },
  {
    id: 'seq-par',
    family: 'sequence',
    category: 'family-specific',
    variant: 'par/and block',
    source: lines('sequenceDiagram', '  par a', '    A->>B: x', '  and b', '    A->>C: y', '  end'),
  },
  {
    id: 'seq-critical',
    family: 'sequence',
    category: 'family-specific',
    variant: 'critical block',
    source: lines('sequenceDiagram', '  critical must work', '    A->>B: x', '  end'),
  },
  {
    id: 'seq-break',
    family: 'sequence',
    category: 'family-specific',
    variant: 'break block',
    source: lines('sequenceDiagram', '  break on failure', '    A->>B: x', '  end'),
  },
  {
    id: 'seq-rect',
    family: 'sequence',
    category: 'family-specific',
    variant: 'rect color frame',
    source: lines('sequenceDiagram', '  rect rgb(235, 244, 255)', '    A->>B: x', '  end'),
  },
  {
    id: 'seq-box',
    family: 'sequence',
    category: 'family-specific',
    variant: 'box participant group',
    source: lines('sequenceDiagram', '  box Purple Team', '    participant A', '    participant B', '  end', '  A->>B: x'),
  },
  {
    id: 'seq-activate',
    family: 'sequence',
    category: 'family-specific',
    variant: 'activation/deactivation (+/-)',
    source: lines('sequenceDiagram', '  A->>+B: req', '  B-->>-A: resp'),
  },
  {
    id: 'seq-autonumber',
    family: 'sequence',
    category: 'family-specific',
    variant: 'autonumber directive',
    source: lines('sequenceDiagram', '  autonumber', '  A->>B: x'),
  },
  {
    id: 'seq-participant-alias',
    family: 'sequence',
    category: 'family-specific',
    variant: 'participant with alias (as)',
    source: lines('sequenceDiagram', '  participant P as Payment service', '  P->>A: x'),
    mustContain: ['Payment'],
  },
  {
    id: 'seq-actor',
    family: 'sequence',
    category: 'family-specific',
    variant: 'actor declaration',
    source: lines('sequenceDiagram', '  actor User', '  User->>A: x'),
  },
  {
    id: 'seq-chinese-message',
    family: 'sequence',
    category: 'labels',
    variant: 'Chinese message text',
    source: lines('sequenceDiagram', '  A->>B: \u4e2d\u6587\u6d88\u606f'),
    mustContain: ['\u4e2d\u6587\u6d88\u606f'],
  },
  {
    id: 'seq-smart-quote',
    family: 'sequence',
    category: 'punctuation',
    variant: 'smart quotes in message',
    source: lines('sequenceDiagram', '  A->>B: \u201Cquoted\u201D'),
    mustContain: ['quoted'],
  },
  {
    id: 'seq-fence-included',
    family: 'sequence',
    category: 'structure',
    variant: 'source wrapped in ```mermaid fence',
    source: '```mermaid\nsequenceDiagram\n  A->>B: x\n```',
    mustContain: ['x'],
  },
  {
    id: 'seq-init-directive',
    family: 'sequence',
    category: 'structure',
    variant: '%%{init}%% directive before sequence',
    source: lines("%%{init: {'theme':'dark'}}%%", 'sequenceDiagram', '  A->>B: x'),
  },
  {
    id: 'seq-fullwidth-arrow',
    family: 'sequence',
    category: 'punctuation',
    variant: 'full-width dash in arrow',
    source: lines('sequenceDiagram', '  A\uff0d>>B: x'),
  },

  // =========================================================================
  // class
  // =========================================================================
  {
    id: 'class-member-block',
    family: 'class',
    category: 'family-specific',
    variant: 'class member block { +method() }',
    source: lines('classDiagram', '  class A {', '    +method()', '  }'),
    mustContain: ['method'],
  },
  {
    id: 'class-interface-annotation',
    family: 'class',
    category: 'family-specific',
    variant: '<<interface>> annotation on its own line before the name',
    source: lines('classDiagram', '  <<interface>> A', '  A <|-- B'),
    expect: 'renders',
  },
  {
    id: 'class-interface-in-block',
    family: 'class',
    category: 'family-specific',
    variant: '<<interface>> annotation inside a member block',
    source: lines('classDiagram', '  class A {', '    <<interface>>', '    +m()', '  }'),
    mustContain: ['interface'],
  },
  {
    id: 'class-interface-postfix',
    family: 'class',
    category: 'family-specific',
    variant: '<<interface>> annotation postfix after the name',
    source: lines('classDiagram', '  class A', '  A <<interface>>', '  A <|-- B'),
    mustContain: ['interface'],
  },
  {
    id: 'class-note',
    family: 'class',
    category: 'family-specific',
    variant: 'note for A "..." (documented skip)',
    source: lines('classDiagram', '  class A', '  note for A "hello"', '  A --> B'),
    mustContain: ['hello'],
    expect: 'silent-drop',
  },
  {
    id: 'class-direction',
    family: 'class',
    category: 'family-specific',
    variant: 'direction TB directive',
    source: lines('classDiagram', '  direction TB', '  A --> B'),
  },
  {
    id: 'class-namespace',
    family: 'class',
    category: 'family-specific',
    variant: 'namespace container',
    source: lines('classDiagram', '  namespace ns {', '    class A', '  }', '  A --> B'),
  },
  {
    id: 'class-generic',
    family: 'class',
    category: 'family-specific',
    variant: 'generic type (Box~T~)',
    source: lines('classDiagram', '  class Box~T~', '  Box~String~ --> A'),
  },
  {
    id: 'class-member-shorthand',
    family: 'class',
    category: 'family-specific',
    variant: 'member shorthand (A : +foo())',
    source: lines('classDiagram', '  class A', '  A : +foo()', '  A : -bar'),
    mustContain: ['foo', 'bar'],
  },
  {
    id: 'class-member-classifiers',
    family: 'class',
    category: 'family-specific',
    variant: 'member classifiers ($ static, * abstract)',
    source: lines('classDiagram', '  class A {', '    +String name$', '    +run()*', '  }'),
    mustContain: ['name', 'run'],
  },
  {
    id: 'class-stereotype',
    family: 'class',
    category: 'family-specific',
    variant: '<<Service>> stereotype line',
    source: lines('classDiagram', '  class A', '  <<Service>> A', '  A --> B'),
  },
  {
    id: 'class-smart-quote-label',
    family: 'class',
    category: 'punctuation',
    variant: 'smart quotes in relation label',
    source: lines('classDiagram', '  class A', '  A --> B : \u201Crel\u201D'),
    mustContain: ['rel'],
  },

  // =========================================================================
  // state
  // =========================================================================
  {
    id: 'state-pseudo',
    family: 'state',
    category: 'family-specific',
    variant: 'start/end pseudostates ([*])',
    source: lines('stateDiagram-v2', '  [*] --> A', '  A --> [*]'),
  },
  {
    id: 'state-alias',
    family: 'state',
    category: 'family-specific',
    variant: 'state alias (state "desc" as s1)',
    source: lines('stateDiagram-v2', '  state "desc" as s1', '  s1 --> s2'),
    // Mermaid renders the alias's description ("desc") as the box label, not
    // the identifier, so "desc" — not "s1" — must be present.
    mustContain: ['desc'],
  },
  {
    id: 'state-composite',
    family: 'state',
    category: 'family-specific',
    variant: 'composite state block',
    source: lines('stateDiagram-v2', '  state Composite {', '    [*] --> X', '    X --> [*]', '  }'),
  },
  {
    id: 'state-concurrent',
    family: 'state',
    category: 'family-specific',
    variant: 'concurrent regions (--)',
    source: lines('stateDiagram-v2', '  [*] --> A', '  --', '  [*] --> B'),
  },
  {
    id: 'state-choice',
    family: 'state',
    category: 'family-specific',
    variant: 'choice pseudostate (<<choice>>)',
    source: lines('stateDiagram-v2', '  state c <<choice>>', '  A --> c', '  c --> B'),
  },
  {
    id: 'state-fork',
    family: 'state',
    category: 'family-specific',
    variant: 'fork pseudostate (<<fork>>)',
    source: lines('stateDiagram-v2', '  state f <<fork>>', '  A --> f', '  f --> B'),
  },
  {
    id: 'state-note',
    family: 'state',
    category: 'family-specific',
    variant: 'note right of state',
    source: lines('stateDiagram-v2', '  A --> B', '  note right of A : hi'),
    mustContain: ['hi'],
  },
  {
    id: 'state-chinese',
    family: 'state',
    category: 'labels',
    variant: 'Chinese state name',
    source: lines('stateDiagram-v2', '  [*] --> \u5f00\u59cb'),
    mustContain: ['\u5f00\u59cb'],
  },

  // =========================================================================
  // er
  // =========================================================================
  {
    id: 'er-cardinality',
    family: 'er',
    category: 'family-specific',
    variant: 'crow-foot cardinality (||--o{)',
    source: lines('erDiagram', '  A ||--o{ B : has'),
  },
  {
    id: 'er-attributes',
    family: 'er',
    category: 'family-specific',
    variant: 'entity attribute block with PK',
    source: lines('erDiagram', '  A {', '    string id PK', '    string name', '  }', '  A ||--|| B : r'),
    mustContain: ['id', 'name'],
  },
  {
    id: 'er-quoted-attribute',
    family: 'er',
    category: 'family-specific',
    variant: 'quoted attribute name',
    source: lines('erDiagram', '  A {', '    string "full name"', '  }'),
  },
  {
    id: 'er-comment',
    family: 'er',
    category: 'structure',
    variant: '%% comment in er',
    source: lines('erDiagram', '  %% a comment', '  A ||--|| B : r'),
  },

  // =========================================================================
  // user-journey
  // =========================================================================
  {
    id: 'journey-basic',
    family: 'user-journey',
    category: 'family-specific',
    variant: 'sectioned scored task',
    source: lines('journey', '  title T', '  section S', '    Task: 5: Actor'),
    mustContain: ['Task'],
  },
  {
    id: 'journey-emoji',
    family: 'user-journey',
    category: 'labels',
    variant: 'emoji in task label',
    source: lines('journey', '  section S', '    \uD83D\uDE00 Happy: 5: User'),
    mustContain: ['Happy'],
  },
  {
    id: 'journey-chinese',
    family: 'user-journey',
    category: 'labels',
    variant: 'Chinese task and actor',
    source: lines('journey', '  section \u9636\u6bb5', '    \u4efb\u52a1: 5: \u7528\u6237'),
    mustContain: ['\u4efb\u52a1'],
  },

  // =========================================================================
  // gantt
  // =========================================================================
  {
    id: 'gantt-basic',
    family: 'gantt',
    category: 'family-specific',
    variant: 'dated task with done state',
    source: lines('gantt', '  title T', '  section S', '    Task :done, 2024-01-01, 30d'),
    mustContain: ['Task'],
  },
  {
    id: 'gantt-dateformat',
    family: 'gantt',
    category: 'family-specific',
    variant: 'dateFormat YYYY-MM-DD',
    source: lines('gantt', '  dateFormat YYYY-MM-DD', '  section S', '    Task :2024-01-01, 3d'),
  },
  {
    id: 'gantt-axisformat',
    family: 'gantt',
    category: 'family-specific',
    variant: 'axisFormat directive',
    source: lines('gantt', '  axisFormat %m-%d', '  section S', '    Task :2024-01-01, 3d'),
  },
  {
    id: 'gantt-excludes',
    family: 'gantt',
    category: 'family-specific',
    variant: 'excludes weekends',
    source: lines('gantt', '  excludes weekends', '  section S', '    Task :2024-01-01, 10d'),
  },
  {
    id: 'gantt-milestone',
    family: 'gantt',
    category: 'family-specific',
    variant: 'milestone task',
    source: lines('gantt', '  section S', '    Release :milestone, 2024-02-01, 0d'),
    mustContain: ['Release'],
  },
  {
    id: 'gantt-after',
    family: 'gantt',
    category: 'family-specific',
    variant: 'after dependency',
    source: lines('gantt', '  section S', '    A :2024-01-01, 3d', '    B :after A, 2d'),
    mustContain: ['A', 'B'],
  },
  {
    id: 'gantt-crit',
    family: 'gantt',
    category: 'family-specific',
    variant: 'crit task state',
    source: lines('gantt', '  section S', '    A :crit, 2024-01-01, 3d'),
  },

  // =========================================================================
  // pie
  // =========================================================================
  {
    id: 'pie-basic',
    family: 'pie',
    category: 'family-specific',
    variant: 'title + numeric slices',
    source: lines('pie title Chart', '  "a" : 1', '  "b" : 2'),
    mustContain: ['a', 'b'],
  },
  {
    id: 'pie-showdata',
    family: 'pie',
    category: 'family-specific',
    variant: 'showData directive',
    source: lines('pie showData title C', '  "a" : 1', '  "b" : 2'),
  },
  {
    id: 'pie-emoji',
    family: 'pie',
    category: 'labels',
    variant: 'emoji slice labels',
    source: lines('pie', '  "\uD83D\uDE80" : 1', '  "\uD83D\uDC22" : 2'),
  },
  {
    id: 'pie-chinese',
    family: 'pie',
    category: 'labels',
    variant: 'Chinese slice label',
    source: lines('pie', '  "\u82f9\u679c" : 3'),
    mustContain: ['\u82f9\u679c'],
  },

  // =========================================================================
  // quadrant
  // =========================================================================
  {
    id: 'quadrant-basic',
    family: 'quadrant',
    category: 'family-specific',
    variant: 'axes, quadrants, one point',
    source: lines('quadrantChart', '  title T', '  x-axis a --> b', '  y-axis c --> d', '  quadrant-1 Q1', '  A: [0.3, 0.6]'),
    mustContain: ['A'],
  },
  {
    id: 'quadrant-point-links',
    family: 'quadrant',
    category: 'family-specific',
    variant: 'point-to-point connector (A --> B)',
    source: lines('quadrantChart', '  A: [0.3, 0.6]', '  B: [0.7, 0.2]', '  A --> B'),
    mustContain: ['A', 'B'],
  },
  {
    id: 'quadrant-point-style',
    family: 'quadrant',
    category: 'family-specific',
    variant: 'direct point styling (radius/color/stroke)',
    source: lines('quadrantChart', '  A: [0.3, 0.6] radius: 10, color: #f00'),
    mustContain: ['A'],
  },
  {
    id: 'quadrant-classdef',
    family: 'quadrant',
    category: 'family-specific',
    variant: 'classDef + :::class point (advertised in matrix)',
    source: lines('quadrantChart', '  classDef x fill:#f00', '  A: [0.3, 0.6]:::x'),
    // The matrix advertises quadrant.classes (classDef + :::class). The parser
    // now accepts both the leading `A:::x: [..]` and trailing `A: [..]:::x`
    // class forms and treats `fill` as an alias of `color`, so this renders.
    mustContain: ['A'],
  },
  {
    id: 'quadrant-smart-quote-title',
    family: 'quadrant',
    category: 'punctuation',
    variant: 'smart quotes in title',
    source: lines('quadrantChart', '  title \u201CQuoted\u201D', '  A: [0.3, 0.6]'),
    mustContain: ['Quoted'],
  },

  // =========================================================================
  // requirement
  // =========================================================================
  {
    id: 'requirement-basic',
    family: 'requirement',
    category: 'family-specific',
    variant: 'typed requirement block',
    source: lines(
      'requirementDiagram',
      '  requirement R {',
      '    id: 1',
      '    text: hi',
      '    risk: high',
      '    verifymethod: test',
      '  }',
    ),
    mustContain: ['hi'],
  },
  {
    id: 'requirement-relation',
    family: 'requirement',
    category: 'family-specific',
    variant: 'labeled semantic relationship',
    source: lines(
      'requirementDiagram',
      '  requirement A {',
      '    id: 1',
      '    text: a',
      '  }',
      '  requirement B {',
      '    id: 2',
      '    text: b',
      '  }',
      '  A - contains -> B',
    ),
    mustContain: ['a', 'b'],
  },
  {
    id: 'requirement-functional',
    family: 'requirement',
    category: 'family-specific',
    variant: 'functionalRequirement block',
    source: lines('requirementDiagram', '  functionalRequirement F {', '    id: 1', '    text: f', '  }'),
  },

  // =========================================================================
  // gitgraph
  // =========================================================================
  {
    id: 'gitgraph-branch-merge',
    family: 'gitgraph',
    category: 'family-specific',
    variant: 'branch, checkout, merge',
    source: lines(
      'gitGraph',
      '  commit id: "v1"',
      '  branch dev',
      '  checkout dev',
      '  commit id: "w"',
      '  checkout main',
      '  merge dev',
    ),
  },
  {
    id: 'gitgraph-tag',
    family: 'gitgraph',
    category: 'family-specific',
    variant: 'commit with tag',
    source: lines('gitGraph', '  commit id: "v1" tag: "v1.0"'),
  },
  {
    id: 'gitgraph-type',
    family: 'gitgraph',
    category: 'family-specific',
    variant: 'commit type: HIGHLIGHT',
    source: lines('gitGraph', '  commit type: HIGHLIGHT id: "h"'),
  },
  {
    id: 'gitgraph-cherry-pick',
    family: 'gitgraph',
    category: 'family-specific',
    variant: 'cherry-pick across branches',
    source: lines('gitGraph', '  commit id: "a"', '  branch d', '  checkout d', '  commit id: "b"', '  checkout main', '  cherry-pick id: "b"'),
  },

  // =========================================================================
  // c4
  // =========================================================================
  {
    id: 'c4-context',
    family: 'c4',
    category: 'family-specific',
    variant: 'Person/System/Rel',
    source: lines('C4Context', '  Person(u, "User")', '  System(s, "Sys")', '  Rel(u, s, "uses")'),
    mustContain: ['User', 'Sys'],
  },
  {
    id: 'c4-container',
    family: 'c4',
    category: 'family-specific',
    variant: 'C4Container with Container()',
    source: lines('C4Container', '  Container(c, "C", "tech")', '  Rel(c, c, "x")'),
  },
  {
    id: 'c4-boundary',
    family: 'c4',
    category: 'family-specific',
    variant: 'Enterprise_Boundary block',
    source: lines('C4Context', '  Enterprise_Boundary(b, "B") {', '    System(s, "S")', '  }'),
  },

  // =========================================================================
  // mindmap
  // =========================================================================
  {
    id: 'mindmap-icon-inline',
    family: 'mindmap',
    category: 'family-specific',
    variant: '::icon prefix on same line as label',
    source: lines('mindmap', '  root((M))', '    ::icon(fa fa-book) Docs'),
    mustContain: ['Docs'],
  },
  {
    id: 'mindmap-shapes',
    family: 'mindmap',
    category: 'family-specific',
    variant: 'multiple node shapes',
    source: lines('mindmap', '  root((M))', '    A[Square]', '    B(Rounded)', '    C((Circle))'),
    mustContain: ['Square', 'Rounded', 'Circle'],
  },
  {
    id: 'mindmap-indent',
    family: 'mindmap',
    category: 'family-specific',
    variant: 'space-indented hierarchy',
    source: lines('mindmap', '  root((M))', '    A', '      A1', '    B'),
    mustContain: ['A1'],
  },
  {
    id: 'mindmap-markdown',
    family: 'mindmap',
    category: 'labels',
    variant: 'markdown bold string node',
    source: lines('mindmap', '  root((M))', '    **bold**'),
    mustContain: ['bold'],
  },
  {
    id: 'mindmap-icon-unknown',
    family: 'mindmap',
    category: 'family-specific',
    variant: 'unknown FontAwesome icon degrades to text',
    source: lines('mindmap', '  root((M))', '    ::icon(fa fa-nope) X'),
    mustContain: ['X'],
  },
  {
    id: 'mindmap-chinese',
    family: 'mindmap',
    category: 'labels',
    variant: 'Chinese node labels',
    source: lines('mindmap', '  root((\u6839))', '    \u5b50\u8282\u70b9'),
    mustContain: ['\u5b50\u8282\u70b9'],
  },

  // =========================================================================
  // timeline
  // =========================================================================
  {
    id: 'timeline-basic',
    family: 'timeline',
    category: 'family-specific',
    variant: 'period : event',
    source: lines('timeline', '  title T', '  2020 : Event'),
    mustContain: ['Event'],
  },
  {
    id: 'timeline-sections',
    family: 'timeline',
    category: 'family-specific',
    variant: 'section groupings',
    source: lines('timeline', '  section S', '    2020 : A', '    2021 : B'),
    mustContain: ['A', 'B'],
  },
  {
    id: 'timeline-multi-event',
    family: 'timeline',
    category: 'family-specific',
    variant: 'multiple events per period',
    source: lines('timeline', '  2020 : A : B : C'),
    mustContain: ['A', 'B', 'C'],
  },

  // =========================================================================
  // zenuml
  // =========================================================================
  {
    id: 'zenuml-call',
    family: 'zenuml',
    category: 'family-specific',
    variant: 'labeled direct call',
    source: lines('zenuml', '  A->B: hello'),
    mustContain: ['hello'],
  },
  {
    id: 'zenuml-return',
    family: 'zenuml',
    category: 'family-specific',
    variant: 'call and return',
    source: lines('zenuml', '  A->B: x', '  B-->A: y'),
    mustContain: ['x', 'y'],
  },
  {
    id: 'zenuml-participant',
    family: 'zenuml',
    category: 'family-specific',
    variant: 'participant declaration',
    source: lines('zenuml', '  participant A', '  A->B: x'),
  },
  {
    id: 'zenuml-if-block',
    family: 'zenuml',
    category: 'family-specific',
    variant: 'if block (documented unsupported)',
    source: lines('zenuml', '  if (x) {', '    A->B: y', '  }'),
    expect: 'throws',
  },

  // =========================================================================
  // sankey
  // =========================================================================
  {
    id: 'sankey-basic',
    family: 'sankey',
    category: 'family-specific',
    variant: 'three-column CSV records',
    source: lines('sankey', 'A,B,10', 'B,C,5'),
    mustContain: ['A'],
  },
  {
    id: 'sankey-quoted-fields',
    family: 'sankey',
    category: 'family-specific',
    variant: 'quoted CSV fields with spaces',
    source: lines('sankey', '"a b","c d",10'),
    mustContain: ['a b'],
  },
  {
    id: 'sankey-cycle',
    family: 'sankey',
    category: 'family-specific',
    variant: 'cyclic flow (documented unsupported)',
    source: lines('sankey', 'A,B,10', 'B,A,5'),
    expect: 'throws',
  },
  {
    id: 'sankey-config',
    family: 'sankey',
    category: 'family-specific',
    variant: 'config block (documented unsupported)',
    source: lines('sankey', 'config:', '  showValues: true', 'A,B,10'),
    expect: 'throws',
  },
  {
    id: 'sankey-invalid-value',
    family: 'sankey',
    category: 'family-specific',
    variant: 'non-numeric weight',
    source: lines('sankey', 'A,B,abc'),
    expect: 'throws',
  },

  // =========================================================================
  // xychart
  // =========================================================================
  {
    id: 'xychart-bar',
    family: 'xychart',
    category: 'family-specific',
    variant: 'categorical bar series',
    source: lines('xychart-beta', '  title "T"', '  x-axis [a, b, c]', '  y-axis 0 --> 10', '  bar [1, 2, 3]'),
  },
  {
    id: 'xychart-line',
    family: 'xychart',
    category: 'family-specific',
    variant: 'line series with numeric x-axis',
    source: lines('xychart-beta', '  x-axis [1, 2, 3]', '  y-axis 0 --> 10', '  line [1, 2, 3]'),
  },
  {
    id: 'xychart-axis-titles',
    family: 'xychart',
    category: 'family-specific',
    variant: 'quoted axis titles',
    source: lines('xychart-beta', '  title "Latency"', '  x-axis [100, 200]', '  y-axis "ms" 0 --> 100', '  bar [1, 2]'),
  },
  {
    id: 'xychart-chinese-title',
    family: 'xychart',
    category: 'labels',
    variant: 'Chinese title',
    source: lines('xychart-beta', '  title "\u5ef6\u8fdf"', '  x-axis [a]', '  y-axis 0 --> 10', '  bar [1]'),
    mustContain: ['\u5ef6\u8fdf'],
  },

  // =========================================================================
  // block
  // =========================================================================
  {
    id: 'block-columns',
    family: 'block',
    category: 'family-specific',
    variant: 'columns grid',
    source: lines('block-beta', '  columns 3', '  A B C'),
    mustContain: ['A', 'B', 'C'],
  },
  {
    id: 'block-span',
    family: 'block',
    category: 'family-specific',
    variant: 'span declaration (A:3)',
    source: lines('block-beta', '  columns 3', '  A:3'),
  },
  {
    id: 'block-relationship',
    family: 'block',
    category: 'family-specific',
    variant: 'direct --> relationship',
    source: lines('block-beta', '  A', '  B', '  A --> B'),
  },
  {
    id: 'block-labeled',
    family: 'block',
    category: 'family-specific',
    variant: 'bracketed block label (with columns)',
    source: lines('block-beta', '  columns 2', '  A["Label"] B'),
    mustContain: ['Label'],
  },
  {
    id: 'block-nested',
    family: 'block',
    category: 'family-specific',
    variant: 'nested block (documented unsupported)',
    source: lines('block-beta', '  block:g', '    A', '  end'),
    expect: 'throws',
  },

  // =========================================================================
  // packet
  // =========================================================================
  {
    id: 'packet-plus-width',
    family: 'packet',
    category: 'family-specific',
    variant: '+width bit fields',
    source: lines('packet', 'title T', '+8: "A"', '+16: "B"'),
    mustContain: ['A'],
  },
  {
    id: 'packet-bit-range',
    family: 'packet',
    category: 'family-specific',
    variant: 'absolute bit range (64-127)',
    source: lines('packet', '64-127: "Payload"'),
    mustContain: ['Payload'],
  },
  {
    id: 'packet-chinese',
    family: 'packet',
    category: 'labels',
    variant: 'Chinese field label',
    source: lines('packet', '+8: "\u7248\u672c"'),
    mustContain: ['\u7248\u672c'],
  },

  // =========================================================================
  // kanban
  // =========================================================================
  {
    id: 'kanban-columns',
    family: 'kanban',
    category: 'family-specific',
    variant: 'column with bracketed label and task',
    source: lines('kanban', '  done[A]', '    t1[Task]'),
    mustContain: ['Task'],
  },
  {
    id: 'kanban-ticket',
    family: 'kanban',
    category: 'family-specific',
    variant: '@{ ticket } metadata',
    source: lines('kanban', '  todo[T]', '    task[X]@{ ticket: XM-1 }'),
    mustContain: ['X'],
  },
  {
    id: 'kanban-chinese',
    family: 'kanban',
    category: 'labels',
    variant: 'ASCII ids with Chinese column/task labels',
    source: lines('kanban', '  done[\u5b8c\u6210]', '    task[\u4efb\u52a1]'),
    mustContain: ['\u4efb\u52a1'],
  },
  {
    id: 'kanban-chinese-id',
    family: 'kanban',
    category: 'structure',
    variant: 'Chinese column id (\u5b8c\u6210[Done])',
    source: lines('kanban', '  \u5b8c\u6210[Done]', '    \u4efb\u52a1[Task]'),
    expect: 'renders',
  },
  {
    id: 'kanban-unsupported-metadata',
    family: 'kanban',
    category: 'family-specific',
    variant: 'metadata key beyond ticket (documented unsupported)',
    source: lines('kanban', '  todo[T]', '    task[X]@{ assigned: bob }'),
    expect: 'throws',
  },

  // =========================================================================
  // architecture
  // =========================================================================
  {
    id: 'architecture-services',
    family: 'architecture',
    category: 'family-specific',
    variant: 'two services with port relationship',
    source: lines('architecture-beta', '  service a(server)[A]', '  service b(database)[B]', '  a:R --> L:b'),
    mustContain: ['A', 'B'],
  },
  {
    id: 'architecture-groups',
    family: 'architecture',
    category: 'family-specific',
    variant: 'group membership (in)',
    source: lines('architecture-beta', '  group g(system)[G]', '  service a(server)[A] in g'),
  },
  {
    id: 'architecture-junction',
    family: 'architecture',
    category: 'family-specific',
    variant: 'junction node',
    source: lines('architecture-beta', '  junction j', '  service a(server)[A]', '  a:R --> L:j'),
  },
  {
    id: 'architecture-align',
    family: 'architecture',
    category: 'family-specific',
    variant: 'align directive (documented unsupported)',
    source: lines('architecture-beta', '  align row', '  service a(server)[A]'),
    expect: 'throws',
  },

  // =========================================================================
  // radar
  // =========================================================================
  {
    id: 'radar-basic',
    family: 'radar',
    category: 'family-specific',
    variant: 'named axes + one curve',
    source: lines('radar-beta', '  axis a["A"], b["B"], c["C"]', '  curve x{1, 2, 3}', '  min 0', '  max 5'),
  },
  {
    id: 'radar-two-curves',
    family: 'radar',
    category: 'family-specific',
    variant: 'two curves',
    source: lines('radar-beta', '  axis a, b, c', '  curve x{1, 2, 3}', '  curve y{3, 2, 1}'),
  },
  {
    id: 'radar-graticule',
    family: 'radar',
    category: 'family-specific',
    variant: 'graticule + ticks',
    source: lines('radar-beta', '  axis a, b, c', '  curve x{1, 2, 3}', '  graticule circle', '  ticks 4'),
  },

  // =========================================================================
  // event-modeling
  // =========================================================================
  {
    id: 'eventmodeling-basic',
    family: 'event-modeling',
    category: 'family-specific',
    variant: 'tf timeframes',
    source: lines('eventmodeling', '  tf 01 ui A', '  tf 02 cmd B', '  tf 03 evt C'),
    mustContain: ['A', 'B', 'C'],
  },
  {
    id: 'eventmodeling-reset',
    family: 'event-modeling',
    category: 'family-specific',
    variant: 'rf reset frame',
    source: lines('eventmodeling', '  tf 01 evt A', '  rf 02 evt B'),
  },
  {
    id: 'eventmodeling-readmodel',
    family: 'event-modeling',
    category: 'family-specific',
    variant: 'readmodel entity',
    source: lines('eventmodeling', '  tf 01 readmodel R'),
  },

  // =========================================================================
  // treemap
  // =========================================================================
  {
    id: 'treemap-four-space',
    family: 'treemap',
    category: 'family-specific',
    variant: 'four-space indentation (canonical form)',
    source: lines('treemap-beta', '"Root"', '    "Child": 10'),
    mustContain: ['Child'],
  },
  {
    id: 'treemap-basic',
    family: 'treemap',
    category: 'structure',
    variant: 'two-space indentation with leaf value',
    source: lines('treemap-beta', '"Root"', '  "Child": 10'),
    expect: 'renders',
  },
  {
    id: 'treemap-nested',
    family: 'treemap',
    category: 'structure',
    variant: 'two-space nested hierarchy',
    source: lines('treemap-beta', '"A"', '  "B"', '    "C": 5'),
    expect: 'renders',
  },
  {
    id: 'treemap-chinese',
    family: 'treemap',
    category: 'labels',
    variant: 'Chinese labels with two-space indent',
    source: lines('treemap-beta', '"\u6839"', '  "\u5b50": 10'),
    expect: 'renders',
  },

  // =========================================================================
  // venn
  // =========================================================================
  {
    id: 'venn-basic',
    family: 'venn',
    category: 'family-specific',
    variant: 'two named sets',
    source: lines('venn-beta', '  set A', '  set B'),
    mustContain: ['A', 'B'],
  },
  {
    id: 'venn-union',
    family: 'venn',
    category: 'family-specific',
    variant: 'labeled union',
    source: lines('venn-beta', '  set A', '  set B', '  union A,B["AB"]'),
  },
  {
    id: 'venn-title',
    family: 'venn',
    category: 'family-specific',
    variant: 'quoted title',
    source: lines('venn-beta', '  title "T"', '  set A', '  set B'),
  },

  // =========================================================================
  // ishikawa
  // =========================================================================
  {
    id: 'ishikawa-basic',
    family: 'ishikawa',
    category: 'family-specific',
    variant: 'effect with category and cause',
    source: lines('ishikawa-beta', '  Effect', '  Category', '    Cause'),
    mustContain: ['Effect', 'Category', 'Cause'],
  },
  {
    id: 'ishikawa-nested',
    family: 'ishikawa',
    category: 'family-specific',
    variant: 'nested cause',
    source: lines('ishikawa-beta', '  Effect', '  People', '    Lack of training'),
    mustContain: ['training'],
  },

  // =========================================================================
  // wardley
  // =========================================================================
  {
    id: 'wardley-basic',
    family: 'wardley',
    category: 'family-specific',
    variant: 'anchor, component, dependency',
    source: lines('wardley-beta', 'title T', 'anchor A [0.9, 0.8]', 'component B [0.5, 0.5]', 'A -> B'),
    mustContain: ['A', 'B'],
  },
  {
    id: 'wardley-evolve',
    family: 'wardley',
    category: 'family-specific',
    variant: 'evolve directive (documented unsupported)',
    source: lines('wardley-beta', 'component A [0.5, 0.5]', 'evolve A 0.8'),
    expect: 'throws',
  },
  {
    id: 'wardley-chinese-title',
    family: 'wardley',
    category: 'labels',
    variant: 'Chinese map title',
    source: lines('wardley-beta', 'title \u5730\u56fe', 'anchor A [0.9, 0.8]'),
    mustContain: ['\u5730\u56fe'],
  },

  // =========================================================================
  // cynefin
  // =========================================================================
  {
    id: 'cynefin-basic',
    family: 'cynefin',
    category: 'family-specific',
    variant: 'domains with quoted items',
    source: lines('cynefin-beta', 'title T', 'clear', '"a"', 'complex', '"b"'),
    mustContain: ['a', 'b'],
  },
  {
    id: 'cynefin-transition',
    family: 'cynefin',
    category: 'family-specific',
    variant: 'labeled transition between domains',
    source: lines('cynefin-beta', 'clear', '"a"', 'complex', '"b"', 'clear --> complex : "x"'),
  },
  {
    id: 'cynefin-chinese',
    family: 'cynefin',
    category: 'labels',
    variant: 'Chinese item',
    source: lines('cynefin-beta', 'clear', '"\u4fee\u590d"'),
    mustContain: ['\u4fee\u590d'],
  },

  // =========================================================================
  // treeview
  // =========================================================================
  {
    id: 'treeview-basic',
    family: 'treeview',
    category: 'family-specific',
    variant: 'indented hierarchy',
    source: lines('tree', '  Root', '    Child', '      Grandchild'),
    mustContain: ['Child', 'Grandchild'],
  },
  {
    id: 'treeview-chinese',
    family: 'treeview',
    category: 'labels',
    variant: 'Chinese node labels',
    source: lines('tree', '  \u6839', '    \u5b50\u8282\u70b9'),
    mustContain: ['\u5b50\u8282\u70b9'],
  },

  // =========================================================================
  // SECURITY — injection probes (each re-rendered with sanitizeSvg disabled)
  // =========================================================================
  {
    id: 'sec-script-tag-label',
    family: 'flowchart',
    category: 'security',
    variant: '<script> in node label',
    source: lines('flowchart TD', '  A["<script>alert(1)</script>"] --> B'),
    security: true,
  },
  {
    id: 'sec-img-onerror',
    family: 'flowchart',
    category: 'security',
    variant: '<img onerror> in node label',
    source: lines('flowchart TD', '  A["<img src=x onerror=alert(1)>"] --> B'),
    security: true,
  },
  {
    id: 'sec-svg-onload',
    family: 'flowchart',
    category: 'security',
    variant: '<svg onload> in node label',
    source: lines('flowchart TD', '  A["<svg onload=alert(1)>"] --> B'),
    security: true,
  },
  {
    id: 'sec-foreignobject',
    family: 'flowchart',
    category: 'security',
    variant: '<foreignObject> with onload in label',
    source: lines('flowchart TD', '  A["<foreignObject><body onload=alert(1)></body></foreignObject>"] --> B'),
    security: true,
  },
  {
    id: 'sec-iframe',
    family: 'flowchart',
    category: 'security',
    variant: '<iframe src=javascript:> in label',
    source: lines('flowchart TD', '  A["<iframe src=javascript:alert(1)>"] --> B'),
    security: true,
  },
  {
    id: 'sec-nested-svg-script',
    family: 'flowchart',
    category: 'security',
    variant: '<svg><script> nested in label',
    source: lines('flowchart TD', '  A["<svg><script>alert(1)</script></svg>"] --> B'),
    security: true,
  },
  {
    id: 'sec-br-then-script',
    family: 'flowchart',
    category: 'security',
    variant: '<br/> followed by <script> in label',
    source: lines('flowchart TD', '  A["<br/><script>alert(1)</script>"] --> B'),
    security: true,
  },
  {
    id: 'sec-js-edge-label',
    family: 'flowchart',
    category: 'security',
    variant: 'javascript: URL in edge label',
    source: lines('flowchart TD', '  A -->|javascript:alert(1)| B'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-js-node-label',
    family: 'flowchart',
    category: 'security',
    variant: 'javascript: URL in node label',
    source: lines('flowchart TD', '  A[javascript:alert(1)] --> B'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-click-javascript',
    family: 'flowchart',
    category: 'security',
    variant: 'click with javascript: URL',
    source: lines('flowchart TD', '  A --> B', '  click A "javascript:alert(1)"'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-click-https',
    family: 'flowchart',
    category: 'security',
    variant: 'click with https URL (strict blocks all clicks)',
    source: lines('flowchart TD', '  A --> B', '  click A "https://example.com"'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-classdef-url-ref',
    family: 'flowchart',
    category: 'security',
    variant: 'classDef fill:url(#ref)',
    source: lines('flowchart TD', '  A --> B', '  classDef x fill:url(#evil)', '  class A x'),
    security: true,
    expect: 'throws',
  },
  {
    id: 'sec-classdef-js-url',
    family: 'flowchart',
    category: 'security',
    variant: 'classDef fill:url(javascript:)',
    source: lines('flowchart TD', '  A --> B', '  classDef x fill:url(javascript:alert(1))', '  class A x'),
    security: true,
    expect: 'throws',
  },
  {
    id: 'sec-style-js-url',
    family: 'flowchart',
    category: 'security',
    variant: 'style fill:url(javascript:)',
    source: lines('flowchart TD', '  A --> B', '  style A fill:url(javascript:alert(1))'),
    security: true,
    expect: 'throws',
  },
  {
    id: 'sec-data-url-label',
    family: 'flowchart',
    category: 'security',
    variant: 'data:text/html URL in node label',
    source: lines('flowchart TD', '  A[data:text/html,<script>alert(1)</script>] --> B'),
    security: true,
  },
  {
    id: 'sec-vbscript-url',
    family: 'flowchart',
    category: 'security',
    variant: 'vbscript: URL in node label',
    source: lines('flowchart TD', '  A[vbscript:msgbox(1)] --> B'),
    security: true,
  },
  {
    id: 'sec-mixed-case-script',
    family: 'flowchart',
    category: 'security',
    variant: 'mixed-case <ScRiPt> tag',
    source: lines('flowchart TD', '  A["<ScRiPt>alert(1)</sCrIpT>"] --> B'),
    security: true,
  },
  {
    id: 'sec-entity-bypass',
    family: 'flowchart',
    category: 'security',
    variant: 'entity-encoded &#60;script&#62;',
    source: lines('flowchart TD', '  A["&#60;script&#62;alert(1)&#60;/script&#62;"] --> B'),
    security: true,
  },
  {
    id: 'sec-newline-split-js',
    family: 'flowchart',
    category: 'security',
    variant: 'javascript: split across newline',
    source: lines('flowchart TD', '  A[java', 'script:alert(1)] --> B'),
    security: true,
  },
  {
    id: 'sec-tab-split-js',
    family: 'flowchart',
    category: 'security',
    variant: 'javascript: split by tab',
    source: lines('flowchart TD', '  A[java\tscript:alert(1)] --> B'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-loose-init-directive',
    family: 'flowchart',
    category: 'security',
    variant: '%%{init securityLevel loose}%% directive',
    source: lines("%%{init: {'securityLevel':'loose'}}%%", 'flowchart TD', '  A --> B'),
    security: true,
  },
  {
    id: 'sec-click-href-javascript',
    family: 'flowchart',
    category: 'security',
    variant: 'click A href "javascript:"',
    source: lines('flowchart TD', '  A --> B', '  click A href "javascript:alert(1)"'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-sequence-html',
    family: 'sequence',
    category: 'security',
    variant: '<script> in sequence message',
    source: lines('sequenceDiagram', '  A->>B: <script>alert(1)</script>'),
    security: true,
  },
  {
    id: 'sec-class-html-member',
    family: 'class',
    category: 'security',
    variant: '<script> in class member',
    source: lines('classDiagram', '  class A {', '    +<script>alert(1)</script>', '  }'),
    security: true,
  },
  {
    id: 'sec-pie-html-label',
    family: 'pie',
    category: 'security',
    variant: '<img onerror> in pie slice label',
    source: lines('pie', '  "<img src=x onerror=alert(1)>" : 1'),
    security: true,
  },
  {
    id: 'sec-gantt-html-task',
    family: 'gantt',
    category: 'security',
    variant: '<script> in gantt task name',
    source: lines('gantt', '  section S', '    <script>alert(1)</script> :2024-01-01, 3d'),
    security: true,
  },
  {
    id: 'sec-quadrant-html-point',
    family: 'quadrant',
    category: 'security',
    variant: '<svg onload> in quadrant point label',
    source: lines('quadrantChart', '  <svg onload=alert(1)>: [0.3, 0.6]'),
    security: true,
  },
  {
    id: 'sec-xychart-html-title',
    family: 'xychart',
    category: 'security',
    variant: '<script> in xychart title',
    source: lines('xychart-beta', '  title "<script>alert(1)</script>"', '  x-axis [a]', '  y-axis 0 --> 10', '  bar [1]'),
    security: true,
  },
  {
    id: 'sec-mindmap-html-node',
    family: 'mindmap',
    category: 'security',
    variant: '<img onerror> in mindmap node',
    source: lines('mindmap', '  root((M))', '    <img src=x onerror=alert(1)>'),
    security: true,
  },
  {
    id: 'sec-timeline-html-event',
    family: 'timeline',
    category: 'security',
    variant: '<script> in timeline event',
    source: lines('timeline', '  2020 : <script>alert(1)</script>'),
    security: true,
  },
  {
    id: 'sec-state-html-note',
    family: 'state',
    category: 'security',
    variant: '<script> in state note',
    source: lines('stateDiagram-v2', '  A --> B', '  note right of A : <script>alert(1)</script>'),
    security: true,
  },
  {
    id: 'sec-cynefin-html-item',
    family: 'cynefin',
    category: 'security',
    variant: '<script> in cynefin quoted item',
    source: lines('cynefin-beta', 'clear', '"<script>alert(1)</script>"'),
    security: true,
  },
  {
    id: 'sec-treemap-html-label',
    family: 'treemap',
    category: 'security',
    variant: '<script> in treemap label',
    source: lines('treemap-beta', '"<script>alert(1)</script>"', '  "x": 1'),
    security: true,
  },
  {
    id: 'sec-venn-html-set',
    family: 'venn',
    category: 'security',
    variant: '<script> in venn set name',
    source: lines('venn-beta', '  set <script>alert(1)</script>'),
    security: true,
  },
  {
    id: 'sec-packet-html-field',
    family: 'packet',
    category: 'security',
    variant: '<script> in packet field label',
    source: lines('packet', '+8: "<script>alert(1)</script>"'),
    security: true,
  },

  // -------------------------------------------------------------------------
  // New P1 tolerance paths: each newly-accepted construct is probed with an
  // injection payload so the added tolerance does not widen the attack surface.
  // -------------------------------------------------------------------------
  {
    id: 'sec-kanban-html-id',
    family: 'kanban',
    category: 'security',
    variant: '<img onerror> as a kanban column id',
    source: lines('kanban', '  <img src=x onerror=alert(1)>[X]'),
    security: true,
  },
  {
    id: 'sec-quadrant-classdef-html',
    family: 'quadrant',
    category: 'security',
    variant: '<script> as a quadrant classDef name',
    source: lines('quadrantChart', '  classDef <script> fill:#f00', '  A: [0.3, 0.6]'),
    security: true,
  },
  {
    id: 'sec-quadrant-trailing-class-html',
    family: 'quadrant',
    category: 'security',
    variant: '<script> as a trailing :::class point reference',
    source: lines('quadrantChart', '  A: [0.3, 0.6]:::<script>'),
    security: true,
  },
  {
    id: 'sec-c4-boundary-html-label',
    family: 'c4',
    category: 'security',
    variant: '<img onerror> in a C4 boundary label (block on call line)',
    source: lines('C4Context', '  Enterprise_Boundary(b, "<img src=x onerror=alert(1)>") {', '    System(s, "S")', '  }'),
    security: true,
  },
  {
    id: 'sec-class-note-html',
    family: 'class',
    category: 'security',
    variant: '<script> in an accepted-and-skipped class note',
    source: lines('classDiagram', '  class A', '  note for A "<script>alert(1)</script>"', '  A --> B'),
    security: true,
  },
  {
    id: 'sec-sequence-bare-arrow-html',
    family: 'sequence',
    category: 'security',
    variant: '<img onerror> on a bare no-head arrow label',
    source: lines('sequenceDiagram', '  A->B: <img src=x onerror=alert(1)>'),
    security: true,
  },
  {
    id: 'sec-mindmap-icon-html',
    family: 'mindmap',
    category: 'security',
    variant: '<img onerror> as an inline mindmap icon name',
    source: lines('mindmap', '  root((M))', '    ::icon(<img src=x onerror=alert(1)>) Docs'),
    security: true,
  },

  // -------------------------------------------------------------------------
  // P0/P1 tolerance paths not covered above: normalization (smart dash, BOM),
  // backslash-escaped pipes, standalone class stereotypes, state concurrent
  // regions, and zenuml declarations. Each carries an injection payload so the
  // new tolerance is proven not to widen the attack surface (§3.3).
  // -------------------------------------------------------------------------
  {
    id: 'sec-en-dash-arrow-html',
    family: 'flowchart',
    category: 'security',
    variant: '<script> in a node label reached via a normalized en-dash arrow',
    source: lines('flowchart TD', '  A \u2013> B["<script>alert(1)</script>"]'),
    security: true,
  },
  {
    id: 'sec-bom-js-url',
    family: 'flowchart',
    category: 'security',
    variant: 'javascript: URL behind a stripped UTF-8 BOM',
    source: '\uFEFF' + lines('flowchart TD', '  A[javascript:alert(1)] --> B'),
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-escaped-pipe-html',
    family: 'flowchart',
    category: 'security',
    variant: '<img onerror> inside a backslash-escaped pipe edge label',
    source: lines('flowchart TD', '  A -->|a \\| <img src=x onerror=alert(1)> \\| b| B'),
    security: true,
  },
  {
    id: 'sec-class-standalone-interface-html',
    family: 'class',
    category: 'security',
    variant: '<script> as the class name on a standalone <<interface>> line',
    source: lines('classDiagram', '  <<interface>> <script>alert(1)</script>', '  A <|-- B'),
    security: true,
  },
  {
    id: 'sec-state-concurrent-html',
    family: 'state',
    category: 'security',
    variant: '<script> in a note next to a concurrent-region separator (--)',
    source: lines('stateDiagram-v2', '  [*] --> A', '  --', '  note right of A : <script>alert(1)</script>'),
    security: true,
  },
  {
    id: 'sec-zenuml-declaration-html',
    family: 'zenuml',
    category: 'security',
    variant: '<script> as a declared zenuml participant name',
    source: lines('zenuml', '  participant <script>alert(1)</script>', '  A->B: x'),
    security: true,
  },
  {
    id: 'sec-kanban-chinese-id-html',
    family: 'kanban',
    category: 'security',
    variant: '<img onerror> as the label of a non-ASCII kanban column id',
    source: lines('kanban', '  \u5b8c\u6210[<img src=x onerror=alert(1)>]', '    \u4efb\u52a1[Task]'),
    security: true,
  },

  // -------------------------------------------------------------------------
  // Fence unwrapping: the fence is removed *before* the support and security
  // gates, and both gates plus the parser receive the same normalized text, so
  // a payload inside a fence must still be neutralized.
  // -------------------------------------------------------------------------
  {
    id: 'sec-fence-script-label',
    family: 'flowchart',
    category: 'security',
    variant: '<script> in a node label inside a ```mermaid fence',
    source: '```mermaid\nflowchart TD\n  A["<script>alert(1)</script>"] --> B\n```',
    security: true,
  },
  {
    id: 'sec-fence-js-url',
    family: 'flowchart',
    category: 'security',
    variant: 'javascript: URL inside a ```mermaid fence',
    source: '```mermaid\nflowchart TD\n  A[javascript:alert(1)] --> B\n```',
    security: true,
    expect: 'security-blocked',
  },
  {
    id: 'sec-fence-tilde-html',
    family: 'flowchart',
    category: 'security',
    variant: '<img onerror> inside a ~~~mermaid fence',
    source: '~~~mermaid\nflowchart TD\n  A["<img src=x onerror=alert(1)>"] --> B\n~~~',
    security: true,
  },
  {
    id: 'sec-fence-trailing-payload',
    family: 'flowchart',
    category: 'security',
    variant: '<script> placed after the closing fence',
    source: '```mermaid\nflowchart TD\n  A --> B\n```\n<script>alert(1)</script>',
    security: true,
    note: 'the trailing content is outside the block, so it never reaches the renderer; the probe proves dropping it does not leave a hole',
  },
  {
    id: 'sec-fence-unclosed-payload',
    family: 'flowchart',
    category: 'security',
    variant: '<svg onload> in a truncated (unclosed) fence',
    source: '```mermaid\nflowchart TD\n  A["<svg onload=alert(1)>"] --> B',
    security: true,
  },

  // =========================================================================
  // <br/> label fidelity — one probe per documented family (30 total)
  //
  // Each probe appends `<br/>BRPROBE` inside a label the family already renders
  // (the base is an existing entry whose literal label is asserted with
  // `mustContain`). Two assertions make the defect objective:
  //   * `mustContain: ['BRPROBE']` — the label text was not silently dropped;
  //   * `mustNotContain: ['<br']`  — the `<br/>` was consumed into a real line
  //     break instead of being painted as literal text.
  // A row that keeps the text but shows `<br` is a `literal-markup` defect.
  // flowchart and sequence are positive controls: they already convert `<br/>`
  // correctly, so they must stay `renders` and never trip `literal-markup`.
  // =========================================================================
  {
    id: 'br-flowchart',
    family: 'flowchart',
    category: 'labels',
    variant: '<br/> line break inside a node label (positive control)',
    source: lines('flowchart TD', '  A[Task<br/>BRPROBE] --> B'),
    mustContain: ['Task', 'BRPROBE'],
    mustNotContain: ['<br'],
    note: 'control: flowchart already converts <br/> to a real line break',
  },
  {
    id: 'br-swimlanes',
    family: 'swimlanes',
    category: 'labels',
    variant: '<br/> line break inside a lane node label',
    source: lines('swimlane-beta LR', '  subgraph You', '    a[Report<br/>BRPROBE]', '  end', '  subgraph Them', '    b[Fix]', '  end', '  a --> b'),
    mustContain: ['Report', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-sequence',
    family: 'sequence',
    category: 'labels',
    variant: '<br/> line break inside a message (positive control)',
    source: lines('sequenceDiagram', '  A->>B: hello<br/>BRPROBE'),
    mustContain: ['hello', 'BRPROBE'],
    mustNotContain: ['<br'],
    note: 'control: sequence already converts <br/> to a real line break',
  },
  {
    id: 'br-class',
    family: 'class',
    category: 'labels',
    variant: '<br/> line break inside a relation label',
    source: lines('classDiagram', '  class A', '  A --> B : "rel<br/>BRPROBE"'),
    mustContain: ['rel', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-state',
    family: 'state',
    category: 'labels',
    variant: '<br/> line break inside a state alias description',
    source: lines('stateDiagram-v2', '  state "desc<br/>BRPROBE" as s1', '  s1 --> s2'),
    mustContain: ['desc', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-er',
    family: 'er',
    category: 'labels',
    variant: '<br/> line break inside a relationship label',
    source: lines('erDiagram', '  A ||--o{ B : has<br/>BRPROBE'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-user-journey',
    family: 'user-journey',
    category: 'labels',
    variant: '<br/> line break inside a task label',
    source: lines('journey', '  section S', '    Task<br/>BRPROBE: 5: Actor'),
    mustContain: ['Task', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-gantt',
    family: 'gantt',
    category: 'labels',
    variant: '<br/> line break inside a task name',
    source: lines('gantt', '  section S', '    Task<br/>BRPROBE :done, 2024-01-01, 30d'),
    mustContain: ['Task', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-pie',
    family: 'pie',
    category: 'labels',
    variant: '<br/> line break inside a slice label',
    source: lines('pie', '  "a<br/>BRPROBE" : 1', '  "b" : 2'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-quadrant',
    family: 'quadrant',
    category: 'labels',
    variant: '<br/> line break inside a point label',
    source: lines('quadrantChart', '  A<br/>BRPROBE: [0.3, 0.6]'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-requirement',
    family: 'requirement',
    category: 'labels',
    variant: '<br/> line break inside a requirement text',
    source: lines('requirementDiagram', '  requirement R {', '    id: 1', '    text: hi<br/>BRPROBE', '  }'),
    mustContain: ['hi', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-gitgraph',
    family: 'gitgraph',
    category: 'labels',
    variant: '<br/> line break inside a commit id',
    source: lines('gitGraph', '  commit id: "v1<br/>BRPROBE"'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-c4',
    family: 'c4',
    category: 'labels',
    variant: '<br/> line break inside a C4 element label',
    source: lines('C4Context', '  Person(u, "User<br/>BRPROBE")', '  System(s, "Sys")', '  Rel(u, s, "uses")'),
    mustContain: ['User', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-mindmap',
    family: 'mindmap',
    category: 'labels',
    variant: '<br/> line break inside a node label',
    source: lines('mindmap', '  root((M))', '    A[Square<br/>BRPROBE]'),
    mustContain: ['Square', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-timeline',
    family: 'timeline',
    category: 'labels',
    variant: '<br/> line break inside an event',
    source: lines('timeline', '  2020 : Event<br/>BRPROBE'),
    mustContain: ['Event', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-zenuml',
    family: 'zenuml',
    category: 'labels',
    variant: '<br/> line break inside a message',
    source: lines('zenuml', '  A->B: hello<br/>BRPROBE'),
    mustContain: ['hello', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-sankey',
    family: 'sankey',
    category: 'labels',
    variant: '<br/> line break inside a node name',
    source: lines('sankey', 'A<br/>BRPROBE,B,10'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-xychart',
    family: 'xychart',
    category: 'labels',
    variant: '<br/> line break inside the title',
    source: lines('xychart-beta', '  title "T<br/>BRPROBE"', '  x-axis [a, b]', '  y-axis 0 --> 10', '  bar [1, 2]'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-block',
    family: 'block',
    category: 'labels',
    variant: '<br/> line break inside a block label',
    source: lines('block-beta', '  columns 2', '  A["Label<br/>BRPROBE"] B'),
    mustContain: ['Label', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-packet',
    family: 'packet',
    category: 'labels',
    variant: '<br/> line break inside a field label',
    source: lines('packet', '+8: "A<br/>BRPROBE"'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-kanban',
    family: 'kanban',
    category: 'labels',
    variant: '<br/> line break inside a task label',
    source: lines('kanban', '  done[A]', '    t1[Task<br/>BRPROBE]'),
    mustContain: ['Task', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-architecture',
    family: 'architecture',
    category: 'labels',
    variant: '<br/> line break inside a service label',
    source: lines('architecture-beta', '  service a(server)[A<br/>BRPROBE]', '  service b(database)[B]', '  a:R --> L:b'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-radar',
    family: 'radar',
    category: 'labels',
    variant: '<br/> line break inside an axis label',
    source: lines('radar-beta', '  axis a["A<br/>BRPROBE"], b["B"], c["C"]', '  curve x{1, 2, 3}', '  min 0', '  max 5'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-event-modeling',
    family: 'event-modeling',
    category: 'labels',
    variant: '<br/> line break inside a frame entity',
    source: lines('eventmodeling', '  tf 01 ui A<br/>BRPROBE'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-treemap',
    family: 'treemap',
    category: 'labels',
    variant: '<br/> line break inside a leaf label',
    source: lines('treemap-beta', '"Root"', '    "Child<br/>BRPROBE": 10'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-venn',
    family: 'venn',
    category: 'labels',
    variant: '<br/> line break inside a set name',
    source: lines('venn-beta', '  set A<br/>BRPROBE', '  set B'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-ishikawa',
    family: 'ishikawa',
    category: 'labels',
    variant: '<br/> line break inside the effect label',
    source: lines('ishikawa-beta', '  Effect<br/>BRPROBE', '  Category', '    Cause'),
    mustContain: ['Effect', 'BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-wardley',
    family: 'wardley',
    category: 'labels',
    variant: '<br/> line break inside the map title',
    source: lines('wardley-beta', 'title Map<br/>BRPROBE', 'anchor A [0.9, 0.8]'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-cynefin',
    family: 'cynefin',
    category: 'labels',
    variant: '<br/> line break inside a quoted item',
    source: lines('cynefin-beta', 'clear', '"a<br/>BRPROBE"'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
  {
    id: 'br-treeview',
    family: 'treeview',
    category: 'labels',
    variant: '<br/> line break inside a node label',
    source: lines('tree', '  Root', '    Child<br/>BRPROBE'),
    mustContain: ['BRPROBE'],
    mustNotContain: ['<br'],
  },
];

export default CORPUS;
