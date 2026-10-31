import { afterEach } from "vitest";

import { createCanvas } from "../src/createCanvas";
import type { CanvasNode, CanvasOptions, SizeObserver } from "../src/createCanvas";
import type { Size } from "../src/viewport";

/** jsdom lays nothing out and observes no sizes, so a test sets them and says when they change. */
export function fakeLayout(rootSize: Size = { width: 800, height: 600 }) {
  const sizes = new Map<Element | string, Size>();
  const observed = new Set<Element>();
  let onResize: (elements: readonly Element[]) => void = () => {};
  const frames: ((now: number) => void)[] = [];
  let now = 0;
  return {
    measure(element: Element): Size {
      if (element.classList.contains("app-canvas")) return sizes.get(element) ?? rootSize;
      if (element.classList.contains("app-canvas__minimap")) return { width: 200, height: 150 };
      const id = (element as HTMLElement).dataset.id;
      return sizes.get(id ?? "") ?? { width: 100, height: 50 };
    },
    observe(callback: (elements: readonly Element[]) => void): SizeObserver {
      onResize = callback;
      return { observe: (e) => observed.add(e), unobserve: (e) => observed.delete(e), disconnect: () => observed.clear() };
    },
    frame: (step: (now: number) => void) => void frames.push(step),
    observed,
    /** Gives the node with `id`, or the element, a new size and reports it. */
    resize(target: string | Element, size: Size) {
      sizes.set(target, size);
      const element = typeof target === "string" ? [...observed].find((e) => (e as HTMLElement).dataset.id === target) : target;
      if (element && observed.has(element)) onResize([element]);
    },
    /** Reports every observed element, as a resize observer does once each is laid out. */
    settle() {
      onResize([...observed]);
    },
    /** Runs animation frames 16ms apart for `ms`. */
    advance(ms: number) {
      for (const end = now + ms; now < end && frames.length; ) {
        now += 16;
        for (const step of frames.splice(0)) step(now);
      }
    },
  };
}

export type Layout = ReturnType<typeof fakeLayout>;

const roots: HTMLElement[] = [];
const canvases: { destroy(): void }[] = [];
afterEach(() => {
  for (const canvas of canvases.splice(0)) canvas.destroy();
  for (const root of roots.splice(0)) root.remove();
});

export function newRoot() {
  const root = document.body.appendChild(document.createElement("div"));
  roots.push(root);
  return root;
}

export function setup<D = unknown, E = unknown>(options: Partial<CanvasOptions<D, E>> = {}, layout = fakeLayout()) {
  const root = newRoot();
  const mounted = new Map<string, HTMLElement>();
  const canvas = createCanvas<D, E>(root, {
    measure: layout.measure,
    observe: layout.observe,
    frame: layout.frame,
    mount(element, node) {
      element.textContent = node.id;
      mounted.set(node.id, element);
      return () => mounted.delete(node.id);
    },
    ...options,
  });
  canvases.push(canvas);
  return { root, canvas, layout, mounted };
}

export const node = <D = undefined>(id: string, x: number, y: number, extra: Partial<CanvasNode<D>> = {}) =>
  ({ id, x, y, data: undefined, ...extra }) as CanvasNode<D>;

export function pointer(target: Element, type: string, x: number, y: number, init: PointerEventInit = {}) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerId: 1,
      ...init,
    }),
  );
}

/** A press, a move by (`dx`, `dy`) in steps, and a release, as a mouse does it. */
export function drag(target: Element, from: [number, number], dx: number, dy: number, init: PointerEventInit = {}) {
  const [x, y] = from;
  pointer(target, "pointerdown", x, y, init);
  pointer(target, "pointermove", x + dx / 2, y + dy / 2, init);
  pointer(target, "pointermove", x + dx, y + dy, init);
  pointer(target, "pointerup", x + dx, y + dy, init);
}

export const transform = (root: HTMLElement) => root.querySelector<HTMLElement>(".app-canvas__pane")!.style.transform;
