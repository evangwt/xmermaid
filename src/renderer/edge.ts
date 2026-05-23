import type { Point, Bounds, CurveStyle, ArrowStyle, NodeShape } from '../types';

export interface EdgePathResult {
  path: string; // SVG path d attribute — ends at arrow base (pathEnd)
  arrowTip: Point; // Where the arrow tip points, on the target node boundary
  arrowAngle: number; // Angle in radians from path tangent at endpoint
  pathEnd?: Point; // Where the path line ends before the arrow tail
}

/**
 * Given a line from `from` to `to`, find the point on the boundary of `bounds`
 * offset outward by `gap`. This is where the edge should start/end
 * to avoid overlapping the node.
 *
 * Uses ray-box intersection: the ray goes from `to` toward `from`.
 * First finds the exit point on the original bounds, then pushes it
 * outward by `gap` along the ray direction.
 */
export function truncateAtBounds(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
  shape?: NodeShape,
): Point {
  switch (shape) {
    case 'Diamond':
      return truncateAtDiamond(from, to, bounds, gap);
    case 'Circle':
      return truncateAtCircle(from, to, bounds, gap);
    case 'Hexagon':
      return truncateAtHexagon(from, to, bounds, gap);
    case 'Parallelogram':
      return truncateAtParallelogram(from, to, bounds, gap);
    case 'Trapezoid':
      return truncateAtTrapezoid(from, to, bounds, gap);
    case 'Stadium':
      return truncateAtStadium(from, to, bounds, gap);
    default:
      break;
  }

  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;

  const dx = from.x - to.x;
  const dy = from.y - to.y;

  // If the ray has zero length, return to as-is
  if (dx === 0 && dy === 0) {
    return { x: to.x, y: to.y };
  }

  let tMax = -1;

  // Check all four sides of the ORIGINAL bounds — find exit point (farthest t)
  if (dx !== 0) {
    const t = (left - to.x) / dx;
    if (t > 0) {
      const y = to.y + t * dy;
      if (y >= top && y <= bottom && t > tMax) {
        tMax = t;
      }
    }

    const tRight = (right - to.x) / dx;
    if (tRight > 0) {
      const y = to.y + tRight * dy;
      if (y >= top && y <= bottom && tRight > tMax) {
        tMax = tRight;
      }
    }
  }

  if (dy !== 0) {
    const t = (top - to.y) / dy;
    if (t > 0) {
      const x = to.x + t * dx;
      if (x >= left && x <= right && t > tMax) {
        tMax = t;
      }
    }

    const tBottom = (bottom - to.y) / dy;
    if (tBottom > 0) {
      const x = to.x + tBottom * dx;
      if (x >= left && x <= right && tBottom > tMax) {
        tMax = tBottom;
      }
    }
  }

  // If no valid intersection found, return to (fallback)
  if (tMax <= 0) {
    return { x: to.x, y: to.y };
  }

  // Find intersection on original bounds
  const hitX = to.x + tMax * dx;
  const hitY = to.y + tMax * dy;

  // Push outward by gap along the ray direction (from to -> from)
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: hitX + (dx / len) * gap,
    y: hitY + (dy / len) * gap,
  };
}

/**
 * Generic ray-polygon edge intersection.
 * Given a ray from `to` toward `from`, find the exit intersection
 * (farthest positive t) with the edges of a convex polygon defined by `vertices`,
 * then push outward by `gap` along the ray direction.
 */
function truncateAtPolygon(
  from: Point,
  to: Point,
  vertices: Point[],
  gap: number,
): Point {
  const dx = from.x - to.x;
  const dy = from.y - to.y;

  if (dx === 0 && dy === 0) return { x: to.x, y: to.y };

  let tMax = -1;

  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];

    const segDx = p2.x - p1.x;
    const segDy = p2.y - p1.y;

    const denom = dx * segDy - dy * segDx;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((p1.x - to.x) * segDy - (p1.y - to.y) * segDx) / denom;
    const s = ((p1.x - to.x) * dy - (p1.y - to.y) * dx) / denom;

    if (t > 0 && s >= 0 && s <= 1 && t > tMax) {
      tMax = t;
    }
  }

  if (tMax <= 0) return { x: to.x, y: to.y };

  const hitX = to.x + tMax * dx;
  const hitY = to.y + tMax * dy;

  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: hitX + (dx / len) * gap,
    y: hitY + (dy / len) * gap,
  };
}

