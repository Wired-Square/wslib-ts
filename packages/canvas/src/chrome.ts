import { html, svg } from "./dom.js";
import { boundsOf, visibleRect } from "./viewport.js";
import type { Point, Rect, Size, Viewport } from "./viewport.js";

export interface ChromeHost {
  root: HTMLElement;
  viewport(): Viewport;
  size(): Size;
  measure(element: HTMLElement): Size;
  panBy(delta: Point): void;
  settle(): void;
  zoomBy(factor: number, duration: number): void;
  wheelZoom(event: WheelEvent, about: Point): void;
  fitView(): void;
}

export function dots(root: HTMLElement, { gap, size }: { gap: number; size: number }) {
  const layer = html("div", "app-canvas__background", root);
  return ({ x, y, zoom }: Viewport) => {
    layer.style.backgroundSize = `${gap * zoom}px ${gap * zoom}px`;
    layer.style.backgroundPosition = `${x}px ${y}px`;
    layer.style.setProperty("--canvas-dot-radius", `${(size * zoom) / 2}px`);
  };
}

export function controls(host: ChromeHost) {
  const bar = html("div", "app-canvas__controls nopan nowheel", host.root);
  const buttons: [string, string, () => void][] = [
    ["Zoom in", "M8 3v10M3 8h10", () => host.zoomBy(1.2, 200)],
    ["Zoom out", "M3 8h10", () => host.zoomBy(1 / 1.2, 200)],
    ["Fit view", "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4", host.fitView],
  ];
  for (const [label, path, act] of buttons) {
    const button = html("button", "app-canvas__control", bar);
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", act);
    const glyph = svg("svg", "app-canvas__glyph", button);
    glyph.setAttribute("viewBox", "0 0 16 16");
    glyph.setAttribute("aria-hidden", "true");
    svg("path", "", glyph).setAttribute("d", path);
  }
}

const MARGIN = 0.05;

const box = ({ x, y, width, height }: Rect) => `M${x},${y}h${width}v${height}h${-width}z`;

export interface MinimapNode {
  rect: Rect;
  colour: string | undefined;
}

export function minimap(host: ChromeHost) {
  const frame = html("div", "app-canvas__minimap nopan nowheel", host.root);
  const map = svg("svg", "app-canvas__minimap-map", frame);
  const nodes = svg("g", "", map);
  const mask = svg("path", "app-canvas__minimap-mask", map);
  const shownBox = svg("rect", "app-canvas__minimap-view", map);
  let size = host.measure(frame);
  let all: Rect | undefined;
  let unitsPerPixel = 1;
  let rects: Rect[] = [];

  // The map's frame holds still while it is dragged, so the pointer keeps one scale.
  let drag: { pointer: number; from: Point; moved: boolean } | undefined;
  frame.addEventListener("pointerdown", (event) => {
    if (event.button === 0) drag = { pointer: event.pointerId, from: { x: event.clientX, y: event.clientY }, moved: false };
  });
  const move = (event: PointerEvent) => {
    if (drag?.pointer !== event.pointerId) return;
    if (event.buttons === 0) return end(event);
    const { zoom } = host.viewport();
    const dx = drag.from.x - event.clientX;
    const dy = drag.from.y - event.clientY;
    if (!dx && !dy) return;
    drag = { ...drag, from: { x: event.clientX, y: event.clientY }, moved: true };
    host.panBy({ x: dx * unitsPerPixel * zoom, y: dy * unitsPerPixel * zoom });
  };
  const end = (event: PointerEvent) => {
    if (drag?.pointer !== event.pointerId) return;
    const { moved } = drag;
    drag = undefined;
    if (!moved) return;
    view();
    host.settle();
  };
  const listeners = [
    ["pointermove", move],
    ["pointerup", end],
    ["pointercancel", end],
  ] as const;
  for (const [type, listener] of listeners) document.addEventListener(type, listener, true);
  frame.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const { width, height } = host.size();
      host.wheelZoom(event, { x: width / 2, y: height / 2 });
    },
    { passive: false },
  );

  function view() {
    if (!size.width || !size.height) return;
    const shown = visibleRect(host.viewport(), host.size());
    if (!drag || !all) {
      const bounds = boundsOf([...rects, shown])!;
      unitsPerPixel = (1 + 2 * MARGIN) * Math.max(bounds.width / size.width, bounds.height / size.height);
      const width = size.width * unitsPerPixel;
      const height = size.height * unitsPerPixel;
      all = { x: bounds.x - (width - bounds.width) / 2, y: bounds.y - (height - bounds.height) / 2, width, height };
      map.setAttribute("viewBox", `${all.x} ${all.y} ${all.width} ${all.height}`);
    }
    mask.setAttribute("d", `${box(all)}${box(shown)}`);
    for (const [name, value] of Object.entries(shown)) shownBox.setAttribute(name, String(value));
  }

  return {
    frame,
    view,
    resize() {
      size = host.measure(frame);
    },
    nodes(next: readonly MinimapNode[]) {
      rects = next.map(({ rect }) => rect);
      nodes.replaceChildren(
        ...next.map(({ rect, colour }) => {
          const shape = svg("rect", "app-canvas__minimap-node");
          for (const [name, value] of Object.entries(rect)) shape.setAttribute(name, String(value));
          if (colour) shape.style.fill = colour;
          return shape;
        }),
      );
    },
    destroy() {
      for (const [type, listener] of listeners) document.removeEventListener(type, listener, true);
    },
  };
}
