import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createChart, type ChartOptions } from "../../src/index.ts";

const HOUR = 3_600_000;
const from = new Date(2026, 10, 3, 0).getTime();
const to = from + 6 * HOUR;

const options = (overrides: Partial<ChartOptions> = {}): ChartOptions => ({
  window: { from, to },
  unit: "kW",
  series: [
    { id: "a", label: "Alpha", kind: "line", colour: "--app-good", points: [[from, 0], [from + 2 * HOUR, 4], [to, 2]] },
    { id: "b", label: "Beta", kind: "step", colour: "--app-warn", points: [[from, 1], [from + 3 * HOUR, 3], [to, 3]] },
    { id: "c", label: "Gamma", kind: "area", colour: "--app-bad", points: [[from + HOUR, 2], [from + 2 * HOUR, null], [from + 4 * HOUR, 1], [to, 1]] },
  ],
  ...overrides,
});

let container: HTMLElement;
let frames: FrameRequestCallback[];

const sized = (width: number, height: number) => {
  for (const [name, value] of [["clientWidth", width], ["clientHeight", height]] as const) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("app-chart") ? value : 0;
      },
    });
  }
};
const flush = () => frames.splice(0).forEach((frame) => frame(0));
const svg = () => container.querySelector("svg")!;
const series = (id: string) => container.querySelector(`.app-chart-series[data-series="${id}"]`)!;
const readout = () => container.querySelector<HTMLElement>(".app-chart-readout")!;
const pointer = (type: string, clientX: number, pointerType = "mouse", target: Element = svg()) =>
  target.dispatchEvent(new PointerEvent(type, { clientX, pointerType, bubbles: true }));
const hover = (clientX: number) => {
  pointer("pointermove", clientX);
  flush();
};
const plotLeft = () => Number(container.querySelector(".app-chart-time line")!.getAttribute("x1"));
const cursorX = () => Number(container.querySelector(".app-chart-cursor")?.getAttribute("x1"));

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  sized(600, 200);
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal("cancelAnimationFrame", () => frames.splice(0));
});

