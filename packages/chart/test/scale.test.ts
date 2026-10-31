import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { areaPath, extent, linePath, runs, scale, timeTicks, valueAt, valueTicks, visible } from "../src/scale.ts";
import type { Point } from "../src/index.ts";

// A half-hour offset with daylight saving: whole hours here are not whole hours in UTC.
process.env.TZ = "Australia/Adelaide";

const HOUR = 3_600_000;
const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test("scale maps a domain onto a range, either way round, and a flat domain onto the range's start", () => {
  const y = scale([0, 10], [100, 0]);
  equal(y(0), 100);
  equal(y(10), 0);
  equal(y(2.5), 75);
  equal(scale([100, 0], [0, 10])(75), 2.5);
  equal(scale([5, 5], [20, 80])(5), 20);
});

test("visible sorts the points and keeps the nearest one beyond each edge", () => {
  const points: Point[] = [[30, 3], [0, 0], [10, 1], [50, 5], [20, 2], [40, 4], [NaN, 9]];
  deepEqual(visible(points, { from: 15, to: 35 }), [[10, 1], [20, 2], [30, 3], [40, 4]]);
  deepEqual(visible(points, { from: 10, to: 30 }), [[0, 0], [10, 1], [20, 2], [30, 3], [40, 4]]);
  deepEqual(visible(points, { from: -10, to: 60 }), [[0, 0], [10, 1], [20, 2], [30, 3], [40, 4], [50, 5]]);
});

test("visible keeps only the last point before a window past the data, and only the first after one before it", () => {
  const points: Point[] = [[0, 0], [10, 1]];
  deepEqual(visible(points, { from: 20, to: 30 }), [[10, 1]]);
  deepEqual(visible(points, { from: -30, to: -20 }), [[0, 0]]);
  deepEqual(visible([], { from: 0, to: 1 }), []);
});

test("a step holds each value until the next point's time, and its last point holds no further", () => {
  const points: Point[] = [[0, 1], [10, 2], [20, 3]];
  equal(valueAt(points, -1, "step"), null);
  equal(valueAt(points, 0, "step"), 1);
  equal(valueAt(points, 9.9, "step"), 1);
  equal(valueAt(points, 10, "step"), 2);
  equal(valueAt(points, 20, "step"), 3);
  equal(valueAt(points, 21, "step"), null);
});

test("a line interpolates between its neighbours and has no value outside its points", () => {
  const points: Point[] = [[0, 0], [10, 10], [20, 0]];
  equal(valueAt(points, 2.5, "line"), 2.5);
  equal(valueAt(points, 15, "area"), 5);
  equal(valueAt(points, 10, "line"), 10);
  equal(valueAt(points, -1, "line"), null);
  equal(valueAt(points, 21, "line"), null);
  equal(valueAt([[5, 7]], 5, "line"), 7);
  equal(valueAt([], 5, "step"), null);
});

test("a missing value is a gap in the lookup", () => {
  const points = [[0, 1], [10, null], [20, NaN], [30, 4], [40, 6]] as Point[];
  equal(valueAt(points, 5, "line"), null);
  equal(valueAt(points, 5, "step"), 1);
  equal(valueAt(points, 15, "step"), null);
  equal(valueAt(points, 25, "line"), null);
  equal(valueAt(points, 35, "line"), 5);
});

test("runs split at missing values", () => {
  const points = [[0, 1], [1, 2], [2, null], [3, 3], [4, NaN], [5, 4], [6, 5]] as Point[];
  deepEqual(runs(points, "line"), [[[0, 1], [1, 2]], [[3, 3]], [[5, 4], [6, 5]]]);
  deepEqual(runs([], "line"), []);
});

test("a step run holds each value across to the next point, then rises to it", () => {
  deepEqual(runs([[0, 1], [10, 2], [20, 3]], "step"), [[[0, 1], [10, 1], [10, 2], [20, 2], [20, 3]]]);
  deepEqual(runs([[0, 1], [10, null], [20, 3]] as Point[], "step"), [[[0, 1], [10, 1]], [[20, 3]]]);
});

test("a line path draws each run, and a lone point as a dot", () => {
  equal(linePath([[[0, 0], [10.04, 5.06]], [[20, 1]]]), "M0,0L10,5.1M20,1h0");
  equal(linePath([]), "");
});

test("an area path closes each run down to the baseline", () => {
  equal(areaPath([[[0, 10], [5, 2], [10, 4]]], 20), "M0,20L0,10L5,2L10,4L10,20Z");
});

test("extent covers the values inside the window and the values at its edges", () => {
  const line: Point[] = [[0, 100], [10, 0], [20, 4], [30, -100]];
  deepEqual(extent([{ points: line, kind: "line" }], { from: 5, to: 25 }), [-48, 50]);
  deepEqual(extent([{ points: line, kind: "step" }], { from: 5, to: 25 }), [0, 100]);
});