/**
 * Truncate at a diamond boundary (rotated square).
 * The diamond has vertices at: top, right, bottom, left of the bounds.
 */
function truncateAtDiamond(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const vertices: Point[] = [
    { x: cx, y: bounds.y },
    { x: bounds.x + bounds.width, y: cy },
    { x: cx, y: bounds.y + bounds.height },
    { x: bounds.x, y: cy },
  ];
  return truncateAtPolygon(from, to, vertices, gap);
}

/**
 * Truncate at a circle boundary.
 */
function truncateAtCircle(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const r = Math.min(bounds.width, bounds.height) / 2;

  const dx = from.x - to.x;
  const dy = from.y - to.y;

  if (dx === 0 && dy === 0) return { x: to.x, y: to.y };

  // Ray: to + t*(from-to), Circle: (x-cx)^2 + (y-cy)^2 = r^2
  const ox = to.x - cx;
  const oy = to.y - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - r * r;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return { x: to.x, y: to.y };

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  // We want the exit point (largest positive t) since 'to' is typically inside the shape
  let t = -1;
  if (t1 > 0) t = t1;
  if (t2 > 0 && t2 > t) t = t2;

  if (t <= 0) return { x: to.x, y: to.y };

  const hitX = to.x + t * dx;
  const hitY = to.y + t * dy;

  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: hitX + (dx / len) * gap,
    y: hitY + (dy / len) * gap,
  };
}

/**
 * Truncate at a hexagon boundary.
 * Vertices: (x+offset, y), (x+w-offset, y), (x+w, cy), (x+w-offset, y+h), (x+offset, y+h), (x, cy)
 * where offset = width * 0.25
 */
function truncateAtHexagon(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const { x, y, width, height } = bounds;
  const cy = y + height / 2;
  const offset = width * 0.25;
  const vertices: Point[] = [
    { x: x + offset, y },
    { x: x + width - offset, y },
    { x: x + width, y: cy },
    { x: x + width - offset, y: y + height },
    { x: x + offset, y: y + height },
    { x, y: cy },
  ];
  return truncateAtPolygon(from, to, vertices, gap);
}

/**
 * Truncate at a parallelogram boundary.
 * Vertices: (x+offset, y), (x+w, y), (x+w-offset, y+h), (x, y+h)
 * where offset = width * 0.15
 */
function truncateAtParallelogram(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const { x, y, width, height } = bounds;
  const offset = width * 0.15;
  const vertices: Point[] = [
    { x: x + offset, y },
    { x: x + width, y },
    { x: x + width - offset, y: y + height },
    { x, y: y + height },
  ];
  return truncateAtPolygon(from, to, vertices, gap);
}

/**
 * Truncate at a trapezoid boundary.
 * Vertices: (x+offset, y), (x+w-offset, y), (x+w, y+h), (x, y+h)
 * where offset = width * 0.15
 */
