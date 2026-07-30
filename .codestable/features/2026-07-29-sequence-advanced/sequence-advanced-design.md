---
doc_type: feature-design
feature: 2026-07-29-sequence-advanced
requirement: production-support-contract
status: approved
summary: Render the common Mermaid sequence activation, note, and control-block syntax through a native WASM-to-SVG path.
tags: [production, sequence, parser, wasm, renderer]
---

# sequence-advanced design

## Goal

Remove the `sequence.advanced` failure for the common activation, note, control-block, bare `autonumber`, RGB `rect`, and `--x` cross-termination syntax while preserving every supported statement as typed data from source through the packed browser SDK.

## Current Path And Root Cause

`XMermaid.renderToSVGElement()` first calls the TypeScript support analyzer. `detectUnsupportedSequenceFeatures()` currently reports every activation, note, and control statement as an error, so rendering stops before WASM. If it did proceed, the Rust parser only recognizes declarations and direct messages, and `engine.rs` projects that data into a generic left-to-right flowchart. That projection has no ordered timeline, lifeline, activation span, note, or nested block representation.

## Scope

Supported in this slice:

- `activate` / `deactivate`, plus message-target activation `+` and message-sender deactivation `-` suffixes.
- `Note left of`, `Note right of`, and `Note over` with one or two participants.
- `loop`, `alt` / `else`, `opt`, `par` / `and`, `critical` / `option`, `break`, and matching `end`.
- Nested blocks and ordered rendering of declarations, messages, activation bars, notes, and frames.
- Bare `autonumber`, validated `rect rgb(red, green, blue)` frames, and dashed `--x` cross-ended messages.

Explicitly outside this slice: `create`, `destroy`, `box`, multi-line notes, link/callback syntax, advanced autonumber or rect forms, and unrecognized sequence statements. They remain fail-closed with a structured `sequence.advanced` diagnostic.

## Quality Targets

- **Functional suitability / correctness:** a valid sequence source keeps event order and renders its lifelines, activation bars, notes, and blocks. Evidence: parser, layout, renderer, real WASM, and browser tests.
- **Compatibility / interoperability:** existing declaration-and-message consumers continue receiving `participants` and `messages`; new AST/layout fields are additive and deserialize with defaults. Evidence: existing sequence tests plus packed-package validation.
- **Maintainability / testability:** sequence-specific geometry lives in one Rust layout module and one TypeScript renderer method rather than leaking synthetic nodes into flowchart code. Evidence: focused unit tests at each boundary.

## Implementation Design

The parser keeps the public `participants` and `messages` collections, adds an ordered `events` stream, and gives each message an optional line style, end marker, target-activation flag, and sender-deactivation flag. An event references its message by index, while autonumber activation, notes, lifecycle actions, and block delimiters carry their own typed fields. RGB rect input is parsed into a canonical safe color string before it can reach SVG. This avoids duplicating message content while retaining the source order needed by a timeline layout. Parser validation owns malformed RGB colors, note targets, invalid block dividers, unmatched lifecycle deactivation, unmatched `end`, and unclosed blocks.

`crates/xmermaid-layout/src/sequence.rs` owns the dedicated timeline geometry. It positions participant headers across the top, assigns monotonic rows to events, numbers messages after an autonumber event, opens and closes nested activation bars per participant, places notes relative to their named lifelines, and turns the block stack into nested frames plus branch dividers or RGB rect regions. The generic `LayoutResult` gains one optional `sequence` field. Sequence diagrams no longer emit generic flowchart nodes or edges.

`SVGRenderer` recognizes that optional layout and renders the timeline as SVG groups: headers and dashed lifelines, numbered message arrows or crosses, activation rectangles, note rectangles, RGB rect regions, and labeled block frames. The support analyzer permits only this implemented syntax and continues to reject `create` / `destroy` and other explicitly unsupported sequence statements. Public TypeScript AST and layout types expose additive optional data.

## Verification

The implementation is test-first in four layers: Rust parser assertions for serialized event order and malformed nesting; Rust layout assertions for lifeline, activation, note, and block geometry; jsdom renderer assertions for sequence SVG groups; and real WASM/browser tests through the packaged `xmermaid-live` consumer. Existing declaration/message behavior remains part of the regression suite.
