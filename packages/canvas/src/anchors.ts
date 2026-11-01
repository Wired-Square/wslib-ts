import type { Point, Rect, Size } from "./viewport.js";

export type Side = "top" | "right" | "bottom" | "left";

export interface Anchor extends Point {
  side: Side;
}

/** Where the line between the centres of `rect` and `other` leaves `rect`, and the side it leaves by. */
function anchor(rect: Rect, other: Rect): Anchor {
  const centreX = rect.x + rect.width / 2;
  const centreY = rect.y + rect.height / 2;
  const halfWidth = rect.width / 2 || 1;
  const halfHeight = rect.height / 2 || 1;
  const dx = other.x + other.width / 2 - centreX;
  const dy = other.y + other.height / 2 - centreY;
  const scale = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight) || 1;
  const x = centreX + dx / scale;
  const y = centreY + dy / scale;
  const side: Side =
    Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight ? (dx < 0 ? "left" : "right") : dy < 0 ? "top" : "bottom";
  return { x, y, side };
}

/** The floating anchors of an edge: where the line between the two centres crosses each rectangle's border. */
export const floatingAnchors = (source: Rect, target: Rect) => ({
  source: anchor(source, target),
  target: anchor(target, source),
});

/** The side of a node of `size` nearest the centre of `port`, a rectangle within it. */
function nearestSide(port: Rect, size: Size): Side {
  const x = port.x + port.width / 2;
  const y = port.y + port.height / 2;
  const gaps: [Side, number][] = [
    ["left", x],
    ["right", size.width - x],
    ["top", y],
    ["bottom", size.height - y],
  ];
  return gaps.reduce((nearest, gap) => (gap[1] < nearest[1] ? gap : nearest))[0];
}

/** Where an edge meets `port`, a rectangle within `node`: the middle of the port's side facing out, in canvas coordinates. */
export function portAnchor(node: Rect, port: Rect, side = nearestSide(port, node)): Anchor {
  const across = (start: number, length: number, low: Side, high: Side) =>
    start + (side === low ? 0 : side === high ? length : length / 2);
  return {
    x: node.x + across(port.x, port.width, "left", "right"),
    y: node.y + across(port.y, port.height, "top", "bottom"),
    side,
  };
}

const controlOffset = (distance: number, curvature: number) => (distance >= 0 ? distance / 2 : curvature * 25 * Math.sqrt(-distance));

function control({ x, y, side }: Anchor, towards: Point, curvature: number): Point {
  switch (side) {
    case "left":
      return { x: x - controlOffset(x - towards.x, curvature), y };
    case "right":
      return { x: x + controlOffset(towards.x - x, curvature), y };
    case "top":
      return { x, y: y - controlOffset(y - towards.y, curvature) };
    case "bottom":
      return { x, y: y + controlOffset(towards.y - y, curvature) };
  }
}

/** An SVG path from `source` to `target` whose ends leave along their sides; `curvature` bows an end that faces away from the other. */
export function bezierPath(source: Anchor, target: Anchor, curvature = 0.25): string {
  const a = control(source, target, curvature);
  const b = control(target, source, curvature);
  return `M${source.x},${source.y}C${a.x},${a.y} ${b.x},${b.y} ${target.x},${target.y}`;
}