function truncateAtTrapezoid(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const { x, y, width, height } = bounds;
  const offset = width * 0.15;
  const vertices: Point[] = [
    { x: x + offset, y },
    { x: x + width - offset, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  return truncateAtPolygon(from, to, vertices, gap);
}

/**
 * Truncate at a stadium (pill) boundary.
 * The shape is a rectangle with semicircular left/right caps.
 * For horizontal approach: intersect with the left or right semicircle.
 * For vertical approach: intersect with the top or bottom straight edge (rectangle).
 */
function truncateAtStadium(
  from: Point,
  to: Point,
  bounds: Bounds,
  gap: number,
): Point {
  const { x, y, width, height } = bounds;
  const cy = y + height / 2;
  const r = height / 2;

  const dx = from.x - to.x;
  const dy = from.y - to.y;

  if (dx === 0 && dy === 0) return { x: to.x, y: to.y };

  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  if (isHorizontal) {
    // Approach from left or right: use circle intersection at the appropriate semicircle center
    const circleCx = dx > 0 ? x + width - r : x + r;
    const ox = to.x - circleCx;
    const oy = to.y - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - r * r;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return { x: to.x, y: to.y };

    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);

    // We want the exit point (largest positive t) since 'to' is typically inside the shape
    let t = -1;
    if (t1 > 0) t = t1;
    if (t2 > 0 && t2 > t) t = t2;

    if (t <= 0) return { x: to.x, y: to.y };

    const hitX = to.x + t * dx;
    const hitY = to.y + t * dy;

    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      x: hitX + (dx / len) * gap,
      y: hitY + (dy / len) * gap,
    };
  } else {
    // Approach from top or bottom: use rectangle intersection (same as default case)
    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;

    let tMax = -1;

    if (dx !== 0) {
      const t = (left - to.x) / dx;
      if (t > 0) {
        const yHit = to.y + t * dy;
        if (yHit >= top && yHit <= bottom && t > tMax) {
          tMax = t;
        }
      }
      const tRight = (right - to.x) / dx;
      if (tRight > 0) {
        const yHit = to.y + tRight * dy;
        if (yHit >= top && yHit <= bottom && tRight > tMax) {
          tMax = tRight;
        }
      }
    }

    if (dy !== 0) {
      const t = (top - to.y) / dy;
      if (t > 0) {
        const xHit = to.x + t * dx;
        if (xHit >= left && xHit <= right && t > tMax) {
          tMax = t;
        }
      }
      const tBottom = (bottom - to.y) / dy;
      if (tBottom > 0) {
        const xHit = to.x + tBottom * dx;
        if (xHit >= left && xHit <= right && tBottom > tMax) {
          tMax = tBottom;
        }
      }
    }

    if (tMax <= 0) return { x: to.x, y: to.y };

    const hitX = to.x + tMax * dx;
    const hitY = to.y + tMax * dy;

    const len = Math.sqrt(dx * dx + dy * dy);
    return {
      x: hitX + (dx / len) * gap,
      y: hitY + (dy / len) * gap,
    };
  }
}

/**
 * Compute a smooth bezier curve through waypoints with gap truncation.
 *
 * Key improvements over previous implementation:
 * - 2-waypoint edges use cubic bezier with gentle S-curve (not degenerate quadratic)
 * - Multi-waypoint edges use Catmull-Rom spline conversion (no cusps)
 * - Arrow angle computed from bezier tangent at endpoint (not center-to-center)
 * - Path shortened by edgeGap + arrowSize so line ends before the arrow tail
 */
export function computeBezierPath(
  waypoints: Point[],
  fromBounds: Bounds,
  toBounds: Bounds,
  gap: number,
  arrowSize: number,
  fromShape?: NodeShape,
  toShape?: NodeShape,
): EdgePathResult {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  // Compute approach directions for truncation
  // For source: ray from first toward second (exits source node)
  // For target: ray from last toward secondLast (enters target node)
  const sourceApproach: Point = waypoints.length >= 2 ? waypoints[1] : last;
  const targetApproach: Point = waypoints.length >= 2 ? waypoints[waypoints.length - 2] : first;

  const start = truncateAtBounds(sourceApproach, first, fromBounds, gap, fromShape);
  const arrowTip = truncateAtBounds(targetApproach, last, toBounds, 0, toShape);

  let path: string;
  let arrowAngle: number;
  let lastCp2: Point;

  if (waypoints.length === 2) {
    // Cubic bezier with control points offset along primary axis
    const dx = arrowTip.x - start.x;
    const dy = arrowTip.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tension = Math.min(dist * 0.4, 50);
    const isVertical = Math.abs(dy) >= Math.abs(dx);

    let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
    if (isVertical) {
      cp1x = start.x;
      cp1y = start.y + tension * (dy >= 0 ? 1 : -1);
      cp2x = arrowTip.x;
      cp2y = arrowTip.y - tension * (dy >= 0 ? 1 : -1);
    } else {
      cp1x = start.x + tension * (dx >= 0 ? 1 : -1);
      cp1y = start.y;
      cp2x = arrowTip.x - tension * (dx >= 0 ? 1 : -1);
      cp2y = arrowTip.y;
    }

    lastCp2 = { x: cp2x, y: cp2y };
    path = `M ${start.x} ${start.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${arrowTip.x} ${arrowTip.y}`;
  } else {
    // Multi-waypoint: Catmull-Rom to cubic bezier conversion
    const points: Point[] = [start, ...waypoints.slice(1, -1), arrowTip];
    const segments = catmullRomToBezierSegments(points);
    path = segments.join(' ');

    // Extract last cp2 from the final C command for arrow angle
    lastCp2 = extractLastCp2(path, arrowTip);
  }

  // Arrow angle from bezier tangent at endpoint: direction from cp2 to end
  arrowAngle = Math.atan2(arrowTip.y - lastCp2.y, arrowTip.x - lastCp2.x);

  // Shorten path by gap + arrowSize so the stroke stops before the arrow tail
  // while the arrow tip itself remains on the target boundary.
  const arrowBase: Point = {
    x: arrowTip.x - Math.cos(arrowAngle) * (gap + arrowSize),
    y: arrowTip.y - Math.sin(arrowAngle) * (gap + arrowSize),
  };

  // Replace the final endpoint in the path string with arrowBase
  path = replacePathEndpoint(path, arrowTip, arrowBase);

  return {
    path,
    arrowTip,
    arrowAngle,
    pathEnd: arrowBase,
  };
}

