import { expect, test, vi } from "vitest";

import { node, pointer, setup } from "./harness";

test("the dot background follows the camera, scaling its gap and dots", async () => {
  const { root, canvas } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, background: { gap: 28, size: 1.5 } });
  const dots = root.querySelector<HTMLElement>(".app-canvas__background")!;
  expect(dots.style.backgroundSize).toBe("28px 28px");
  await canvas.setViewport({ x: 7, y: -3, zoom: 2 });
  expect(dots.style.backgroundSize).toBe("56px 56px");
  expect(dots.style.backgroundPosition).toBe("7px -3px");
  expect(dots.style.getPropertyValue("--canvas-dot-radius")).toBe("1.5px");
});

test("the controls zoom in and out about the centre, and fit", async () => {
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, controls: true, maxZoom: 2.5 });
  canvas.setNodes([node("a", 0, 0)]);
  layout.settle();
  const press = (label: string) => root.querySelector<HTMLButtonElement>(`.app-canvas__controls [aria-label="${label}"]`)!.click();
  const centre = canvas.screenToCanvas({ x: 400, y: 300 });
  press("Zoom in");
  layout.advance(300);
  expect(canvas.getViewport().zoom).toBeCloseTo(1.2);
  expect(canvas.screenToCanvas({ x: 400, y: 300 }).x).toBeCloseTo(centre.x);
  press("Zoom out");
  layout.advance(300);
  expect(canvas.getViewport().zoom).toBeCloseTo(1);
  press("Fit view");
  layout.advance(300);
  expect(canvas.getViewport().zoom).toBe(2.5);
});

test("the Fit control and a fitView given no padding use fitPadding", async () => {
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, controls: true, fitPadding: 1, maxZoom: 10 });
  canvas.setNodes([node("a", 0, 0)]);
  layout.settle();
  root.querySelector<HTMLButtonElement>('.app-canvas__controls [aria-label="Fit view"]')!.click();
  layout.advance(300);
  expect(canvas.getViewport().zoom).toBe(4);
  await canvas.setViewport({ x: 0, y: 0, zoom: 1 });
  await canvas.fitView();
  expect(canvas.getViewport().zoom).toBe(4);
});

test("a press on the controls is not a pane click", () => {
  const onPaneClick = vi.fn();
  const { root } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, controls: true, onPaneClick });
  const button = root.querySelector(".app-canvas__control")!;
  pointer(button, "pointerdown", 0, 0);
  pointer(button, "pointerup", 0, 0);
  expect(onPaneClick).not.toHaveBeenCalled();
});

test("the minimap draws every node in its colour, masks what is out of view, and frames both", () => {
  const { root, canvas, layout } = setup<string>({
    viewport: { x: 0, y: 0, zoom: 1 },
    minimap: { nodeColour: (n) => `var(--cluster-${n.data})` },
  });
  canvas.setNodes([node("a", 0, 0, { data: "one" }), node("far", 5000, 0, { data: "two" })]);
  layout.settle();
  const rects = [...root.querySelectorAll<SVGRectElement>(".app-canvas__minimap-node")];
  expect(rects.map((r) => [r.getAttribute("x"), r.getAttribute("width"), r.style.fill])).toEqual([
    ["0", "100", "var(--cluster-one)"],
    ["5000", "200", "var(--cluster-two)"],
  ]);
  const view = root.querySelector(".app-canvas__minimap-view")!;
  expect(["x", "y", "width", "height"].map((name) => view.getAttribute(name))).toEqual(["0", "0", "800", "600"]);
  const [x, y, width, height] = root.querySelector(".app-canvas__minimap-map")!.getAttribute("viewBox")!.split(" ").map(Number);
  expect(x).toBeLessThanOrEqual(0);
  expect(x! + width!).toBeGreaterThanOrEqual(5000);
  expect(width! / height!).toBeCloseTo(200 / 150);
  expect(y).toBeLessThan(0);
  expect(root.querySelector(".app-canvas__minimap-mask")!.getAttribute("d")).toContain("M0,0h800v600h-800z");
});

test("dragging in the minimap moves the view with the pointer, and its wheel zooms", () => {
  vi.useFakeTimers();
  const onMoveEnd = vi.fn();
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, minimap: {}, onMoveEnd });
  canvas.setNodes([node("a", 0, 0)]);
  layout.settle();
  const map = root.querySelector(".app-canvas__minimap")!;
  const width = Number(root.querySelector(".app-canvas__minimap-map")!.getAttribute("viewBox")!.split(" ")[2]);
  pointer(map, "pointerdown", 10, 10);
  pointer(map, "pointermove", 20, 10);
  expect(canvas.getViewport().x).toBeCloseTo((-10 * width) / 200);
  pointer(map, "pointerup", 20, 10);
  expect(onMoveEnd).toHaveBeenCalledOnce();

  map.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 }));
  expect(canvas.getViewport().zoom).toBeGreaterThan(1);
  vi.advanceTimersByTime(150);
  expect(onMoveEnd).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});

test("two quick zoom-in presses each take a full step", () => {
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, controls: true, maxZoom: 2.5 });
  const zoomIn = root.querySelector<HTMLButtonElement>('.app-canvas__controls [aria-label="Zoom in"]')!;
  zoomIn.click();
  layout.advance(32);
  zoomIn.click();
  layout.advance(300);
  expect(canvas.getViewport().zoom).toBeCloseTo(1.44);
});

test("a click on the minimap that does not move it reports no move", () => {
  const onMoveEnd = vi.fn();
  const { root } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, minimap: {}, onMoveEnd });
  const map = root.querySelector(".app-canvas__minimap")!;
  pointer(map, "pointerdown", 10, 10);
  pointer(map, "pointerup", 10, 10);
  expect(onMoveEnd).not.toHaveBeenCalled();
});

test("the minimap keeps its scale while it is dragged, then reframes", () => {
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, minimap: {} });
  canvas.setNodes([node("a", 0, 0)]);
  layout.settle();
  const map = root.querySelector(".app-canvas__minimap")!;
  const viewBox = () => root.querySelector(".app-canvas__minimap-map")!.getAttribute("viewBox");
  const before = viewBox();
  pointer(map, "pointerdown", 10, 10);
  pointer(map, "pointermove", 20, 10);
  const first = canvas.getViewport().x;
  pointer(map, "pointermove", 30, 10);
  expect(canvas.getViewport().x).toBeCloseTo(2 * first);
  expect(viewBox()).toBe(before);
  pointer(map, "pointerup", 30, 10);
  expect(viewBox()).not.toBe(before);
});

test("a minimap drag follows only its own pointer, and ends on a move with no button held", () => {
  const onMoveEnd = vi.fn();
  const { root, canvas, layout } = setup({ viewport: { x: 0, y: 0, zoom: 1 }, minimap: {}, onMoveEnd });
  canvas.setNodes([node("a", 0, 0)]);
  layout.settle();
  const map = root.querySelector(".app-canvas__minimap")!;
  pointer(map, "pointerdown", 10, 10);
  pointer(map, "pointermove", 20, 10, { pointerId: 2 });
  expect(canvas.getViewport().x).toBe(0);
  pointer(map, "pointermove", 20, 10);
  const moved = canvas.getViewport();
  pointer(document.body, "pointermove", 30, 10, { buttons: 0 });
  expect(onMoveEnd).toHaveBeenCalledOnce();
  pointer(document.body, "pointermove", 40, 10);
  expect(canvas.getViewport()).toEqual(moved);
});
