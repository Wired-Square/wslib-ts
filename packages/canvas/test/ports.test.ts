import { expect, test, vi } from "vitest";

import type { CanvasEdge, CanvasOptions, EdgeGeometry } from "../src/createCanvas";
import { fakeLayout, node, pointer, setup } from "./harness";

const ports: Record<string, string> = {
  a: `<span data-canvas-port="out"></span>`,
  b: `<span data-canvas-port="in"></span><span data-canvas-port="spare" data-canvas-side="top"></span>`,
};

/** Node `a` at the origin with port `out` on its right edge, `b` at (300, 0) with `in` on its left and `spare` below it. */
function board(options: Partial<CanvasOptions<undefined, string>> = {}) {
  const layout = fakeLayout();
  const draws: EdgeGeometry[] = [];
  const view = setup<undefined, string>(
    {
      viewport: { x: 0, y: 0, zoom: 1 },
      mount(element, { id }) {
        element.innerHTML = ports[id] ?? "";
        for (const port of element.querySelectorAll("[data-canvas-port]")) {
          const name = port.getAttribute("data-canvas-port");
          layout.place(port, name === "out" ? { x: 95, y: 20 } : name === "in" ? { x: -5, y: 20 } : { x: 20, y: 40 });
        }
        return () => {};
      },
      mountEdge: () => ({ draw: (_, geometry) => void draws.push(geometry) }),
      ...options,
    },
    layout,
  );
  view.canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  layout.settle();
  const port = (id: string, name: string) => view.root.querySelector(`[data-id="${id}"] [data-canvas-port="${name}"]`)!;
  return { ...view, draws, port };
}

const edge = (extra: Partial<CanvasEdge<string>> = {}): CanvasEdge<string> => ({ id: "ab", source: "a", target: "b", data: "", ...extra });

test("a press on a port starts a connection from its anchor, and a drop on another node's port reports both", () => {
  const onConnect = vi.fn();
  const { root, port } = board({ onConnect });
  pointer(port("a", "out"), "pointerdown", 100, 25);
  expect(root.classList.contains("is-connecting")).toBe(true);
  pointer(port("a", "out"), "pointermove", 200, 25);
  expect(root.querySelector(".app-canvas__connection-line")!.getAttribute("d")).toBe("M105,25L200,25");
  pointer(port("a", "out"), "pointerup", 297, 25);
  expect(onConnect).toHaveBeenCalledWith("a", "b", { sourcePort: "out", targetPort: "in" });
});

test("a drop on another node away from its ports reports no target port", () => {
  const onConnect = vi.fn();
  const { port } = board({ onConnect });
  pointer(port("a", "out"), "pointerdown", 100, 25);
  pointer(port("a", "out"), "pointerup", 380, 10);
  expect(onConnect).toHaveBeenCalledWith("a", "b", { sourcePort: "out", targetPort: undefined });
});

test("while drawing, the hovered port or node is marked valid or invalid, and a refused drop is not reported", () => {
  const onConnect = vi.fn();
  const isValidConnection = vi.fn((_: string, __: string | undefined, ___: string, targetPort: string | undefined) => targetPort !== "spare");
  const { root, port } = board({ onConnect, isValidConnection });
  const target = root.querySelector<HTMLElement>('[data-id="b"]')!;
  pointer(port("a", "out"), "pointerdown", 100, 25);

  pointer(port("a", "out"), "pointermove", 297, 25);
  expect(port("b", "in").classList.contains("is-valid-target")).toBe(true);
  expect(isValidConnection).toHaveBeenLastCalledWith("a", "out", "b", "in");

  pointer(port("a", "out"), "pointermove", 325, 45);
  expect(port("b", "in").classList.contains("is-valid-target")).toBe(false);
  expect(port("b", "spare").classList.contains("is-invalid-target")).toBe(true);

  pointer(port("a", "out"), "pointermove", 380, 10);
  expect(port("b", "spare").classList.contains("is-invalid-target")).toBe(false);
  expect(target.classList.contains("is-valid-target")).toBe(true);
  expect(isValidConnection).toHaveBeenCalledTimes(3);

  pointer(port("a", "out"), "pointermove", 325, 45);
  pointer(port("a", "out"), "pointerup", 325, 45);
  expect(onConnect).not.toHaveBeenCalled();
  expect(root.querySelectorAll(".is-valid-target, .is-invalid-target")).toHaveLength(0);
});

