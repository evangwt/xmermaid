import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CodeStable current evidence docs', () => {
  it('describes the current live editor browser gate as packed Chrome/CDP smoke', () => {
    const harshReview = readFileSync(
      '.codestable/roadmap/multi-diagram-live-editor/harsh-review-2026-06-07.md',
      'utf8',
    );

    expect(harshReview).not.toMatch(/Playwright browser smoke/i);
    expect(harshReview).toMatch(/packed Chrome\/CDP consumer smoke/i);
  });
});