/**
 * Convert waypoints to smooth cubic bezier segments using Catmull-Rom spline.
 * Guarantees C1 continuity (smooth tangent) at every waypoint — no cusps.
 */
function catmullRomToBezierSegments(points: Point[], tension: number = 1.0): string[] {
  const n = points.length;
  if (n < 2) return [];

  const segments: string[] = [`M ${points[0].x} ${points[0].y}`];
  const alpha = tension / 3.0;

  // Pad with virtual endpoints for natural end conditions
  const padded: Point[] = [points[0], ...points, points[n - 1]];

  for (let i = 1; i <= n - 1; i++) {
    const p0 = padded[i - 1];
    const p1 = padded[i];
    const p2 = padded[i + 1];
    const p3 = padded[i + 2];

    const cp1x = p1.x + (p2.x - p0.x) * alpha;
    const cp1y = p1.y + (p2.y - p0.y) * alpha;
    const cp2x = p2.x - (p3.x - p1.x) * alpha;
    const cp2y = p2.y - (p3.y - p1.y) * alpha;

    segments.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }

  return segments;
}

/**
 * Extract the second control point (cp2) from the last C command in a path string.
 */
function extractLastCp2(path: string, fallbackEnd: Point): Point {
  // Find the last 'C' command and parse its 6 numbers
  const lastCIndex = path.lastIndexOf('C');
  if (lastCIndex === -1) return fallbackEnd;

  const afterC = path.substring(lastCIndex + 1).trim();
  const nums = afterC.split(/[\s,]+/).map(Number);
  if (nums.length >= 6) {
    return { x: nums[2], y: nums[3] }; // cp2 is the 3rd and 4th numbers
  }
  return fallbackEnd;
}

/**
 * Replace the last coordinate pair in an SVG path string.
 */
function replacePathEndpoint(path: string, oldEnd: Point, newEnd: Point): string {
  // Find and replace the last occurrence of the endpoint coordinates
  const oldStr = `${oldEnd.x} ${oldEnd.y}`;
  const newStr = `${newEnd.x} ${newEnd.y}`;
  const lastIdx = path.lastIndexOf(oldStr);
  if (lastIdx === -1) return path;
  return path.substring(0, lastIdx) + newStr + path.substring(lastIdx + oldStr.length);
}

/**
 * Compute a step/orthogonal path with gap truncation.
 */
