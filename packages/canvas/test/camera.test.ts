import { expect, test, vi } from "vitest";

import { drag, fakeLayout, node, pointer, setup, transform } from "./harness";

test("the pane wears the viewport given at mount", () => {
  const { root, canvas } = setup({ viewport: { x: 10, y: 20, zoom: 1.5 } });
  expect(transform(root)).toBe("translate(10px, 20px) scale(1.5)");
  expect(canvas.getViewport()).toEqual({ x: 10, y: 20, zoom: 1.5 });
});

test("without a viewport the camera fits the first nodes, and again once they are measured, without reporting a move", () => {
  const onMoveEnd = vi.fn();
  const { canvas, layout } = setup({ onMoveEnd, maxZoom: 10, unmeasuredSize: { width: 100, height: 50 } });
  canvas.setNodes([node("a", 0, 0), node("b", 300, 0)]);
  expect(canvas.getViewport().zoom).toBeCloseTo(800 / (400 * 1.1));

  layout.resize("b", { width: 500, height: 50 });
  expect(canvas.getViewport().zoom).toBeCloseTo(800 / (800 * 1.1));
  layout.resize("a", { width: 100, height: 1000 });
  expect(canvas.getViewport().zoom).toBeCloseTo(800 / (800 * 1.1));
  expect(onMoveEnd).not.toHaveBeenCalled();
});

test("the mount fit is dropped once the camera has been moved", () => {
  const { root, canvas, layout } = setup();
  canvas.setNodes([node("a", 0, 0)]);
  drag(root, [100, 100], 50, 0);
  const moved = canvas.getViewport();
  layout.resize("a", { width: 300, height: 300 });
  expect(canvas.getViewport()).toEqual(moved);
});

test("dragging the empty pane pans, reports the move once, and is not a pane click", () => {
  const onMoveEnd = vi.fn();
  const onPaneClick = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 2 }, onMoveEnd, onPaneClick });
  drag(root, [100, 100], 40, -30);
  expect(canvas.getViewport()).toEqual({ x: 40, y: -30, zoom: 2 });
  expect(onMoveEnd).toHaveBeenCalledOnce();
  expect(onMoveEnd).toHaveBeenCalledWith({ x: 40, y: -30, zoom: 2 });
  expect(onPaneClick).not.toHaveBeenCalled();
});

test("a press and release on the pane without moving is a pane click", () => {
  const onPaneClick = vi.fn();
  const onMoveEnd = vi.fn();
  const { root } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, onPaneClick, onMoveEnd });
  drag(root, [100, 100], 1, 1);
  expect(onPaneClick).toHaveBeenCalledOnce();
  expect(onMoveEnd).not.toHaveBeenCalled();
});

test("the wheel zooms about the pointer within the limits, and the move is reported once it rests", () => {
  vi.useFakeTimers();
  const onMoveEnd = vi.fn();
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, maxZoom: 2.5, onMoveEnd });
  const wheel = (deltaY: number, ctrlKey = false) =>
    root.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: 200, clientY: 100, deltaY, ctrlKey }));
  const under = canvas.screenToCanvas({ x: 200, y: 100 });
  wheel(-100);
  expect(canvas.getViewport().zoom).toBeGreaterThan(1);
  expect(canvas.screenToCanvas({ x: 200, y: 100 })).toEqual(under);
  for (let i = 0; i < 20; i++) wheel(-100, true);
  expect(canvas.getViewport().zoom).toBe(2.5);
  expect(onMoveEnd).not.toHaveBeenCalled();
  vi.advanceTimersByTime(150);
  expect(onMoveEnd).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

test("nopan and nowheel elements neither pan nor zoom", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  const still = root.appendChild(document.createElement("div"));
  still.className = "nopan nowheel";
  const inner = still.appendChild(document.createElement("span"));
  drag(inner, [100, 100], 50, 50);
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 });
  inner.dispatchEvent(event);
  expect(canvas.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(event.defaultPrevented).toBe(false);
});

test("two touches pinch: the zoom follows their spread about their midpoint", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  const touch = (type: string, pointerId: number, x: number) => pointer(root, type, x, 100, { pointerId, pointerType: "touch" });
  const under = canvas.screenToCanvas({ x: 200, y: 100 });
  touch("pointerdown", 1, 150);
  touch("pointerdown", 2, 250);
  touch("pointermove", 1, 100);
  touch("pointermove", 2, 300);
  expect(canvas.getViewport().zoom).toBe(2);
  expect(canvas.screenToCanvas({ x: 200, y: 100 })).toEqual(under);
  touch("pointerup", 1, 100);
  touch("pointerup", 2, 300);
});

test("a WebKit gesture pinch zooms by its scale", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  const gesture = (type: string, scale: number) =>
    root.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }), { scale }));
  gesture("gesturestart", 1);
  gesture("gesturechange", 1.5);
  expect(canvas.getViewport().zoom).toBe(1.5);
  gesture("gestureend", 1.5);
});

