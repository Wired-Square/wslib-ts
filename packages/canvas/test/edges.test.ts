import { expect, test, vi } from "vitest";

import type { CanvasEdge, EdgeGeometry } from "../src/createCanvas";
import { node, pointer, setup } from "./harness";

const edge = (id: string, source: string, target: string, extra: Partial<CanvasEdge<string>> = {}): CanvasEdge<string> => ({
  id,
  source,
  target,
  data: id,
  ...extra,
});

function withEdges() {
  const draws: [string, EdgeGeometry][] = [];
  const disposed: string[] = [];
  const mountEdge = vi.fn((_: SVGGElement, label: HTMLElement, mounted: CanvasEdge<string>) => ({
    draw(current: CanvasEdge<string>, geometry: EdgeGeometry) {
      draws.push([current.data, geometry]);
      label.textContent = current.data;
      label.style.transform = `translate(${geometry.target.x}px, ${geometry.target.y}px)`;
    },
    dispose: () => disposed.push(mounted.id),
  }));
  return { draws, disposed, mountEdge, ...setup<undefined, string>({ viewport: { x: 0, y: 0, zoom: 1 }, mountEdge }) };
}

test("an edge is drawn from its nodes' rectangles in a group with its class, and its label goes in the label layer", () => {
  const { root, canvas, layout, draws } = withEdges();
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  layout.settle();
  canvas.setEdges([edge("ab", "a", "b", { className: "hl" })]);
  expect(draws.at(-1)).toEqual([
    "ab",
    { source: { x: 0, y: 0, width: 100, height: 50 }, target: { x: 300, y: 0, width: 100, height: 50 } },
  ]);
  expect(root.querySelector(".app-canvas__edges > g")!.getAttribute("class")).toBe("app-canvas__edge hl");
  const label = root.querySelector<HTMLElement>(".app-canvas__labels > .app-canvas__label")!;
  expect(label.textContent).toBe("ab");
  expect(label.style.transform).toBe("translate(300px, 0px)");
});

test("an edge is redrawn when a node it joins moves or resizes, or it changes, and not otherwise", () => {
  const { root, canvas, layout, draws, mountEdge } = withEdges();
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0), node("c", 0, 300)]);
  canvas.setEdges([edge("ab", "a", "b")]);
  const count = () => draws.length;
  expect(count()).toBe(1);

  canvas.setNodes([node("a", 0, 0), node("b", 300, 0), node("c", 0, 400)]);
  expect(count()).toBe(1);
  canvas.setEdges([edge("ab", "a", "b")]);
  expect(count()).toBe(2);
  layout.settle();
  expect(count()).toBe(3);

  const element = root.querySelector('.app-canvas__node[data-id="b"]')!;
  pointer(element, "pointerdown", 310, 10);
  pointer(element, "pointermove", 330, 10);
  expect(draws.at(-1)![1].target.x).toBe(320);
  pointer(element, "pointerup", 330, 10);
  expect(mountEdge).toHaveBeenCalledOnce();
});

test("edges whose span is out of view, or whose node is missing, are not mounted", () => {
  const { canvas, mountEdge, disposed } = withEdges();
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0), node("far", 5000, 5000), node("far2", 6000, 5000)]);
  canvas.setEdges([edge("ab", "a", "b"), edge("across", "a", "far"), edge("away", "far", "far2"), edge("loose", "a", "gone")]);
  expect(mountEdge.mock.calls.map(([, , e]) => e.id)).toEqual(["ab", "across"]);
  canvas.setEdges([edge("across", "a", "far")]);
  expect(disposed).toEqual(["ab"]);
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  expect(disposed).toEqual(["ab", "across"]);
});

test("dragging from a source handle draws a line, marks the canvas connecting, and a drop on another node connects", () => {
  const onConnect = vi.fn();
  const onNodeDrag = vi.fn();
  const { root, canvas, layout } = setup({
    viewport: { x: 0, y: 0, zoom: 1 },
    onConnect,
    onNodeDrag,
    mount(element) {
      element.innerHTML = `<span class="canvas-source"></span>`;
      return () => {};
    },
  });
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  layout.settle();
  const handle = root.querySelector('[data-id="a"] .canvas-source')!;
  pointer(handle, "pointerdown", 95, 5);
  expect(root.classList.contains("is-connecting")).toBe(true);
  pointer(handle, "pointermove", 200, 20);
  expect(root.querySelector(".app-canvas__connection-line")!.getAttribute("d")).toBe("M95,5L200,20");
  pointer(handle, "pointerup", 320, 20);
  expect(onConnect).toHaveBeenCalledWith("a", "b");
  expect(root.classList.contains("is-connecting")).toBe(false);
  expect(root.querySelector(".app-canvas__connection-line")).toBeNull();
  expect(onNodeDrag).not.toHaveBeenCalled();
  expect(canvas.getNode("a")).toMatchObject({ x: 0, y: 0 });
});

test("a connection dropped on the empty pane, or back on its own node, does nothing", () => {
  const onConnect = vi.fn();
  const { root, canvas, layout } = setup({
    viewport: { x: 0, y: 0, zoom: 1 },
    onConnect,
    mount(element) {
      element.innerHTML = `<span class="canvas-source"></span>`;
      return () => {};
    },
  });
  canvas.setNodes([node("a", 0, 0)]);
  layout.settle();
  const handle = root.querySelector(".canvas-source")!;
  pointer(handle, "pointerdown", 95, 5);
  pointer(handle, "pointerup", 500, 500);
  pointer(handle, "pointerdown", 95, 5);
  pointer(handle, "pointerup", 50, 20);
  expect(onConnect).not.toHaveBeenCalled();
  expect(root.classList.contains("is-connecting")).toBe(false);
});
