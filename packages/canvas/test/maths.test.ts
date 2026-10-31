// @vitest-environment node
import { expect, test } from "vitest";

import { floatingAnchors } from "../src/anchors";
import { between, boundsOf, fitBounds, toCanvas, visibleRect, wheelFactor, zoomTo } from "../src/viewport";

const limits = { minZoom: 0.2, maxZoom: 2.5 };

test("zooming keeps the point it zooms about where it is on screen", () => {
  const before = { x: 40, y: -20, zoom: 1 };
  const about = { x: 300, y: 200 };
  const after = zoomTo(before, 2, about, limits);
  expect(after.zoom).toBe(2);
  expect(toCanvas(after, about)).toEqual(toCanvas(before, about));
});

test("zoom is held between the limits", () => {
  expect(zoomTo({ x: 0, y: 0, zoom: 1 }, 10, { x: 0, y: 0 }, limits).zoom).toBe(2.5);
  expect(zoomTo({ x: 0, y: 0, zoom: 1 }, 0.01, { x: 0, y: 0 }, limits).zoom).toBe(0.2);
});

test("the visible rectangle is the canvas area under the element", () => {
  expect(visibleRect({ x: -100, y: 50, zoom: 2 }, { width: 800, height: 600 })).toEqual({ x: 50, y: -25, width: 400, height: 300 });
});

test("bounds hold every rectangle, and there are none of nothing", () => {
  expect(boundsOf([])).toBeUndefined();
  expect(
    boundsOf([
      { x: 0, y: 10, width: 100, height: 50 },
      { x: -50, y: 100, width: 20, height: 20 },
    ]),
  ).toEqual({ x: -50, y: 10, width: 150, height: 110 });
});

test("fitting centres the bounds, leaves the padding, and stops at the maximum zoom", () => {
  const size = { width: 800, height: 600 };
  const fitted = fitBounds({ x: 0, y: 0, width: 400, height: 100 }, size, 0, limits);
  expect(fitted).toEqual({ x: 0, y: 200, zoom: 2 });
  expect(fitBounds({ x: 0, y: 0, width: 400, height: 100 }, size, 1, limits).zoom).toBe(1);
  const one = fitBounds({ x: 10, y: 10, width: 10, height: 10 }, size, 0.2, { ...limits, maxZoom: 1.2 });
  expect(one.zoom).toBe(1.2);
  expect(toCanvas(one, { x: 400, y: 300 })).toEqual({ x: 15, y: 15 });
});

test("between eases from one viewport to the other", () => {
  const from = { x: 0, y: 0, zoom: 1 };
  const to = { x: 100, y: -100, zoom: 2 };
  expect(between(from, to, 0)).toEqual(from);
  expect(between(from, to, 0.5)).toEqual({ x: 50, y: -50, zoom: 1.5 });
  expect(between(from, to, 1)).toEqual(to);
});

test("a wheel down zooms out and up zooms in, and a pinch's small deltas count for more", () => {
  expect(wheelFactor(100, 0, false)).toBeLessThan(1);
  expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1);
  expect(wheelFactor(-5, 0, true)).toBeCloseTo(wheelFactor(-50, 0, false));
});

test("floating anchors sit where the centre line leaves each rectangle, on the side it leaves by", () => {
  const left = { x: 0, y: 0, width: 100, height: 50 };
  const right = { x: 300, y: 0, width: 100, height: 50 };
  expect(floatingAnchors(left, right)).toEqual({
    source: { x: 100, y: 25, side: "right" },
    target: { x: 300, y: 25, side: "left" },
  });

  const below = { x: 0, y: 300, width: 100, height: 50 };
  expect(floatingAnchors(left, below)).toEqual({
    source: { x: 50, y: 50, side: "bottom" },
    target: { x: 50, y: 300, side: "top" },
  });

  const diagonal = floatingAnchors({ x: 0, y: 0, width: 100, height: 100 }, { x: 200, y: 100, width: 100, height: 100 });
  expect(diagonal.source).toEqual({ x: 100, y: 75, side: "right" });
  expect(diagonal.target).toEqual({ x: 200, y: 125, side: "left" });
});

test("rectangles sharing a centre anchor there rather than at NaN", () => {
  const rect = { x: 0, y: 0, width: 100, height: 50 };
  const { source } = floatingAnchors(rect, rect);
  expect(source).toEqual({ x: 50, y: 25, side: "right" });
});

test("an empty rectangle's anchor stays on the line between the centres", () => {
  const point = { x: 10, y: 10, width: 0, height: 0 };
  expect(floatingAnchors(point, { ...point, x: 100 }).source).toMatchObject({ y: 10, side: "right" });
});