test("fitView animates to frame the chosen nodes, honouring maxZoom, and resolves when it lands", async () => {
  const onMoveEnd = vi.fn();
  const { canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, maxZoom: 2.5, onMoveEnd });
  canvas.setNodes([node("a", 0, 0), node("b", 1000, 1000)]);
  layout.settle();
  let landed = false;
  void canvas.fitView({ ids: ["a"], padding: 0.2, maxZoom: 1.2, duration: 400 }).then(() => (landed = true));
  layout.advance(200);
  expect(canvas.getViewport().zoom).toBeGreaterThan(1);
  expect(canvas.getViewport().zoom).toBeLessThan(1.2);
  expect(onMoveEnd).not.toHaveBeenCalled();
  layout.advance(400);
  await Promise.resolve();
  expect(landed).toBe(true);
  expect(canvas.getViewport()).toEqual({ x: 400 - 50 * 1.2, y: 300 - 25 * 1.2, zoom: 1.2 });
  expect(onMoveEnd).toHaveBeenCalledOnce();
});

test("fitView over ids none of which are on the canvas leaves the camera where it is", async () => {
  const onMoveEnd = vi.fn();
  const { canvas } = setup({ viewport: { x: 5, y: 6, zoom: 1 }, onMoveEnd });
  canvas.setNodes([node("a", 0, 0)]);
  await canvas.fitView({ ids: ["gone"], duration: 0 });
  await canvas.fitView({ ids: [] });
  expect(canvas.getViewport()).toEqual({ x: 5, y: 6, zoom: 1 });
  expect(onMoveEnd).not.toHaveBeenCalled();
});

test("setCentre puts a canvas point in the middle, and setViewport goes straight there", async () => {
  const { canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, maxZoom: 2.5 });
  await canvas.setCentre(100, 50, { zoom: 2 });
  expect(canvas.getViewport()).toEqual({ x: 200, y: 200, zoom: 2 });
  await canvas.setCentre(0, 0, { zoom: 9 });
  expect(canvas.getViewport().zoom).toBe(2.5);
  await canvas.setViewport({ x: 1, y: 2, zoom: 0.5 });
  expect(canvas.getViewport()).toEqual({ x: 1, y: 2, zoom: 0.5 });
});

test("a new move interrupts an animation, and a press on the pane stops one", async () => {
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  const first = canvas.setViewport({ x: 500, y: 0, zoom: 1 }, { duration: 300 });
  layout.advance(32);
  void canvas.setViewport({ x: -500, y: 0, zoom: 1 }, { duration: 300 });
  layout.advance(400);
  await first;
  expect(canvas.getViewport().x).toBe(-500);

  void canvas.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  layout.advance(32);
  pointer(root, "pointerdown", 10, 10);
  const held = canvas.getViewport();
  layout.advance(400);
  expect(canvas.getViewport()).toEqual(held);
});

test("screenToCanvas undoes the camera", () => {
  const { canvas } = setup({ viewport: { x: 100, y: 50, zoom: 2 } });
  expect(canvas.screenToCanvas({ x: 300, y: 250 })).toEqual({ x: 100, y: 100 });
});

test("a canvas mounted before it has a size fits once it gets one", () => {
  const layout = fakeLayout({ width: 0, height: 0 });
  const { root, canvas } = setup({}, layout);
  canvas.setNodes([node("a", 0, 0)]);
  expect(canvas.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 });
  layout.resize(root, { width: 800, height: 600 });
  expect(canvas.getViewport().zoom).toBe(2);
});

test("the viewport at mount and every move are held between the zoom limits, zero included", async () => {
  const { canvas } = setup({ viewport: { x: 0, y: 0, zoom: 0 }, minZoom: 0.5, maxZoom: 2 });
  expect(canvas.getViewport().zoom).toBe(0.5);
  expect(canvas.screenToCanvas({ x: 100, y: 100 })).toEqual({ x: 200, y: 200 });
  await canvas.setViewport({ x: 0, y: 0, zoom: 9 });
  expect(canvas.getViewport().zoom).toBe(2);
});

test("a wheel zoom mid pane drag is kept by the drag's next step", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 } });
  pointer(root, "pointerdown", 100, 100);
  pointer(root, "pointermove", 150, 100);
  root.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: 150, clientY: 100, deltaY: -100 }));
  const zoomed = canvas.getViewport();
  pointer(root, "pointermove", 160, 100);
  expect(canvas.getViewport()).toEqual({ ...zoomed, x: zoomed.x + 10 });
  pointer(root, "pointerup", 160, 100);
});

test("a camera move mid node drag keeps the node under the pointer at the new zoom", () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, maxZoom: 2 });
  canvas.setNodes([node("a", 0, 0)]);
  const element = root.querySelector('[data-id="a"]')!;
  pointer(element, "pointerdown", 10, 10);
  pointer(element, "pointermove", 60, 10);
  void canvas.setViewport({ x: 0, y: 0, zoom: 2 });
  pointer(element, "pointermove", 70, 10);
  expect(canvas.getNode("a")).toMatchObject({ x: 55, y: 0 });
  pointer(element, "pointerup", 70, 10);
});

test("a wheel zoom waiting to settle reports before a later move takes the camera, and only then", async () => {
  vi.useFakeTimers();
  const onMoveEnd = vi.fn();
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, onMoveEnd });
  root.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: 0, clientY: 0, deltaY: -100 }));
  const zoomed = canvas.getViewport();
  void canvas.setViewport({ x: 300, y: 0, zoom: 1 }, { duration: 400 });
  expect(onMoveEnd.mock.calls).toEqual([[zoomed]]);
  layout.advance(100);
  vi.advanceTimersByTime(150);
  expect(onMoveEnd).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
