export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Rect = Point & Size;

/** The camera: the pane is translated by `x`, `y` screen pixels and scaled by `zoom`. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ZoomLimits {
  minZoom: number;
  maxZoom: number;
}

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** A point on the screen, relative to the canvas element, in canvas coordinates. */
export const toCanvas = (viewport: Viewport, point: Point): Point => ({
  x: (point.x - viewport.x) / viewport.zoom,
  y: (point.y - viewport.y) / viewport.zoom,
});

/** The viewport scaled to `zoom`, clamped, keeping `about` (relative to the canvas element) where it is on screen. */
export function zoomTo(viewport: Viewport, zoom: number, about: Point, limits: ZoomLimits): Viewport {
  const next = clamp(zoom, limits.minZoom, limits.maxZoom);
  const fixed = toCanvas(viewport, about);
  return { x: about.x - fixed.x * next, y: about.y - fixed.y * next, zoom: next };
}

/** The canvas area the viewport shows in a canvas element of `size`. */
export const visibleRect = (viewport: Viewport, size: Size): Rect => ({
  ...toCanvas(viewport, { x: 0, y: 0 }),
  width: size.width / viewport.zoom,
  height: size.height / viewport.zoom,
});

/** The smallest rectangle holding every one of `rects`, or `undefined` for none. */
export function boundsOf(rects: Iterable<Rect>): Rect | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return left === Infinity ? undefined : { x: left, y: top, width: right - left, height: bottom - top };
}

export const intersects = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

export const contains = (rect: Rect, point: Point) =>
  point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;

/** The viewport centring `bounds` in `size`, with `padding` as a fraction of the bounds on top. */
export function fitBounds(bounds: Rect, size: Size, padding: number, limits: ZoomLimits): Viewport {
  const room = 1 + padding;
  const zoom = clamp(
    Math.min(size.width / (bounds.width * room || 1), size.height / (bounds.height * room || 1)),
    limits.minZoom,
    limits.maxZoom,
  );
  return centreOn({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, zoom, size);
}

/** The viewport at `zoom` with canvas point `centre` in the middle of `size`. */
export const centreOn = (centre: Point, zoom: number, size: Size): Viewport => ({
  x: size.width / 2 - centre.x * zoom,
  y: size.height / 2 - centre.y * zoom,
  zoom,
});

/** The viewport `t` of the way from `from` to `to`, eased in and out. */
export function between(from: Viewport, to: Viewport, t: number): Viewport {
  const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  const at = (a: number, b: number) => a + (b - a) * eased;
  return { x: at(from.x, to.x), y: at(from.y, to.y), zoom: at(from.zoom, to.zoom) };
}

/** The zoom factor for a wheel event; a trackpad pinch arrives as a ctrl-wheel with small deltas, so it counts tenfold. */
export const wheelFactor = (deltaY: number, deltaMode: number, pinch: boolean) =>
  2 ** (-deltaY * (deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002) * (pinch ? 10 : 1));
