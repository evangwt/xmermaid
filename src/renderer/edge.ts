import type { Point, Bounds, CurveStyle, ArrowStyle } from '../types';

export interface EdgePathResult {
  path: string; // SVG path d attribute
  arrowTip: Point; // Where the arrow tip points (on the target node boundary)
  arrowAngle: number; // Angle in radians for arrow rotation
  labelPosition?: Point;
}

/**
 * Given a line from `from` to `to`, find the point on the boundary of `bounds`
 * (inset by `gap`) closest to `from`. This is where the edge should start/end
 * to avoid overlapping the node.
 *
 * Uses ray-box intersection: the ray goes from `to` toward `from`.
 */
export function truncateAtBounds(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const left = bounds.x + gap;
  const right = bounds.x + bounds.width - gap;
  const top = bounds.y + gap;
  const bottom = bounds.y + bounds.height - gap;

  const dx = from.x - to.x;
  const dy = from.y - to.y;

  // If the ray has zero length, return to as-is
  if (dx === 0 && dy === 0) {
    return { x: to.x, y: to.y };
  }

  let tMin = Infinity;

  // Check all four sides
  // Left side: x = left, t = (left - to.x) / dx
  if (dx !== 0) {
    const t = (left - to.x) / dx;
    if (t > 0) {
      const y = to.y + t * dy;
      if (y >= top && y <= bottom && t < tMin) {
        tMin = t;
      }
    }

    // Right side: x = right
    const tRight = (right - to.x) / dx;
    if (tRight > 0) {
      const y = to.y + tRight * dy;
      if (y >= top && y <= bottom && tRight < tMin) {
        tMin = tRight;
      }
    }
  }

  if (dy !== 0) {
    // Top side: y = top, t = (top - to.y) / dy
    const t = (top - to.y) / dy;
    if (t > 0) {
      const x = to.x + t * dx;
      if (x >= left && x <= right && t < tMin) {
        tMin = t;
      }
    }

    // Bottom side: y = bottom
    const tBottom = (bottom - to.y) / dy;
    if (tBottom > 0) {
      const x = to.x + tBottom * dx;
      if (x >= left && x <= right && tBottom < tMin) {
        tMin = tBottom;
      }
    }
  }

  // If no valid intersection found, return to (fallback)
  if (tMin === Infinity) {
    return { x: to.x, y: to.y };
  }

  return {
    x: to.x + tMin * dx,
    y: to.y + tMin * dy,
  };
}

/**
 * Compute a smooth bezier curve through waypoints with gap truncation.
 */
export function computeBezierPath(
  waypoints: Point[],
  fromBounds: Bounds,
  toBounds: Bounds,
  gap: number,
): EdgePathResult {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  // Start point: truncate from first waypoint toward second (or toward toCenter)
  const second = waypoints[1];
  const toCenter: Point = {
    x: toBounds.x + toBounds.width / 2,
    y: toBounds.y + toBounds.height / 2,
  };
  const towardFrom = second || toCenter;
  const start = truncateAtBounds(towardFrom, first, fromBounds, gap);

  // End point: truncate from last waypoint toward second-to-last (or toward start)
  const secondLast = waypoints[waypoints.length - 2];
  const towardEnd: Point = secondLast || start;
  const end = truncateAtBounds(towardEnd, last, toBounds, gap);

  // Compute arrow angle from secondLast waypoint to end
  const arrowAngle = Math.atan2(
    last.y - secondLast.y,
    last.x - secondLast.x,
  );

  // Build path
  let path: string;

  if (waypoints.length === 2) {
    // Simple quadratic bezier with control point at midpoint
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    path = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  } else {
    // Cubic bezier segments through midpoints between consecutive waypoints
    // Replace first and last waypoints with truncated start/end
    const points: Point[] = [start, ...waypoints.slice(1, -1), end];

    if (points.length === 2) {
      path = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    } else {
      // "Curve through points" technique:
      // For each pair of midpoints between consecutive waypoints, use the waypoint as a control point
      const segments: string[] = [`M ${points[0].x} ${points[0].y}`];

      // Compute midpoints between consecutive points
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        if (i === 1) {
          // First segment: from start to midpoint between point[1] and point[2]
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          segments.push(`C ${curr.x} ${curr.y} ${curr.x} ${curr.y} ${midX} ${midY}`);
        } else if (i === points.length - 2) {
          // Last segment: from previous midpoint to end, using current as control
          segments.push(`C ${curr.x} ${curr.y} ${curr.x} ${curr.y} ${points[points.length - 1].x} ${points[points.length - 1].y}`);
        } else {
          // Middle segment: from midpoint to midpoint, using current as control
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          segments.push(`C ${curr.x} ${curr.y} ${curr.x} ${curr.y} ${midX} ${midY}`);
        }
      }

      path = segments.join(' ');
    }
  }

  return {
    path,
    arrowTip: end,
    arrowAngle,
  };
}

/**
 * Compute a step/orthogonal path with gap truncation.
 */
