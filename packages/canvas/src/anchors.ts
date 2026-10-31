import type { Point, Rect } from "./viewport.js";

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
