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

  it('truncates from above (hits top edge, pushed outward by gap)', () => {
    const from: Point = { x: 50, y: -50 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.y).toBeCloseTo(-gap, 1);
    expect(result.x).toBeCloseTo(50, 1);
  });

  it('truncates from below (hits bottom edge, pushed outward by gap)', () => {
    const from: Point = { x: 50, y: 100 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.y).toBeCloseTo(bounds.height + gap, 1);
  });

  it('truncates from left (hits left edge, pushed outward by gap)', () => {
    const from: Point = { x: -50, y: 25 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.x).toBeCloseTo(-gap, 1);
  });

  it('truncates from right (hits right edge, pushed outward by gap)', () => {
    const from: Point = { x: 150, y: 25 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    expect(result.x).toBeCloseTo(bounds.width + gap, 1);
  });

  it('truncates diagonally (hits corner area, pushed outward by gap)', () => {
    const from: Point = { x: 0, y: 0 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, bounds, gap);
    const onLeft = Math.abs(result.x - (-gap)) < 1;
    const onTop = Math.abs(result.y - (-gap)) < 1;
    expect(onLeft || onTop).toBe(true);
  });

  it('truncates at Diamond shape boundary', () => {
    const diamondBounds: Bounds = { x: 0, y: 0, width: 100, height: 80 };
    const from: Point = { x: 50, y: -50 };
    const to: Point = { x: 50, y: 40 };
    const result = truncateAtBounds(from, to, diamondBounds, gap, 'Diamond');
    // Should hit top vertex area and be pushed outward
    expect(result.y).toBeLessThan(0);
  });

  it('truncates at Circle shape boundary', () => {
    const circleBounds: Bounds = { x: 0, y: 0, width: 80, height: 80 };
    const from: Point = { x: 40, y: -50 };
    const to: Point = { x: 40, y: 40 };
    const result = truncateAtBounds(from, to, circleBounds, gap, 'Circle');
    // Should hit top of circle (y=0) and be pushed outward by gap
    expect(result.y).toBeCloseTo(-gap, 1);
    expect(result.x).toBeCloseTo(40, 1);
  });

  it('truncates at Hexagon shape boundary', () => {
    const hexBounds: Bounds = { x: 0, y: 0, width: 100, height: 60 };
    const from: Point = { x: 50, y: -50 };
    const to: Point = { x: 50, y: 30 };
    const result = truncateAtBounds(from, to, hexBounds, gap, 'Hexagon');
    // Should hit top edge and be pushed outward
    expect(result.y).toBeLessThan(0);
  });

  it('truncates at Parallelogram shape boundary', () => {
    const paraBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
    const from: Point = { x: 50, y: -50 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, paraBounds, gap, 'Parallelogram');
    // Should hit top edge and be pushed outward
    expect(result.y).toBeLessThan(0);
  });

  it('truncates at Trapezoid shape boundary', () => {
    const trapBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
    const from: Point = { x: 50, y: -50 };
    const to: Point = { x: 50, y: 25 };
    const result = truncateAtBounds(from, to, trapBounds, gap, 'Trapezoid');
    // Should hit top edge and be pushed outward
    expect(result.y).toBeLessThan(0);
  });

  it('truncates at Stadium shape boundary from above', () => {
    const stadiumBounds: Bounds = { x: 0, y: 0, width: 120, height: 40 };
    const from: Point = { x: 60, y: -50 };
    const to: Point = { x: 60, y: 20 };
    const result = truncateAtBounds(from, to, stadiumBounds, gap, 'Stadium');
    // Should hit top edge and be pushed outward
    expect(result.y).toBeCloseTo(-gap, 1);
  });

  it('truncates at Stadium shape boundary from left', () => {
    const stadiumBounds: Bounds = { x: 0, y: 0, width: 120, height: 40 };
    const from: Point = { x: -50, y: 20 };
    const to: Point = { x: 60, y: 20 };
    const result = truncateAtBounds(from, to, stadiumBounds, gap, 'Stadium');
    // Ray from center toward left: hits left semicircle at x=0, pushed outward by gap
    expect(result.x).toBeCloseTo(-gap, 1);
  });
});

