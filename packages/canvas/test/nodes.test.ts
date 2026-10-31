import { expect, test, vi } from "vitest";

import { drag, node, pointer, setup } from "./harness";

const at = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`.app-canvas__node[data-id="${id}"]`)!;

test("only the nodes in view, with a margin, are mounted, and panning mounts and unmounts them", async () => {
  const { canvas, mounted } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  canvas.setNodes([node("near", 100, 100), node("edge", 900, 100), node("far", 5000, 100)]);
  expect([...mounted.keys()].sort()).toEqual(["edge", "near"]);

  await canvas.setViewport({ x: -4800, y: 0, zoom: 1 });
  expect([...mounted.keys()]).toEqual(["far"]);
});

test("a node is placed at its position, carries its class, and keeps its element when it changes", () => {
  const mount = vi.fn(() => () => {});
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, mount });
  const first = node("a", 10, 20, { className: "hl" });
  canvas.setNodes([first]);
  const element = at(root, "a");
  expect(element.style.transform).toBe("translate(10px, 20px)");
  expect(element.className).toBe("app-canvas__node hl");

  canvas.setNodes([first]);
  canvas.setNodes([node("a", 30, 40, { className: "dim" })]);
  expect(at(root, "a")).toBe(element);
  expect(element.style.transform).toBe("translate(30px, 40px)");
  expect(element.className).toBe("app-canvas__node dim");
  expect(mount).toHaveBeenCalledOnce();
});

test("a removed node is taken down", () => {
  const dispose = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, mount: () => dispose });
  canvas.setNodes([node("a", 0, 0)]);
  canvas.setNodes([]);
  expect(dispose).toHaveBeenCalledOnce();
  expect(at(root, "a")).toBeNull();
  expect(canvas.getNode("a")).toBeUndefined();
});

test("sizes come from measurement, are reported, and outlive the node scrolling out of view", async () => {
  const onNodeMeasured = vi.fn();
  const { canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, onNodeMeasured });
  canvas.setNodes([node("a", 0, 0)]);
  expect(canvas.getNode("a")?.size).toBeUndefined();
  layout.settle();
  expect(canvas.getNode("a")).toMatchObject({ id: "a", x: 0, y: 0, size: { width: 100, height: 50 } });

  layout.resize("a", { width: 140, height: 70 });
  expect(onNodeMeasured).toHaveBeenLastCalledWith(expect.objectContaining({ id: "a" }), { width: 140, height: 70 });
  layout.resize("a", { width: 140, height: 70 });
  expect(onNodeMeasured).toHaveBeenCalledTimes(2);

  await canvas.setViewport({ x: -9000, y: 0, zoom: 1 });
  expect(layout.observed.size).toBe(1);
  expect(canvas.getNodes()).toEqual([expect.objectContaining({ id: "a", size: { width: 140, height: 70 } })]);
});

test("dragging a node reports where it is as it goes and once where it settles, in canvas units", () => {
  const onNodeDrag = vi.fn();
  const onNodeDragEnd = vi.fn();
  const onNodeClick = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 2 }, onNodeDrag, onNodeDragEnd, onNodeClick });
  canvas.setNodes([node("a", 10, 10)]);
  const element = at(root, "a");
  pointer(element, "pointerdown", 30, 30);
  pointer(element, "pointermove", 70, 50);
  expect(element.classList.contains("is-dragging")).toBe(true);
  expect(onNodeDrag).toHaveBeenLastCalledWith(expect.objectContaining({ id: "a" }), { x: 30, y: 20 });
  pointer(element, "pointermove", 130, 30);
  pointer(element, "pointerup", 130, 30);
  expect(onNodeDragEnd).toHaveBeenCalledOnce();
  expect(onNodeDragEnd).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), { x: 60, y: 10 });
  expect(element.classList.contains("is-dragging")).toBe(false);
  expect(element.style.transform).toBe("translate(60px, 10px)");
  expect(canvas.getViewport()).toEqual({ x: 0, y: 0, zoom: 2 });
  expect(onNodeClick).not.toHaveBeenCalled();
});

