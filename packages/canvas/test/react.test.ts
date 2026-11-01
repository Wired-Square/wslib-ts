import type { CanvasEdge, CanvasHandle, CanvasNode } from "@wired-square/canvas/core";
import { Canvas, CanvasPanel, CanvasScope, useCanvas } from "@wired-square/canvas/react";
import type { CanvasProps } from "@wired-square/canvas/react";
import { StrictMode, act, createElement as h } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { fakeLayout, newRoot, pointer } from "./harness";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});

function render(view: ReactNode) {
  const element = newRoot();
  const root = createRoot(element);
  roots.push(root);
  act(() => root.render(view));
  return { element, update: (next: ReactNode) => act(() => root.render(next)), unmount: () => act(() => root.unmount()) };
}

type Card = { title: string };
const card = (id: string, x: number, title: string): CanvasNode<Card> => ({ id, x, y: 0, data: { title } });
const layout = () => {
  const fake = fakeLayout();
  return { fake, seams: { measure: fake.measure, offset: fake.offset, observe: fake.observe, frame: fake.frame } };
};
const board = (props: Partial<CanvasProps<Card, string>> & Pick<CanvasProps<Card, string>, "nodes">) =>
  h(Canvas<Card, string>, { viewport: { x: 0, y: 0, zoom: 1 }, node: (node) => h("p", { className: "face" }, node.data.title), ...props });

test("Canvas portals each node's content, updates it in place as its node changes, and draws edges with their geometry", () => {
  const { fake, seams } = layout();
  const edges: CanvasEdge<string>[] = [{ id: "ab", source: "a", target: "b", data: "knows" }];
  const view = (nodes: CanvasNode<Card>[]) =>
    board({
      ...seams,
      nodes,
      edges,
      edge: (_, { source, target }) => h("line", { className: "string", x1: source.x + source.width, x2: target.x }),
      edgeLabel: (edge) => h("span", null, edge.data),
    });
  const first = [card("a", 0, "First"), card("b", 300, "Second")];
  const { element, update } = render(view(first));
  act(() => fake.settle());
  const face = element.querySelector('[data-id="a"] .face')!;
  expect(face.textContent).toBe("First");
  update(view([card("a", 0, "Renamed"), first[1]!]));
  expect(element.querySelector('[data-id="a"] .face')).toBe(face);
  expect(face.textContent).toBe("Renamed");

  const line = element.querySelector(".app-canvas__edge line")!;
  expect(line).toBeInstanceOf(SVGElement);
  expect([line.getAttribute("x1"), line.getAttribute("x2")]).toEqual(["100", "300"]);
  update(view([first[0]!, card("b", 500, "Second")]));
  expect(line.getAttribute("x2")).toBe("500");
  expect(element.querySelector(".app-canvas__label")!.textContent).toBe("knows");
});

test("useCanvas beside the Canvas reaches its camera, and CanvasPanel sits in a corner", () => {
  const { seams } = layout();
  let beside: CanvasHandle | undefined;
  let inside: CanvasHandle | undefined;
  function Drawer() {
    beside = useCanvas();
    return h(CanvasPanel, { position: "bottom-left" }, "drawer");
  }
  function Inside() {
    inside = useCanvas();
    return null;
  }
  const { element } = render(h(CanvasScope, null, board({ ...seams, nodes: [], children: h(Inside) }), h(Drawer)));
  act(() => void beside!.setCentre(100, 100, { zoom: 2 }));
  expect(inside!.getViewport()).toEqual({ x: 200, y: 100, zoom: 2 });
  const panel = element.querySelector(".app-canvas-panel")!;
  expect(panel.getAttribute("data-position")).toBe("bottom-left");
  expect(panel.classList.contains("nopan")).toBe(true);
});

test("Canvas reads its callbacks when they fire without remounting, and takes everything down when it unmounts", () => {
  const { fake, seams } = layout();
  const first = vi.fn();
  const second = vi.fn();
  const nodes = [card("a", 0, "First")];
  const { element, update, unmount } = render(board({ ...seams, nodes, onNodeClick: first }));
  const node = element.querySelector('[data-id="a"]')!;
  update(board({ ...seams, nodes, onNodeClick: second }));
  expect(element.querySelector('[data-id="a"]')).toBe(node);
  act(() => {
    pointer(node, "pointerdown", 1, 1);
    pointer(node, "pointerup", 1, 1);
  });
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();

  unmount();
  expect(element.innerHTML).toBe("");
  expect(fake.observed.size).toBe(0);
});

