import { describe, expect, it } from 'vitest';
import { analyzeSupport } from '../src/support';
import { mapDiagnosticsToOriginal, normalizeSource } from '../src/normalize';
import type { SourceRange } from '../src/types/diagnostics';

const BOM = '\uFEFF';

describe('normalizeSource', () => {
  it('strips a leading UTF-8 BOM', () => {
    const { text, offsetMap } = normalizeSource(`${BOM}flowchart TD\n  A --> B`);
    expect(text).toBe('flowchart TD\n  A --> B');
    expect(offsetMap.removedPrefixLength).toBe(1);
    expect(offsetMap.toOriginalOffset(0)).toBe(1);
    expect(offsetMap.toOriginalOffset(5)).toBe(6);
  });

  it('leaves a BOM-free source untouched', () => {
    const source = 'flowchart TD\n  A --> B';
    const { text, offsetMap } = normalizeSource(source);
    expect(text).toBe(source);
    expect(offsetMap.removedPrefixLength).toBe(0);
    expect(offsetMap.toOriginalOffset(3)).toBe(3);
  });

  it('folds smart/full-width dash arrows into ASCII', () => {
    expect(normalizeSource('flowchart TD\n  A \u2013> B').text).toBe('flowchart TD\n  A -> B');
    expect(normalizeSource('flowchart TD\n  A \u2014> B').text).toBe('flowchart TD\n  A -> B');
    expect(normalizeSource('flowchart TD\n  A \u2212> B').text).toBe('flowchart TD\n  A -> B');
    expect(normalizeSource('sequenceDiagram\n  A\uff0d>>B: x').text).toBe('sequenceDiagram\n  A->>B: x');
  });

  it('folds a whole dash run that ends in an arrow head', () => {
    expect(normalizeSource('flowchart TD\n  A \uff0d\uff0d> B').text).toBe('flowchart TD\n  A --> B');
    expect(normalizeSource('flowchart TD\n  A --> B').text).toBe('flowchart TD\n  A --> B');
  });

  it('never touches ordinary dashes inside labels', () => {
    const label = 'flowchart TD\n  A["en \u2013 dash"] --> B';
    expect(normalizeSource(label).text).toBe(label);
    const edgeLabel = 'flowchart TD\n  A -->|a \u2013 b| B';
    expect(normalizeSource(edgeLabel).text).toBe(edgeLabel);
  });

  it('leaves non-arrow punctuation and escapes alone', () => {
    for (const source of [
      'flowchart TD\n  A -.-> B',
      'flowchart TD\n  A -->|a \\| b| B',
      'flowchart TD\n  A[Deploy: prod] --> B',
      'flowchart TD\n  A[\u4e2d\u6587\uff1a\u6807\u7b7e] --> B',
    ]) {
      expect(normalizeSource(source).text).toBe(source);
    }
  });

  it('is idempotent', () => {
    for (const source of [
      `${BOM}flowchart TD\n  A \u2013> B`,
      'sequenceDiagram\n  A\uff0d>>B: x',
      'flowchart TD\n  A -->|a \\| b| B',
    ]) {
      const once = normalizeSource(source).text;
      const twice = normalizeSource(once).text;
      expect(twice).toBe(once);
    }
  });

  it('handles the empty string, a lone BOM, and a lone dash run', () => {
    expect(normalizeSource('').text).toBe('');
    expect(normalizeSource('').offsetMap.removedPrefixLength).toBe(0);

    const bomOnly = normalizeSource(BOM);
    expect(bomOnly.text).toBe('');
    expect(bomOnly.offsetMap.removedPrefixLength).toBe(1);

    // A dash run with no arrow head is ordinary text and stays untouched.
    expect(normalizeSource('----').text).toBe('----');
    expect(normalizeSource('\u2013\u2013\u2013').text).toBe('\u2013\u2013\u2013');
    // A lone dash arrow is folded.
    expect(normalizeSource('\u2013>').text).toBe('->');
  });

  it('folds only the arrow-head dash run in a mixed / nested source', () => {
    // The label dash (not followed by `>`) is preserved; the arrow dash is folded.
    expect(normalizeSource('flowchart TD\n  A \u2013>|a \u2013 b| B').text)
      .toBe('flowchart TD\n  A ->|a \u2013 b| B');
    // Two arrows on one line: each dash run that ends in `>` is folded.
    expect(normalizeSource('flowchart TD\n  A \u2013> B \u2014> C').text)
      .toBe('flowchart TD\n  A -> B -> C');
  });

  it('stays idempotent on a large mixed input', () => {
    const chunk = '  A \u2013> B["x \u2013 y"] -->|a \\| b| C\n';
    const source = `flowchart TD\n${chunk.repeat(4000)}`;
    const once = normalizeSource(source).text;
    const twice = normalizeSource(once).text;
    expect(twice).toBe(once);
    expect(once).not.toContain('\u2013>');
    expect(once).toContain('x \u2013 y');
  });
});