describe('computeBezierPath', () => {
  const fromBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
  const toBounds: Bounds = { x: 0, y: 200, width: 100, height: 50 };
  const gap = 5;
  const arrowSize = 10;

  it('produces a path starting with M', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.path.startsWith('M')).toBe(true);
  });

  it('arrow tip is pushed outward from target node boundary', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    // Arrow tip should be at toBounds top edge (y=200) pushed outward by gap → y=195
    expect(result.arrowTip.y).toBeCloseTo(200 - gap, 1);
  });

  it('arrow angle points downward for vertical edge', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.arrowAngle).toBeCloseTo(Math.PI / 2, 1);
  });

  it('path ends at arrow base (arrowTip - arrowSize along tangent)', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.pathEnd).toBeDefined();
    // For vertical downward edge, pathEnd should be arrowSize above arrowTip
    expect(result.pathEnd!.y).toBeCloseTo(result.arrowTip.y - arrowSize, 1);
  });

  it('arrow angle matches bezier tangent at endpoint', () => {
    // Horizontal edge: arrow should point right
    const leftBounds: Bounds = { x: 0, y: 0, width: 80, height: 40 };
    const rightBounds: Bounds = { x: 200, y: 0, width: 80, height: 40 };
    const result = computeBezierPath(
      [{ x: 40, y: 20 }, { x: 240, y: 20 }],
      leftBounds,
      rightBounds,
      gap,
      arrowSize,
    );
    expect(result.arrowAngle).toBeCloseTo(0, 1);
  });

  it('multi-waypoint path uses Catmull-Rom (no cusps)', () => {
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 125 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    // Path should contain C commands (cubic bezier), not L (straight lines)
    expect(result.path).toContain('C');
    expect(result.path).not.toContain('L');
  });

  it('uses approach direction for truncation (not center-to-center)', () => {
    // Diagonal edge: from top-left to bottom-right
    const result = computeBezierPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    // Arrow tip should be at top edge of toBounds (approach from above)
    // not at some other edge
    expect(result.arrowTip.y).toBeCloseTo(195, 1);
    expect(result.arrowTip.x).toBeCloseTo(50, 1);
  });
});

describe('computeStepPath', () => {
  const fromBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
  const toBounds: Bounds = { x: 0, y: 200, width: 100, height: 50 };
  const gap = 5;
  const arrowSize = 10;

  it('produces a path starting with M', () => {
    const result = computeStepPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.path.startsWith('M')).toBe(true);
  });

  it('uses H-V-H stepping pattern', () => {
    const result = computeStepPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.path).toContain('H');
    expect(result.path).toContain('V');
  });

  it('arrow angle from last segment direction', () => {
    const result = computeStepPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    // Last segment is vertical downward
    expect(result.arrowAngle).toBeCloseTo(Math.PI / 2, 1);
  });

  it('path shortened by arrowSize', () => {
    const result = computeStepPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.pathEnd).toBeDefined();
    expect(result.pathEnd!.y).toBeCloseTo(result.arrowTip.y - arrowSize, 1);
  });
});

describe('computeStraightPath', () => {
  const fromBounds: Bounds = { x: 0, y: 0, width: 100, height: 50 };
  const toBounds: Bounds = { x: 0, y: 200, width: 100, height: 50 };
  const gap = 5;
  const arrowSize = 10;

  it('produces a path starting with M', () => {
    const result = computeStraightPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.path.startsWith('M')).toBe(true);
    expect(result.path).toContain('L');
  });

  it('arrow angle from last segment direction', () => {
    const result = computeStraightPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.arrowAngle).toBeCloseTo(Math.PI / 2, 1);
  });

  it('path shortened by arrowSize', () => {
    const result = computeStraightPath(
      [{ x: 50, y: 25 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    expect(result.pathEnd).toBeDefined();
    expect(result.pathEnd!.y).toBeCloseTo(result.arrowTip.y - arrowSize, 1);
  });

  it('multi-waypoint straight path includes intermediate points', () => {
    const result = computeStraightPath(
      [{ x: 50, y: 25 }, { x: 100, y: 125 }, { x: 50, y: 225 }],
      fromBounds,
      toBounds,
      gap,
      arrowSize,
    );
    // Should have 3 L commands (start → mid → end, but end is shortened)
    const lCount = (result.path.match(/L/g) || []).length;
    expect(lCount).toBeGreaterThanOrEqual(2);
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

  it('arrow points in correct direction', () => {
    // Arrow pointing right (angle = 0)
    const result = computeArrowPoints(
      { x: 100, y: 100 },
      0,
      10,
      'filled',
    );
    const points = result.split(' ').map(p => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });
    // Tip should be at (100, 100), base points should be to the left
    expect(points[1].x).toBeCloseTo(100, 1); // tip
    expect(points[1].y).toBeCloseTo(100, 1);
    // Base points should have x < tip.x
    expect(points[0].x).toBeLessThan(100);
    expect(points[2].x).toBeLessThan(100);
  });

  it('open arrow returns V shape', () => {
    const result = computeArrowPoints(
      { x: 100, y: 100 },
      0,
      10,
      'open',
    );
    expect(result.split(' ').length).toBe(3);
  });

  it('circle arrow returns center and radius', () => {
    const result = computeArrowPoints(
      { x: 100, y: 100 },
      0,
      10,
      'circle',
    );
    expect(result).toContain('5'); // radius = size/2
  });
});
