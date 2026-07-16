---
doc_type: feature-design
feature: 2026-07-17-live-editor-ux-polish
requirement: null
roadmap: null
roadmap_item: null
status: approved
summary: Improve the static live editor workbench structure and responsive UX without changing parser, renderer, or visual edit semantics.
tags: [editor, ux, responsive, accessibility]
---

# live-editor-ux-polish design

## 0. Terms

- **Workbench panel**: a named live editor region with a heading and body. Current regions are Document, Diagrams, Selected source, and Preview.
- **Visual tool group**: a task group inside the visual edit panel. Current groups are Node and Edge.
- **Responsive workbench**: the CSS layout contract for desktop, tablet, and mobile viewports in `examples/live-editor.html`.

## 1. Target Contract

The static live editor should read like a dense tool surface, not a demo page. A user must be able to scan the four primary regions, use visual edit controls without guessing which fields belong together, and open the example page on mobile without horizontal overflow.

This feature does not change Mermaid support, AST-backed visual editing, render behavior, sharing, export, security policy, or package exports.

### Quality Goals

- **Interaction capability**: the primary editor regions are named and visually grouped; keyboard focus has a visible outline; visual edit controls expose task group labels and input placeholders.
- **Flexibility**: the example page keeps the same feature set across desktop, tablet, and mobile, with a one-column mobile layout and no horizontal overflow.
- **Maintainability**: tests pin stable `data-xm-*` selectors and high-level layout contracts without asserting brittle pixel values.

## 2. UI Wireframe

Target desktop structure:

```text
┌─ toolbar: theme / direction / actions ────────────────────────────────┐
├─ Document ─────┬─ Diagrams ───┬─ Selected source ─┬─ Preview ─────────┤
│ full document  │ diagram list │ selected Mermaid  │ SVG + diagnostics │
│ textarea       │ buttons      │ textarea          │ repair/export     │
└────────────────┴──────────────┴──────────────────┴───────────────────┘
┌─ Visual edits ─┬─ Node tools: id / label / rename / add / remove ─────┐
│                └─ Edge tools: from / to / label / id / add / remove ──┘
└───────────────────────────────────────────────────────────────────────┘
```

Target mobile structure:

```text
┌─ toolbar wraps into usable controls ─┐
├─ Document ───────────────────────────┤
├─ Diagrams ───────────────────────────┤
├─ Selected source ────────────────────┤
├─ Preview ────────────────────────────┤
├─ Visual edits ───────────────────────┤
├─ Node tools ─────────────────────────┤
└─ Edge tools ─────────────────────────┘
```

Stable constraints:

- Panel names are real headings, not only CSS decoration.
- The four workbench regions keep their existing content and `data-xm-*` selectors.
- Visual editing remains form-based and AST-backed; this feature only groups the existing controls.
- The mobile layout may change row heights, but it must not require horizontal scrolling.

## 3. Implementation Plan

1. Add a `createPanel(kind, title, content)` helper in `src/editor/index.ts` and wrap the existing document input, diagram list, selected source input, and preview panel.
2. Add a `createVisualToolGroup(title, attribute, ...children)` helper and split existing visual edit controls into Node and Edge groups.
3. Add placeholders to visual edit inputs using their existing accessible labels.
4. Update `examples/live-editor.html` CSS for panel headings, denser controls, focus-visible outlines, visual tool grouping, and responsive breakpoints at 1100px and 760px.
5. Add focused Vitest coverage for panel structure, visual grouping, placeholders, and static responsive/focus CSS hooks.
6. Verify with typecheck, targeted tests, build, and real Chrome/CDP layout smoke on desktop and mobile.

## 4. Scope Guard

Out of scope:

- New parser, layout, renderer, or Mermaid syntax support.
- Drag-and-drop visual canvas.
- New frontend framework, icon library, or dependency.
- Changes to export/share semantics.
- Pixel-perfect visual baselines.

## 5. Architecture Merge

Acceptance should update `.codestable/architecture/ARCHITECTURE.md` application-layer live editor text so the current workbench structure is recorded as an implemented UI fact.
