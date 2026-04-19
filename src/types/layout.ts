export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface LayoutResult {
  positions: [string, Point][];
  dimensions: Dimensions;
}