describe('fence unwrapping', () => {
  it('unwraps a ```mermaid fence that surrounds the whole source', () => {
    const source = '```mermaid\nflowchart TD\n  A --> B\n```';
    const { text, offsetMap } = normalizeSource(source);
    expect(text).toBe('flowchart TD\n  A --> B\n');
    // The removed prefix is the opener line (10 chars + its newline).
    expect(offsetMap.removedPrefixLength).toBe(11);
    expect(source.slice(offsetMap.toOriginalOffset(0), offsetMap.toOriginalOffset(12)))
      .toBe('flowchart TD');
  });

  it('accepts the documented fence aliases, tilde fences, and a bare fence', () => {
    const body = 'flowchart TD\n  A --> B\n';
    for (const opener of ['```mermaid', '~~~mermaid', '```xmermaid', '```mmd', '```']) {
      const marker = opener.slice(0, 3);
      expect(normalizeSource(`${opener}\n${body}${marker}`).text).toBe(body);
    }
  });

  it('leaves a fence naming another language exactly as written', () => {
    for (const source of [
      '```js\nflowchart TD\n  A --> B\n```',
      '```javascript\nflowchart TD\n  A --> B\n```',
      '```python\nflowchart TD\n  A --> B\n```',
      '```markdown\nflowchart TD\n  A --> B\n```',
    ]) {
      expect(normalizeSource(source).text).toBe(source);
    }
  });

  it('tolerates a truncated (unclosed) fence by dropping only the opener', () => {
    expect(normalizeSource('```mermaid\nflowchart TD\n  A --> B').text)
      .toBe('flowchart TD\n  A --> B');
  });

  it('tolerates blank lines around the fence', () => {
    const source = '\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\n';
    const { text, offsetMap } = normalizeSource(source);
    expect(text).toBe('flowchart TD\n  A --> B\n');
    // Two leading blank lines + the 10-char opener line + its newline.
    expect(offsetMap.removedPrefixLength).toBe(13);
  });

  it('does not treat a fence that is not at the start of the source as a wrapper', () => {
    for (const source of [
      'flowchart TD\n  A["```mermaid"] --> B',
      'flowchart TD\n  A --> B\n```',
      '%% a ```mermaid comment\nflowchart TD\n  A --> B',
    ]) {
      expect(normalizeSource(source).text).toBe(source);
    }
  });

  it('ends the block at the first matching closer and drops what follows', () => {
    // Markdown semantics: a closing fence ends the block, so trailing prose is
    // outside the diagram. Parsing it as diagram content produced junk nodes.
    const withProse = '```mermaid\nflowchart TD\n  A --> B\n```\nHere is how the flow works.';
    expect(normalizeSource(withProse).text).toBe('flowchart TD\n  A --> B\n');

    const twoBlocks = '```mermaid\nflowchart TD\n  A --> B\n```\n```mermaid\nflowchart TD\n  C --> D\n```';
    expect(normalizeSource(twoBlocks).text).toBe('flowchart TD\n  A --> B\n');

    const withPayload = '```mermaid\nflowchart TD\n  A --> B\n```\n<script>alert(1)</script>';
    expect(normalizeSource(withPayload).text).toBe('flowchart TD\n  A --> B\n');
  });

  it('requires the closing marker to match the opener', () => {
    // `~~~` does not close a ``` fence, so the stray line stays in the body and
    // the parser reports it against the original text.
    expect(normalizeSource('```mermaid\nflowchart TD\n  A --> B\n~~~').text)
      .toBe('flowchart TD\n  A --> B\n~~~');
  });

  it('leaves a fence with no content alone instead of returning an empty source', () => {
    for (const source of ['```mermaid\n```', '```mermaid']) {
      expect(normalizeSource(source).text).toBe(source);
    }
  });

  it('unwraps nested fences down to the diagram', () => {
    const source = '```mermaid\n```mermaid\nflowchart TD\n  A --> B\n```\n```';
    expect(normalizeSource(source).text).toBe('flowchart TD\n  A --> B\n');
  });

  it('combines fence unwrapping with BOM stripping and dash-arrow folding', () => {
    const source = `${BOM}\`\`\`mermaid\nflowchart TD\n  A \u2013> B\n\`\`\``;
    const { text, offsetMap } = normalizeSource(source);
    expect(text).toBe('flowchart TD\n  A -> B\n');
    // 1 BOM + 10 opener chars + 1 newline.
    expect(offsetMap.removedPrefixLength).toBe(12);
    expect(source.slice(offsetMap.toOriginalOffset(0), offsetMap.toOriginalOffset(12)))
      .toBe('flowchart TD');
  });

  it('is idempotent on every fence shape', () => {
    for (const source of [
      '```mermaid\nflowchart TD\n  A --> B\n```',
      '~~~mermaid\nflowchart TD\n  A \u2013> B\n~~~',
      '```mermaid\nflowchart TD\n  A --> B',
      '```mermaid\n```mermaid\nflowchart TD\n  A --> B\n```\n```',
      '```js\nflowchart TD\n  A --> B\n```',
      `${BOM}\`\`\`mermaid\nflowchart TD\n  A --> B\n\`\`\``,
      '```mermaid\nflowchart TD\n  A --> B\n```\nHere is how the flow works.',
    ]) {
      const once = normalizeSource(source).text;
      expect(normalizeSource(once).text).toBe(once);
    }
  });

  it('reports diagnostics against the original fenced source', () => {
    const original = '```mermaid\ngraph XXX\n  A-->B\n```';
    const { text, offsetMap } = normalizeSource(original);
    expect(text).toBe('graph XXX\n  A-->B\n');

    const invalidDirection = analyzeSupport(text).unsupportedFeatures
      .find(feature => feature.id === 'flowchart.invalidDirection');
    expect(invalidDirection).toBeDefined();

    const [mapped] = mapDiagnosticsToOriginal([invalidDirection!], offsetMap);
    expect(mapped!.range).toMatchObject({ startLine: 1, startColumn: 12, startOffset: 11 });
    // The mapped range must select the same characters in the original text.
    expect(original.slice(mapped!.range!.startOffset, mapped!.range!.endOffset))
      .toBe(text.slice(invalidDirection!.range!.startOffset, invalidDirection!.range!.endOffset));
  });
});