test("ports, validation and edge clicks pass through, and an edge's geometry carries its port anchors", () => {
  const { fake, seams } = layout();
  const onConnect = vi.fn();
  const onEdgeClick = vi.fn();
  const isValidConnection = vi.fn(() => true);
  const edges: CanvasEdge<string>[] = [{ id: "ab", source: "a", target: "b", sourcePort: "out", targetPort: "in", data: "" }];
  const port = (node: CanvasNode<Card>) =>
    h("span", {
      "data-canvas-port": node.id === "a" ? "out" : "in",
      ref: (element: HTMLElement | null) => element && fake.place(element, node.id === "a" ? { x: 95, y: 20 } : { x: -5, y: 20 }),
    });
  const { element } = render(
    board({
      ...seams,
      nodes: [card("a", 0, "First"), card("b", 300, "Second")],
      edges,
      node: port,
      edge: (_, geometry) => h("path", { className: "wire", "data-from": geometry.sourcePort?.x, "data-to": geometry.targetPort?.x }),
      onConnect,
      isValidConnection,
      onEdgeClick,
    }),
  );
  act(() => fake.settle());
  const wire = element.querySelector(".wire")!;
  expect([wire.getAttribute("data-from"), wire.getAttribute("data-to")]).toEqual(["105", "295"]);

  const out = element.querySelector('[data-canvas-port="out"]')!;
  act(() => {
    pointer(out, "pointerdown", 100, 25);
    pointer(out, "pointerup", 297, 25);
    pointer(wire, "pointerdown", 200, 25);
    pointer(wire, "pointerup", 200, 25);
  });
  expect(isValidConnection).toHaveBeenCalledWith("a", "out", "b", "in");
  expect(onConnect).toHaveBeenCalledWith("a", "b", { sourcePort: "out", targetPort: "in" });
  expect(onEdgeClick).toHaveBeenCalledWith(edges[0], expect.any(PointerEvent));
});

test("port kinds and connectionRadius pass through: a drag from an in port dropped near an out port reports the out end first", () => {
  const { fake, seams } = layout();
  const onConnect = vi.fn();
  const port = (node: CanvasNode<Card>) =>
    h("span", {
      "data-canvas-port": node.id === "a" ? "out" : "in",
      "data-canvas-port-kind": node.id === "a" ? "out" : "in",
      ref: (element: HTMLElement | null) => element && fake.place(element, node.id === "a" ? { x: 95, y: 20 } : { x: -5, y: 20 }),
    });
  const { element } = render(
    board({ ...seams, nodes: [card("a", 0, "First"), card("b", 300, "Second")], node: port, connectionRadius: 20, onConnect }),
  );
  act(() => fake.settle());
  const input = element.querySelector('[data-canvas-port="in"]')!;
  act(() => {
    pointer(input, "pointerdown", 300, 25);
    pointer(input, "pointerup", 115, 25);
  });
  expect(onConnect).toHaveBeenCalledWith("a", "b", { sourcePort: "out", targetPort: "in" });
});

test("without a viewport, Canvas fits its nodes at mount with fitPadding", () => {
  const { fake, seams } = layout();
  const { element } = render(
    h(Canvas<Card, string>, { ...seams, fitPadding: 1, maxZoom: 10, nodes: [card("a", 0, "First")], node: (node) => node.data.title }),
  );
  act(() => fake.settle());
  expect(element.querySelector<HTMLElement>(".app-canvas__pane")!.style.transform).toBe("translate(200px, 200px) scale(4)");
});

test("useCanvas outside any canvas says what it needs", () => {
  function Lost() {
    useCanvas();
    return null;
  }
  const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(h(Lost))).toThrow("useCanvas needs a CanvasScope or a Canvas around it");
  quiet.mockRestore();
});

test("a node scrolled out of view and back shows its content once", async () => {
  const { seams } = layout();
  let canvas: CanvasHandle | undefined;
  function Inside() {
    canvas = useCanvas();
    return null;
  }
  const { element } = render(board({ ...seams, nodes: [card("a", 0, "First")], children: h(Inside) }));
  await act(() => canvas!.setViewport({ x: -9000, y: 0, zoom: 1 }));
  expect(element.querySelector('[data-id="a"]')).toBeNull();
  await act(() => canvas!.setViewport({ x: 0, y: 0, zoom: 1 }));
  expect(element.querySelectorAll('[data-id="a"] .face')).toHaveLength(1);
});

test("Canvas wears the app's class and style beside its own classes, and a blank class adds none", () => {
  const { seams } = layout();
  const view = (className: string) => board({ ...seams, nodes: [], className, style: { height: "300px" } });
  const { element, update } = render(view("board tall"));
  const canvas = element.querySelector<HTMLElement>(".app-canvas")!;
  expect([...canvas.classList].sort()).toEqual(["app-canvas", "board", "tall"]);
  expect(canvas.style.height).toBe("300px");
  update(view("board"));
  expect([...canvas.classList].sort()).toEqual(["app-canvas", "board"]);
  update(view(" "));
  expect([...canvas.classList]).toEqual(["app-canvas"]);
  expect(canvas.querySelector(".app-canvas__pane")).not.toBeNull();
});

test("under StrictMode's double mount, each node's content shows once and the canvas still answers", () => {
  const { fake, seams } = layout();
  const onNodeClick = vi.fn();
  const { element } = render(h(StrictMode, null, board({ ...seams, nodes: [card("a", 0, "First")], onNodeClick })));
  act(() => fake.settle());
  expect(element.querySelectorAll(".app-canvas__pane")).toHaveLength(1);
  expect(element.querySelectorAll('[data-id="a"] .face')).toHaveLength(1);
  const node = element.querySelector('[data-id="a"]')!;
  act(() => {
    pointer(node, "pointerdown", 1, 1);
    pointer(node, "pointerup", 1, 1);
  });
  expect(onNodeClick).toHaveBeenCalledOnce();
});