test("an edge naming ports is drawn with each port's anchor, explicit or inferred side, and follows a drag", () => {
  const { root, canvas, draws } = board();
  canvas.setEdges([edge({ sourcePort: "out", targetPort: "spare" })]);
  expect(draws.at(-1)).toMatchObject({
    sourcePort: { x: 105, y: 25, side: "right" },
    targetPort: { x: 325, y: 40, side: "top" },
  });
  const element = root.querySelector('[data-id="a"]')!;
  pointer(element, "pointerdown", 10, 10);
  pointer(element, "pointermove", 10, 40);
  expect(draws.at(-1)!.sourcePort).toEqual({ x: 105, y: 55, side: "right" });
  pointer(element, "pointerup", 10, 40);
});

test("an edge without ports, or naming a port not there, has no anchor for that end", () => {
  const { canvas, draws } = board();
  canvas.setEdges([edge({ targetPort: "missing" })]);
  expect(Object.keys(draws.at(-1)!).sort()).toEqual(["source", "target"]);
});

test("a port moved by a re-render or a resize of its node redraws its edges", async () => {
  const { canvas, layout, draws, port } = board();
  canvas.setEdges([edge({ sourcePort: "out" })]);
  const before = draws.length;

  layout.place(port("a", "out"), { x: 95, y: 30 });
  port("a", "out").setAttribute("class", "busy");
  await Promise.resolve();
  expect(draws.length).toBe(before + 1);
  expect(draws.at(-1)!.sourcePort).toEqual({ x: 105, y: 35, side: "right" });

  layout.place(port("a", "out"), { x: 135, y: 30 });
  layout.resize("a", { width: 140, height: 50 });
  expect(draws.at(-1)!.sourcePort).toEqual({ x: 145, y: 35, side: "right" });
});

test("a click on an edge or its label reports the edge, not the pane; a drag on one pans", () => {
  const onEdgeClick = vi.fn();
  const onPaneClick = vi.fn();
  const { root, canvas } = setup<undefined, string>({
    viewport: { x: 0, y: 0, zoom: 1 },
    onEdgeClick,
    onPaneClick,
    mountEdge(path, label) {
      path.innerHTML = `<path d="M0,0L300,0"></path><circle class="nopan"></circle>`;
      label.textContent = "tag";
      return { draw() {} };
    },
  });
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  const current = edge({ data: "current" });
  canvas.setEdges([edge()]);
  canvas.setEdges([current]);
  const line = root.querySelector(".app-canvas__edge path")!;

  pointer(line, "pointerdown", 150, 0);
  pointer(line, "pointerup", 150, 0);
  expect(onEdgeClick).toHaveBeenCalledWith(current, expect.any(PointerEvent));
  pointer(root.querySelector(".app-canvas__label")!, "pointerdown", 150, 0);
  pointer(root.querySelector(".app-canvas__label")!, "pointerup", 150, 0);
  expect(onEdgeClick).toHaveBeenCalledTimes(2);

  pointer(line, "pointerdown", 150, 0);
  pointer(line, "pointermove", 180, 0);
  pointer(line, "pointerup", 180, 0);
  expect(canvas.getViewport().x).toBe(30);
  pointer(root.querySelector(".app-canvas__edge circle")!, "pointerdown", 150, 0);
  pointer(root.querySelector(".app-canvas__edge circle")!, "pointerup", 150, 0);
  expect(onEdgeClick).toHaveBeenCalledTimes(2);
  expect(onPaneClick).not.toHaveBeenCalled();
});

test("without onEdgeClick, a click on an edge is a pane click", () => {
  const onPaneClick = vi.fn();
  const { root, canvas } = setup<undefined, string>({
    viewport: { x: 0, y: 0, zoom: 1 },
    onPaneClick,
    mountEdge: () => ({ draw() {} }),
  });
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  canvas.setEdges([edge()]);
  const group = root.querySelector(".app-canvas__edge")!;
  pointer(group, "pointerdown", 150, 0);
  pointer(group, "pointerup", 150, 0);
  expect(onPaneClick).toHaveBeenCalledOnce();
});