describe('mapDiagnosticsToOriginal', () => {
  it('shifts ranges back by the removed prefix', () => {
    const { offsetMap } = normalizeSource(`${BOM}flowchart TD`);
    const range: SourceRange = {
      startOffset: 0,
      endOffset: 11,
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 12,
    };
    const [mapped] = mapDiagnosticsToOriginal([{ range }], offsetMap);
    expect(mapped!.range).toEqual({
      startOffset: 1,
      endOffset: 12,
      startLine: 1,
      startColumn: 2,
      endLine: 1,
      endColumn: 13,
    });
  });

  it('is an identity when nothing was removed', () => {
    const { offsetMap } = normalizeSource('flowchart TD');
    const diagnostics = [{ range: null }, { range: { startOffset: 2, endOffset: 4, startLine: 1, startColumn: 3, endLine: 1, endColumn: 5 } }];
    expect(mapDiagnosticsToOriginal(diagnostics, offsetMap)).toBe(diagnostics);
  });

  it('points a BOM-shifted diagnostic range back at the original line/column', () => {
    // `graph XXX` is an invalid-direction diagnostic on the first line. With a
    // leading BOM the original `graph` starts at column 2 (the BOM is column 1),
    // so the mapped range must shift by exactly one character on line 1.
    const original = `${BOM}graph XXX\n  A-->B`;
    const { text, offsetMap } = normalizeSource(original);
    expect(text).toBe('graph XXX\n  A-->B');

    const features = analyzeSupport(text).unsupportedFeatures;
    const invalidDirection = features.find(feature => feature.id === 'flowchart.invalidDirection');
    expect(invalidDirection).toBeDefined();

    const [mapped] = mapDiagnosticsToOriginal([invalidDirection!], offsetMap);
    expect(mapped!.range).toMatchObject({
      startLine: 1,
      startColumn: 2,
      startOffset: 1,
    });

    // The mapped column must select the same characters in the original text.
    expect(original.slice(mapped!.range!.startOffset, mapped!.range!.endOffset))
      .toBe(text.slice(invalidDirection!.range!.startOffset, invalidDirection!.range!.endOffset));
  });
});