test("the consumer's nodes don't move a node while it is dragged", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  canvas.setNodes([node("a", 0, 0)]);
  const element = at(root, "a");
  pointer(element, "pointerdown", 10, 10);
  pointer(element, "pointermove", 60, 10);
  canvas.setNodes([node("a", 0, 0, { className: "hl" })]);
  expect(element.style.transform).toBe("translate(50px, 0px)");
  expect(element.className).toBe("app-canvas__node hl is-dragging");
  pointer(element, "pointerup", 60, 10);
  expect(canvas.getNode("a")).toMatchObject({ x: 50, y: 0 });
});

test("a dragged node stays mounted when it is dragged out of view", () => {
  const { root, canvas, mounted } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  canvas.setNodes([node("a", 0, 0)]);
  const element = at(root, "a");
  pointer(element, "pointerdown", 10, 10);
  pointer(element, "pointermove", 3000, 10);
  expect(mounted.has("a")).toBe(true);
  pointer(element, "pointerup", 3000, 10);
  expect(mounted.has("a")).toBe(false);
});

test("a press and release on a node is a click, and hover is reported", () => {
  const onNodeClick = vi.fn();
  const onNodeEnter = vi.fn();
  const onNodeLeave = vi.fn();
  const onPaneClick = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, onNodeClick, onNodeEnter, onNodeLeave, onPaneClick });
  canvas.setNodes([node("a", 0, 0, { data: "first" as never })]);
  const element = at(root, "a");
  drag(element, [5, 5], 1, 0);
  expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), expect.any(PointerEvent));
  expect(onPaneClick).not.toHaveBeenCalled();

  canvas.setNodes([node("a", 0, 0, { data: "second" as never })]);
  element.dispatchEvent(new PointerEvent("pointerenter"));
  element.dispatchEvent(new PointerEvent("pointerleave"));
  expect(onNodeEnter).toHaveBeenCalledWith(expect.objectContaining({ data: "second" }));
  expect(onNodeLeave).toHaveBeenCalledOnce();
});

test("a nopan element inside a node starts neither a drag nor a click", () => {
  const onNodeClick = vi.fn();
  const onNodeDrag = vi.fn();
  const { root, canvas } = setup({
    viewport: { x: 0, y: 0, zoom: 1 },
    onNodeClick,
    onNodeDrag,
    mount(element) {
      element.innerHTML = `<input class="nopan">`;
      return () => {};
    },
  });
  canvas.setNodes([node("a", 0, 0)]);
  drag(at(root, "a").querySelector("input")!, [5, 5], 40, 0);
  drag(at(root, "a").querySelector("input")!, [5, 5], 0, 0);
  expect(onNodeDrag).not.toHaveBeenCalled();
  expect(onNodeClick).not.toHaveBeenCalled();
  expect(canvas.getNode("a")).toMatchObject({ x: 0, y: 0 });
});

test("destroy takes down every node and what the canvas added", () => {
  const dispose = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, controls: true, mount: () => dispose });
  const own = root.appendChild(document.createElement("aside"));
  canvas.setNodes([node("a", 0, 0), node("b", 10, 0)]);
  canvas.destroy();
  expect(dispose).toHaveBeenCalledTimes(2);
  expect([...root.children]).toEqual([own]);
  expect(root.className).toBe("");
});

test("a node re-shown after scrolling out of view keeps its place in the stacking order, and drops land on the top one", async () => {
  const onConnect = vi.fn();
  const { root, canvas, layout } = setup({
    viewport: { x: 0, y: 0, zoom: 1 },
    onConnect,
    mount(element, mounted) {
      element.innerHTML = mounted.id === "c" ? `<span class="canvas-source"></span>` : "";
      return () => {};
    },
  });
  canvas.setNodes([node("a", 0, 0), node("b", 900, 0), node("c", 900, 300)]);
  await canvas.setViewport({ x: -1000, y: 0, zoom: 1 });
  await canvas.setViewport({ x: 0, y: 0, zoom: 1 });
  const order = () => [...root.querySelectorAll<HTMLElement>(".app-canvas__node")].map((e) => e.dataset.id);
  expect(order()).toEqual(["a", "b", "c"]);

  canvas.setNodes([node("a", 0, 0), node("b", 0, 0), node("c", 900, 300)]);
  layout.settle();
  const handle = root.querySelector(".canvas-source")!;
  pointer(handle, "pointerdown", 905, 305);
  pointer(handle, "pointerup", 10, 10);
  expect(onConnect).toHaveBeenCalledWith("c", "b");
});