test("extent spans every series, reaches down to a floor, and is never empty or flat", () => {
  const window = { from: 0, to: 10 };
  const a: Point[] = [[0, 2], [10, 3]];
  const b: Point[] = [[0, 5], [10, null]];
  deepEqual(extent([{ points: a, kind: "line" }, { points: b, kind: "line" }], window), [2, 5]);
  deepEqual(extent([{ points: a, kind: "line" }], window, 0), [0, 3]);
  deepEqual(extent([{ points: a, kind: "line" }], window, 10), [2, 10]);
  deepEqual(extent([], window), [0, 1]);
  deepEqual(extent([{ points: [[5, 4]], kind: "line" }], window), [3, 5]);
  deepEqual(extent([{ points: [[5, 0]], kind: "line" }], window, 0), [0, 1]);
});

test("value ticks are three to five round, evenly spaced numbers covering the extent", () => {
  const ranges: [number, number][] = [[0, 1], [0, 7.3], [0, 10], [0, 4.01], [-3.2, 6.8], [0.013, 0.071], [120, 135], [-250, -10], [0, 9999]];
  for (const [lo, hi] of ranges) {
    const { domain, ticks } = valueTicks([lo, hi]);
    ok(ticks.length >= 3 && ticks.length <= 5, `${lo}..${hi}: ${ticks}`);
    ok(domain[0] <= lo && domain[1] >= hi, `${lo}..${hi}: ${domain}`);
    deepEqual(domain, [ticks[0], ticks.at(-1)]);
    const step = ticks[1]! - ticks[0]!;
    const mantissa = step / 10 ** Math.floor(Math.log10(step));
    ok([1, 2, 2.5, 5].some((nice) => Math.abs(nice - mantissa) < 1e-9), `${lo}..${hi}: step ${step}`);
    ticks.forEach((tick, i) => ok(Math.abs(tick - ticks[0]! - i * step) < 1e-9 * Math.abs(step)));
  }
  deepEqual(valueTicks([0, 7.3]).ticks, [0, 2, 4, 6, 8]);
  deepEqual(valueTicks([0, 1]).ticks, [0, 0.25, 0.5, 0.75, 1]);
  deepEqual(valueTicks([0.1, 0.7]).ticks, [0, 0.2, 0.4, 0.6, 0.8]);
});

test("time ticks fall on the local clock's whole hours, labelled HH:MM", () => {
  const ticks = timeTicks({ from: local(2026, 11, 3, 6, 20), to: local(2026, 11, 3, 11, 59) }, 10);
  deepEqual(
    ticks.map(({ label }) => label),
    ["07:00", "08:00", "09:00", "10:00", "11:00"],
  );
  equal(ticks[0]!.time, local(2026, 11, 3, 7));
  ok(ticks.every(({ day }) => day === undefined));
});

test("time ticks take the finest of 1, 2, 3, 6, 12 and 24 hours that fits the count", () => {
  const window = { from: local(2026, 11, 3), to: local(2026, 11, 4) };
  const spacing = (count: number) => {
    const ticks = timeTicks(window, count);
    return (ticks[1]!.time - ticks[0]!.time) / HOUR;
  };
  equal(spacing(25), 1);
  equal(spacing(24), 2);
  equal(spacing(9), 3);
  equal(spacing(8), 6);
  equal(spacing(5), 6);
  equal(spacing(3), 12);
  equal(spacing(2), 24);
  deepEqual(
    timeTicks(window, 5).map(({ label }) => label),
    ["00:00", "06:00", "12:00", "18:00", "00:00"],
  );
});

test("a tick on a new day names it; the first tick does only when the day turned inside the window", () => {
  const ticks = timeTicks({ from: local(2026, 10, 31, 13), to: local(2026, 11, 1, 13) }, 5);
  deepEqual(
    ticks.map(({ label, day }) => [label, day]),
    [["18:00", undefined], ["00:00", "Sun 1"], ["06:00", undefined], ["12:00", undefined]],
  );
  equal(timeTicks({ from: local(2026, 10, 31, 23, 30), to: local(2026, 11, 1, 3) }, 4)[0]!.day, "Sun 1");
});

test("time ticks keep to whole local hours across a daylight saving change", () => {
  const ticks = timeTicks({ from: local(2026, 10, 3, 22), to: local(2026, 10, 4, 6) }, 10);
  ok(ticks.every(({ label }) => label.endsWith(":00")), ticks.map(({ label }) => label).join());
  ok(ticks.every(({ time }) => new Date(time).getMinutes() === 0));
  equal(ticks.length, 8);
});

test("a window without a whole hour gets no time ticks, and a tiny count still gets one", () => {
  deepEqual(timeTicks({ from: local(2026, 11, 3, 6, 10), to: local(2026, 11, 3, 6, 50) }, 5), []);
  equal(timeTicks({ from: local(2026, 11, 3), to: local(2026, 11, 3, 1) }, 0).length, 1);
});
