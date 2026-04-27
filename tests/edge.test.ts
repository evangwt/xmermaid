import { describe, it, expect } from 'vitest';
import {
  truncateAtBounds,
  computeBezierPath,
  computeStepPath,
  computeStraightPath,
  computeArrowPoints,
} from '../src/renderer/edge';
import type { Point, Bounds } from '../src/types';

describe('truncateAtBounds', () => {
  const bounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
  const gap = 5;

  it('truncates from above (hits top edge)', () => {
    const from: Point = { x: 50, y: -50 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.y).toBeCloseTo(gap, 1);
    expect(result.x).toBeCloseTo(50, 1);
  });

  it('truncates from below (hits bottom edge)', () => {
    const from: Point = { x: 50, y: 100 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.y).toBeCloseTo(bounds.height - gap, 1);
  });

  it('truncates from left (hits left edge)', () => {
    const from: Point = { x: -50, y: 25 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.x).toBeCloseTo(gap, 1);
  });

  it('truncates from right (hits right edge)', () => {
    const from: Point = { x: 150, y: 25 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.x).toBeCloseTo(bounds.width - gap, 1);
  });

  it('truncates diagonally', () => {
    const from: Point = { x: 0, y: 0 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    // Should be on one of the edges
    const onLeft = Math.abs(result.x - gap) < 1;
    const onTop = Math.abs(result.y - gap) < 1;
    expect(onLeft || onTop).toBe(true);
  });
});

describe('computeBezierPath', () => {
  const fromBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
  const toBounds: Bounds = { x: 0, y: 200, width: 100, height: 50 };
  const gap = 5;

  it('produces a path starting with M', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
    );
    expect(result.path.startsWith('M')).toBe(true);
  });

  it('arrow tip is near the target node', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
    );
    expect(result.arrowTip.y).toBeGreaterThan(200);
  });

  it('arrow angle points downward', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
    );
    expect(result.arrowAngle).toBeCloseTo(Math.PI / 2, 1);
  });
});

describe('computeStepPath', () => {
  it('produces a path starting with M', () => {
    const fromBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
    const toBounds: Bounds = { x: 0, y: 200, width: 100, height: 50 };
    const result = computeStepPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      5,
    );
    expect(result.path.startsWith('M')).toBe(true);
  });
});

describe('computeStraightPath', () => {
  it('produces a path starting with M', () => {
    const fromBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
    const toBounds: Bounds = { x: 0, y: 200, width: 100, height: 50 };
    const result = computeStraightPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      5,
    );
    expect(result.path.startsWith('M')).toBe(true);
    expect(result.path).toContain('L');
  });
});

describe('computeArrowPoints', () => {
  it('returns a string of coordinates for filled arrow', () => {
    const result = computeArrowPoints(
      { x: 100, y: 100 },
      Math.PI / 2,
      10,
      'filled',
    );
    expect(typeof result).toBe('string');
    expect(result.split(' ').length).toBe(3); // 3 points
  });
});