export function computeStepPath(
  waypoints: Point[],
  fromBounds: Bounds,
  toBounds: Bounds,
  gap: number,
): EdgePathResult {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  const second = waypoints[1];
  const toCenter: Point = {
    x: toBounds.x + toBounds.width / 2,
    y: toBounds.y + toBounds.height / 2,
  };
  const towardFrom = second || toCenter;
  const start = truncateAtBounds(towardFrom, first, fromBounds, gap);

  const secondLast = waypoints[waypoints.length - 2];
  const towardEnd: Point = secondLast || start;
  const end = truncateAtBounds(towardEnd, last, toBounds, gap);

  let path: string;

  if (waypoints.length === 2) {
    // H-V-H pattern: go horizontal to midpoint.x, then vertical, then horizontal
    const midX = (start.x + end.x) / 2;
    path = [
      `M ${start.x} ${start.y}`,
      `H ${midX}`,
      `V ${end.y}`,
      `H ${end.x}`,
    ].join(' ');
  } else {
    // Between each pair of consecutive waypoints, use H-V-H stepping
    const points: Point[] = [start, ...waypoints.slice(1, -1), end];
    const parts: string[] = [`M ${points[0].x} ${points[0].y}`];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      parts.push(`H ${midX}`);
      parts.push(`V ${curr.y}`);
      parts.push(`H ${curr.x}`);
    }

    path = parts.join(' ');
  }

  // Arrow angle based on the last segment direction
  const arrowAngle = Math.atan2(
    last.y - secondLast.y,
    last.x - secondLast.x,
  );

  return {
    path,
    arrowTip: end,
    arrowAngle,
  };
}

/**
 * Compute a straight line path with gap truncation.
 */
export function computeStraightPath(
  waypoints: Point[],
  fromBounds: Bounds,
  toBounds: Bounds,
  gap: number,
): EdgePathResult {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  const second = waypoints[1];
  const toCenter: Point = {
    x: toBounds.x + toBounds.width / 2,
    y: toBounds.y + toBounds.height / 2,
  };
  const towardFrom = second || toCenter;
  const start = truncateAtBounds(towardFrom, first, fromBounds, gap);

  const secondLast = waypoints[waypoints.length - 2];
  const towardEnd: Point = secondLast || start;
  const end = truncateAtBounds(towardEnd, last, toBounds, gap);

  // Build path with intermediate waypoints
  const parts: string[] = [`M ${start.x} ${start.y}`];

  // Add intermediate waypoints (between first and last, excluding them)
  for (let i = 1; i < waypoints.length - 1; i++) {
    parts.push(`L ${waypoints[i].x} ${waypoints[i].y}`);
  }

  parts.push(`L ${end.x} ${end.y}`);

  const path = parts.join(' ');

  const arrowAngle = Math.atan2(end.y - start.y, end.x - start.x);

  return {
    path,
    arrowTip: end,
    arrowAngle,
  };
}

/**
 * Dispatcher that calls the appropriate function based on curveStyle.
 */
export function computeEdgePath(
  waypoints: Point[],
  fromBounds: Bounds,
  toBounds: Bounds,
  curveStyle: CurveStyle,
  gap: number,
): EdgePathResult {
  switch (curveStyle) {
    case 'bezier':
      return computeBezierPath(waypoints, fromBounds, toBounds, gap);
    case 'step':
      return computeStepPath(waypoints, fromBounds, toBounds, gap);
    case 'straight':
      return computeStraightPath(waypoints, fromBounds, toBounds, gap);
    default:
      return computeBezierPath(waypoints, fromBounds, toBounds, gap);
  }
}

/**
 * Compute SVG polygon points for an arrow head.
 *
 * For 'filled' and 'triangle': equilateral triangle pointing in `angle` direction.
 * For 'open': two lines forming a V shape (includes the tip point).
 * For 'circle': small circle centered at tip.
 * For 'cross': two crossing lines.
 *
 * Returns coordinate string format: "x1,y1 x2,y2 x3,y3"
 */
export function computeArrowPoints(
  tip: Point,
  angle: number,
  size: number,
  style: ArrowStyle,
): string {
  if (style === 'circle') {
    // For circle, return a special format: center and radius
    const radius = size / 2;
    return `${tip.x},${tip.y} ${radius},0`;
  }

  if (style === 'cross') {
    // Two crossing lines perpendicular to the arrow direction
    const perpAngle = angle + Math.PI / 2;
    const halfSize = size / 2;
    const backDist = size * 0.7;

    const base = {
      x: tip.x - Math.cos(angle) * backDist,
      y: tip.y - Math.sin(angle) * backDist,
    };

    const p1 = {
      x: base.x + Math.cos(perpAngle) * halfSize,
      y: base.y + Math.sin(perpAngle) * halfSize,
    };
    const p2 = {
      x: base.x - Math.cos(perpAngle) * halfSize,
      y: base.y - Math.sin(perpAngle) * halfSize,
    };

    return `${p1.x},${p1.y} ${tip.x},${tip.y} ${p2.x},${p2.y}`;
  }

  // For 'filled', 'triangle', and 'open': equilateral triangle / V shape
  // The triangle points in `angle` direction with the tip at `tip`
  const arrowAngle = Math.PI / 6; // 30 degrees for equilateral triangle sides

  const backAngle1 = angle + Math.PI - arrowAngle;
  const backAngle2 = angle + Math.PI + arrowAngle;

  const p1 = {
    x: tip.x + Math.cos(backAngle1) * size,
    y: tip.y + Math.sin(backAngle1) * size,
  };
  const p2 = {
    x: tip.x + Math.cos(backAngle2) * size,
    y: tip.y + Math.sin(backAngle2) * size,
  };

  if (style === 'open') {
    // V shape: two lines from base points to the tip
    return `${p1.x},${p1.y} ${tip.x},${tip.y} ${p2.x},${p2.y}`;
  }

  // filled / triangle: full triangle
  return `${p1.x},${p1.y} ${tip.x},${tip.y} ${p2.x},${p2.y}`;
}