test("a release the content stops from bubbling still ends the drag", () => {
  const onNodeDragEnd = vi.fn();
  const { root, canvas } = setup({
    viewport: { x: 0, y: 0, zoom: 1 },
    onNodeDragEnd,
    mount(element) {
      element.innerHTML = `<span class="grip"></span>`;
      element.firstElementChild!.addEventListener("pointerup", (event) => event.stopPropagation());
      return () => {};
    },
  });
  canvas.setNodes([node("a", 0, 0)]);
  drag(at(root, "a").querySelector(".grip")!, [10, 10], 40, 0);
  expect(onNodeDragEnd).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), { x: 40, y: 0 });
  expect(at(root, "a").classList.contains("is-dragging")).toBe(false);
});

test("a move with no button held ends a drag whose release was missed", () => {
  const onNodeDragEnd = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, onNodeDragEnd });
  canvas.setNodes([node("a", 0, 0)]);
  const element = at(root, "a");
  pointer(element, "pointerdown", 10, 10);
  pointer(element, "pointermove", 50, 10);
  pointer(element, "pointermove", 90, 10, { buttons: 0 });
  expect(onNodeDragEnd).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), { x: 40, y: 0 });
  pointer(element, "pointermove", 120, 10);
  expect(canvas.getNode("a")).toMatchObject({ x: 40, y: 0 });
});

test("a touch whose node is removed mid-drag leaves no pointer behind to spoil the next pinch", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  const touch = (target: Element, type: string, pointerId: number, x: number) =>
    pointer(target, type, x, 300, { pointerId, pointerType: "touch" });
  canvas.setNodes([node("a", 0, 280)]);
  touch(at(root, "a"), "pointerdown", 1, 10);
  touch(at(root, "a"), "pointermove", 1, 40);
  canvas.setNodes([]);
  touch(root, "pointerdown", 2, 300);
  touch(root, "pointerdown", 3, 400);
  touch(root, "pointermove", 3, 500);
  expect(canvas.getViewport().zoom).toBe(2);
});

test("a native drag starting inside a node is prevented, and one inside a nopan element is not", () => {
  const { root, canvas } = setup({
    viewport: { x: 0, y: 0, zoom: 1 },
    mount(element) {
      element.innerHTML = `<img><a class="nopan" href="#">link</a>`;
      return () => {};
    },
  });
  canvas.setNodes([node("a", 0, 0)]);
  const dragStart = (target: Element) => {
    const event = new Event("dragstart", { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(dragStart(at(root, "a").querySelector("img")!)).toBe(true);
  expect(dragStart(at(root, "a").querySelector("a")!)).toBe(false);
});

test("a hovered node that is culled or removed is reported as left", async () => {
  const onNodeLeave = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, onNodeLeave });
  canvas.setNodes([node("a", 0, 0), node("b", 100, 0)]);
  at(root, "a").dispatchEvent(new PointerEvent("pointerenter"));
  await canvas.setViewport({ x: -9000, y: 0, zoom: 1 });
  expect(onNodeLeave).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  await canvas.setViewport({ x: 0, y: 0, zoom: 1 });
  at(root, "b").dispatchEvent(new PointerEvent("pointerenter"));
  canvas.setNodes([node("a", 0, 0)]);
  expect(onNodeLeave).toHaveBeenLastCalledWith(expect.objectContaining({ id: "b" }));
  expect(onNodeLeave).toHaveBeenCalledTimes(2);
});

test("a node not yet measured is mounted when its assumed size reaches into view", () => {
  const { mounted, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  canvas.setNodes([node("wide", -300, 0)]);
  expect(mounted.has("wide")).toBe(true);
});