export function computeStepPath(
  waypoints: Point[],
  fromBounds: Bounds,
  toBounds: Bounds,
  gap: number,
  arrowSize: number,
  fromShape?: NodeShape,
  toShape?: NodeShape,
): EdgePathResult {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  // Approach direction for truncation: from waypoint toward next waypoint
  const sourceApproach: Point = waypoints.length >= 2 ? waypoints[1] : last;
  const targetApproach: Point = waypoints.length >= 2 ? waypoints[waypoints.length - 2] : first;

  const start = truncateAtBounds(sourceApproach, first, fromBounds, gap, fromShape);
  const arrowTip = truncateAtBounds(targetApproach, last, toBounds, 0, toShape);

  // Arrow angle from last segment direction (from secondLast toward last)
  const arrowAngle = Math.atan2(
    last.y - targetApproach.y,
    last.x - targetApproach.x,
  );

  // Shorten path by gap + arrowSize so the visible stroke stops before the arrow tail.
  const arrowBase: Point = {
    x: arrowTip.x - Math.cos(arrowAngle) * (gap + arrowSize),
    y: arrowTip.y - Math.sin(arrowAngle) * (gap + arrowSize),
  };

  let path: string;

  if (waypoints.length === 2) {
    // H-V-H pattern: go horizontal to midpoint.x, then vertical, then horizontal
    const midX = (start.x + arrowBase.x) / 2;
    path = [
      `M ${start.x} ${start.y}`,
      `H ${midX}`,
      `V ${arrowBase.y}`,
      `L ${arrowBase.x} ${arrowBase.y}`,
    ].join(' ');
  } else {
    // Between each pair of consecutive waypoints, use H-V-H stepping
    const points: Point[] = [start, ...waypoints.slice(1, -1), arrowBase];
    const parts: string[] = [`M ${points[0].x} ${points[0].y}`];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      parts.push(`H ${midX}`);
      parts.push(`V ${curr.y}`);
      parts.push(`L ${curr.x} ${curr.y}`);
    }

    path = parts.join(' ');
  }

  return {
    path,
    arrowTip,
    arrowAngle,
    pathEnd: arrowBase,
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
  arrowSize: number,
  fromShape?: NodeShape,
  toShape?: NodeShape,
): EdgePathResult {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required');
  }

  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];

  // Approach direction for truncation: from waypoint toward next waypoint
  const sourceApproach: Point = waypoints.length >= 2 ? waypoints[1] : last;
  const targetApproach: Point = waypoints.length >= 2 ? waypoints[waypoints.length - 2] : first;

  const start = truncateAtBounds(sourceApproach, first, fromBounds, gap, fromShape);
  const arrowTip = truncateAtBounds(targetApproach, last, toBounds, 0, toShape);

  // Arrow angle from last segment direction (from secondLast toward last)
  const arrowAngle = Math.atan2(
    last.y - targetApproach.y,
    last.x - targetApproach.x,
  );

  // Shorten path by gap + arrowSize so the visible stroke stops before the arrow tail.
  const arrowBase: Point = {
    x: arrowTip.x - Math.cos(arrowAngle) * (gap + arrowSize),
    y: arrowTip.y - Math.sin(arrowAngle) * (gap + arrowSize),
  };

  // Build path with intermediate waypoints
  const parts: string[] = [`M ${start.x} ${start.y}`];

  // Add intermediate waypoints (between first and last, excluding them)
  for (let i = 1; i < waypoints.length - 1; i++) {
    parts.push(`L ${waypoints[i].x} ${waypoints[i].y}`);
  }

  parts.push(`L ${arrowBase.x} ${arrowBase.y}`);

  return {
    path: parts.join(' '),
    arrowTip,
    arrowAngle,
    pathEnd: arrowBase,
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
  arrowSize: number,
  fromShape?: NodeShape,
  toShape?: NodeShape,
): EdgePathResult {
  switch (curveStyle) {
    case 'bezier':
      return computeBezierPath(waypoints, fromBounds, toBounds, gap, arrowSize, fromShape, toShape);
    case 'step':
      return computeStepPath(waypoints, fromBounds, toBounds, gap, arrowSize, fromShape, toShape);
    case 'straight':
      return computeStraightPath(waypoints, fromBounds, toBounds, gap, arrowSize, fromShape, toShape);
    default:
      return computeBezierPath(waypoints, fromBounds, toBounds, gap, arrowSize, fromShape, toShape);
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