afterEach(() => {
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

const stubResizeObserver = () => {
  const observers: { callback: () => void; observed: Element[]; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observed: Element[] = [];
      disconnect = vi.fn();
      constructor(public callback: () => void) {
        observers.push(this);
      }
      observe(target: Element) {
        this.observed.push(target);
      }
    },
  );
  return observers;
};

describe("createChart", () => {
  test("draws a group of paths per series, stroked with the series' custom property", () => {
    createChart(container, options());
    const groups = [...container.querySelectorAll(".app-chart-series")];
    expect(groups.map((g) => g.getAttribute("data-series"))).toEqual(["a", "b", "c"]);
    expect(series("a").querySelectorAll("path")).toHaveLength(1);
    expect(series("c").querySelectorAll("path")).toHaveLength(2);
    const line = series("a").querySelector("path")!;
    expect(line.style.getPropertyValue("stroke")).toBe("var(--app-good)");
    expect(line.getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+$/);
    expect(series("c").querySelector("path")!.style.getPropertyValue("fill")).toBe("var(--app-bad)");
  });

  test("a missing value breaks the path, and a step draws its holds", () => {
    createChart(container, options());
    expect(series("c").querySelectorAll("path")[1]!.getAttribute("d")!.match(/M/g)).toHaveLength(2);
    expect(series("b").querySelector("path")!.getAttribute("d")!.split("L")).toHaveLength(5);
  });

  test("sizes the drawing to the container and labels the axes", () => {
    createChart(container, options());
    expect(svg().getAttribute("width")).toBe("600");
    expect(svg().getAttribute("height")).toBe("200");
    const times = [...container.querySelectorAll(".app-chart-time text")].map((t) => t.textContent);
    expect(times).toContain("00:00");
    expect(times).toContain("06:00");
    const values = [...container.querySelectorAll(".app-chart-grid text")].map((t) => t.textContent);
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(values.length).toBeLessThanOrEqual(5);
    expect(values[0]).toBe("0");
  });

  test("draws the now marker only when now falls inside the window", () => {
    const chart = createChart(container, options({ now: from + 3 * HOUR }));
    expect(container.querySelectorAll(".app-chart-now")).toHaveLength(1);
    chart.update(options({ now: to + HOUR }));
    expect(container.querySelector(".app-chart-now")).toBeNull();
  });

  test("update redraws with the new series", () => {
    const chart = createChart(container, options());
    chart.update(options({ series: [{ id: "z", label: "Zeta", kind: "line", colour: "--app-accent", points: [] }] }));
    expect([...container.querySelectorAll(".app-chart-series")].map((g) => g.getAttribute("data-series"))).toEqual(["z"]);
    expect(series("z").querySelector("path")!.getAttribute("d")).toBe("");
  });

  test("hovering shows a cursor and each series' value at that time, and leaving clears them", () => {
    createChart(container, options());
    expect(readout().hidden).toBe(true);
    const left = Number(container.querySelector(".app-chart-time line")!.getAttribute("x1"));
    const right = Number(container.querySelector(".app-chart-time line")!.getAttribute("x2"));
    hover(left + ((right - left) * 3.5) / 6);
    expect(readout().hidden).toBe(false);
    expect(cursorX()).toBeCloseTo(left + ((right - left) * 3.5) / 6);
    const rows = [...readout().querySelectorAll("[data-series]")].map((row) => row.textContent);
    expect(readout().firstElementChild!.textContent).toBe("Tue 3 03:30");
    expect(rows).toEqual(["Alpha 3.25 kW", "Beta 3 kW", "Gamma –"]);

    pointer("pointerleave", 0);
    expect(readout().hidden).toBe(true);
    expect(container.querySelector(".app-chart-cursor")).toBeNull();
  });

  test("the readout formats with formatValue, and the cursor stays inside the plot", () => {
    createChart(container, options({ formatValue: (v) => v.toFixed(1) }));
    hover(10_000);
    const right = Number(container.querySelector(".app-chart-time line")!.getAttribute("x2"));
    expect(cursorX()).toBe(right);
    expect(readout().querySelector('[data-series="a"]')!.textContent).toBe("Alpha 2.0 kW");
    expect(Number.parseFloat(readout().style.left)).toBeLessThanOrEqual(600);
  });

  test("a hovered chart keeps its readout across an update", () => {
    const chart = createChart(container, options());
    hover(300);
    chart.update(options({ unit: "kWh" }));
    expect(readout().hidden).toBe(false);
    expect(readout().querySelector('[data-series="b"]')!.textContent).toMatch(/kWh$/);
  });

  test("an empty or unsized chart draws nothing to hover", () => {
    sized(0, 0);
    createChart(container, options({ series: [] }));
    expect(container.querySelector(".app-chart-series")).toBeNull();
    hover(100);
    expect(readout().hidden).toBe(true);
  });

  test("observes its own box, draws once on creation, and redraws only when the size changes", () => {
    const observers = stubResizeObserver();
    createChart(container, options());
    expect(observers[0]!.observed).toEqual([container.querySelector(".app-chart")]);
    const first = series("a");
    observers[0]!.callback();
    expect(first.isConnected).toBe(true);
    sized(300, 100);
    observers[0]!.callback();
    expect(first.isConnected).toBe(false);
    expect(svg().getAttribute("width")).toBe("300");
  });

  test("destroy removes the chart and stops observing and listening", () => {
    const observers = stubResizeObserver();
    const chart = createChart(container, options());
    const removed = vi.spyOn(SVGElement.prototype, "removeEventListener");
    const removedFromDocument = vi.spyOn(document, "removeEventListener");
    chart.destroy();
    expect(container.children).toHaveLength(0);
    expect(observers[0]!.disconnect).toHaveBeenCalled();
    expect(removed.mock.calls.map(([type]) => type).sort()).toEqual(["pointerdown", "pointerleave", "pointermove"]);
    expect(removedFromDocument.mock.calls.map(([type]) => type)).toEqual(["pointerdown"]);
  });

  test("measures its own box, not the container's padded one, and keeps the drawing out of the flow", () => {
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 640 });
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 240 });
    createChart(container, options());
    expect(svg().getAttribute("width")).toBe("600");
    expect(svg().getAttribute("height")).toBe("200");
    expect(svg().style.getPropertyValue("position")).toBe("absolute");
  });

  test("clips the series without an id, so copies on one page cannot collide", () => {
    createChart(container, options());
    expect(container.querySelector("[id]")).toBeNull();
    const plot = series("a").closest("svg")!;
    expect(plot).not.toBe(svg());
    expect(plot.style.getPropertyValue("overflow")).toBe("hidden");
  });

  test("a window with an infinite end draws nothing", () => {
    createChart(container, options({ window: { from, to: Infinity } }));
    expect(container.querySelector(".app-chart-series")).toBeNull();
    createChart(container, options({ window: { from: -Infinity, to } }));
    expect(container.querySelector(".app-chart-series")).toBeNull();
  });

  test("the default format keeps as many decimals as the ticks need", () => {
    const tiny = { id: "t", label: "Tiny", kind: "line" as const, colour: "--app-good" as const, points: [[from, 0], [to, 0.004]] as [number, number][] };
    createChart(container, options({ series: [tiny] }));
    const values = [...container.querySelectorAll(".app-chart-grid text")].map((t) => t.textContent);
    expect(values).toEqual(["0", "0.001", "0.002", "0.003", "0.004"]);
  });

  test("a fixed y axis width lines up the time axes of charts with different labels", () => {
    const wide = { id: "w", label: "Wide", kind: "line" as const, colour: "--app-good" as const, points: [[from, -20000], [to, 10000]] as [number, number][] };
    createChart(container, options({ yAxisWidth: 48 }));
    const narrow = plotLeft();
    container.replaceChildren();
    createChart(container, options({ series: [wide], yAxisWidth: 48 }));
    expect(plotLeft()).toBe(48);
    expect(narrow).toBe(48);
    container.replaceChildren();
    createChart(container, options({ series: [wide] }));
    expect(plotLeft()).toBeGreaterThan(48);
  });

  test("a tap keeps the readout through the touch's pointerup and pointerleave, until a second tap", () => {
    createChart(container, options());
    pointer("pointerdown", 300, "touch");
    pointer("pointerup", 300, "touch");
    pointer("pointerleave", 300, "touch");
    flush();
    expect(readout().hidden).toBe(false);
    pointer("pointerdown", 200, "touch");
    expect(readout().hidden).toBe(true);
  });

  test("a tap elsewhere clears a tapped readout", () => {
    createChart(container, options());
    pointer("pointerdown", 300, "touch");
    expect(readout().hidden).toBe(false);
    pointer("pointerdown", 0, "touch", document.body);
    expect(readout().hidden).toBe(true);
  });

  test("pointer moves redraw the readout once per frame", () => {
    createChart(container, options());
    pointer("pointermove", 200);
    pointer("pointermove", 250);
    pointer("pointermove", 300);
    expect(frames).toHaveLength(1);
    expect(readout().hidden).toBe(true);
    flush();
    expect(cursorX()).toBe(300);
  });
});
