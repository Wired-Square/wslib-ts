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
const peaksOf = (id: string) => [...container.querySelectorAll<SVGElement>(`.app-chart-peak[data-series="${id}"]`)];
const readout = () => container.querySelector<HTMLElement>(".app-chart-readout")!;
const pointer = (type: string, clientX: number, pointerType = "mouse", target: Element = svg()) =>
  target.dispatchEvent(new PointerEvent(type, { clientX, pointerType, bubbles: true, composed: true }));
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
    expect(removed.mock.calls.map(([type]) => type).sort()).toEqual(["pointerdown", "pointerleave", "pointermove", "pointerup"]);
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
    pointer("pointerup", 200, "touch");
    expect(readout().hidden).toBe(true);
  });

  test("a touch drag scrubs the readout whether or not it was shown", () => {
    createChart(container, options());
    for (const pen of ["touch", "pen"]) {
      pointer("pointerdown", 300, pen);
      pointer("pointermove", 250, pen);
      flush();
      expect(cursorX()).toBe(250);
      pointer("pointerdown", 200, pen);
      expect(cursorX()).toBe(200);
      pointer("pointermove", 220, pen);
      pointer("pointerup", 220, pen);
      flush();
      expect(readout().hidden).toBe(false);
      expect(cursorX()).toBe(220);
      pointer("pointerdown", 220, pen);
      pointer("pointerup", 220, pen);
    }
  });

  test("a tap inside a shadow root keeps its readout", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const inner = document.createElement("div");
    shadow.append(inner);
    try {
      createChart(inner, options());
      const drawing = inner.querySelector("svg")!;
      pointer("pointerdown", 300, "touch", drawing);
      pointer("pointerup", 300, "touch", drawing);
      expect(inner.querySelector<HTMLElement>(".app-chart-readout")!.hidden).toBe(false);
      pointer("pointerdown", 0, "touch", document.body);
      expect(inner.querySelector<HTMLElement>(".app-chart-readout")!.hidden).toBe(true);
    } finally {
      host.remove();
    }
  });

  test("an unusable y axis width draws no NaN", () => {
    for (const yAxisWidth of [Number.NaN, -20]) {
      container.replaceChildren();
      createChart(container, options({ yAxisWidth }));
      expect(container.querySelector(".app-chart-series")).not.toBeNull();
      expect(container.innerHTML).not.toContain("NaN");
    }
    expect(plotLeft()).toBe(0);
  });

  test("a tap elsewhere clears a tapped readout", () => {
    createChart(container, options());
    pointer("pointerdown", 300, "touch");
    expect(readout().hidden).toBe(false);
    pointer("pointerdown", 0, "touch", document.body);
    expect(readout().hidden).toBe(true);
  });

  test("draws each band full height behind the grid, clipped to the window, and nothing of one outside it", () => {
    createChart(
      container,
      options({
        bands: [
          { from: from - HOUR, to: from + HOUR, colour: "--app-bad" },
          { from: from + 3 * HOUR, to: from + 4 * HOUR, colour: "--app-warn", opacity: 0.4 },
          { from: to, to: to + HOUR, colour: "--app-good" },
        ],
      }),
    );
    const left = plotLeft();
    const right = Number(container.querySelector(".app-chart-time line")!.getAttribute("x2"));
    const hour = (right - left) / 6;
    const rects = [...container.querySelectorAll<SVGElement>(".app-chart-bands rect")];
    expect(rects).toHaveLength(2);
    expect(Number(rects[0]!.getAttribute("x"))).toBe(left);
    expect(Number(rects[0]!.getAttribute("width"))).toBeCloseTo(hour);
    expect(Number(rects[1]!.getAttribute("x"))).toBeCloseTo(left + 3 * hour);
    expect(rects[0]!.style.getPropertyValue("fill")).toBe("var(--app-bad)");
    expect(rects[0]!.style.getPropertyValue("fill-opacity")).toBe("0.2");
    expect(rects[1]!.style.getPropertyValue("fill-opacity")).toBe("0.4");
    const grid = container.querySelector(".app-chart-grid line")!;
    expect(Number(rects[0]!.getAttribute("y"))).toBe(8);
    expect(Number(rects[0]!.getAttribute("height"))).toBe(200 - 34 - 8);
    const order = [...svg().children].map((node) => node.getAttribute("class"));
    expect(order.indexOf("app-chart-bands")).toBeLessThan(order.indexOf("app-chart-grid"));
    expect(grid.compareDocumentPosition(series("a")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("draws the zero line only when zero is strictly inside the y range", () => {
    const signed = { id: "s", label: "Signed", kind: "line" as const, colour: "--app-good" as const, points: [[from, -2], [to, 6]] as [number, number][] };
    const chart = createChart(container, options({ series: [signed] }));
    const zero = container.querySelector<SVGElement>(".app-chart-zero")!;
    expect(zero.style.getPropertyValue("stroke")).toBe("var(--app-border-strong)");
    const ticks = [...container.querySelectorAll(".app-chart-grid text")].map((t) => t.textContent);
    expect(Number(zero.getAttribute("y1"))).toBe(Number(container.querySelectorAll(".app-chart-grid line")[ticks.indexOf("0")]!.getAttribute("y1")));
    chart.update(options());
    expect(container.querySelector(".app-chart-zero")).toBeNull();
    chart.update(options({ series: [{ ...signed, points: [[from, -6], [to, -1]] }] }));
    expect(container.querySelector(".app-chart-zero")).toBeNull();
  });

  const spiky = {
    id: "p",
    label: "Price",
    kind: "step" as const,
    colour: "--app-warn" as const,
    points: [[from, 10], [from + HOUR, 1500], [from + 2 * HOUR, 20], [from + 5 * HOUR, 900], [to, 950]] as [number, number][],
  };

  test("a cap tops the axis out at or below it, clips higher values and marks each run's peak inside the plot", () => {
    createChart(container, options({ series: [spiky], yCap: 25 }));
    const ticks = [...container.querySelectorAll(".app-chart-grid text")].map((t) => Number(t.textContent));
    expect(Math.max(...ticks)).toBeLessThanOrEqual(25);
    const peaks = peaksOf("p");
    expect(peaks.map((peak) => peak.textContent)).toEqual(["↑ 1500", "↑ 950"]);
    expect(peaks[0]!.style.getPropertyValue("fill")).toBe("var(--app-warn)");
    const left = plotLeft();
    const right = Number(container.querySelector(".app-chart-time line")!.getAttribute("x2"));
    expect(Number(peaks[0]!.getAttribute("x"))).toBeCloseTo(left + (right - left) * 1.5 / 6);
    const half = ("↑ 950".length * 6.5) / 2;
    expect(Number(peaks[1]!.getAttribute("x"))).toBeCloseTo(right - half);
    expect(series("p").closest("svg")!.style.getPropertyValue("overflow")).toBe("hidden");
    hover(left + (right - left) * 1.5 / 6);
    expect(readout().querySelector('[data-series="p"]')!.textContent).toBe("Price 1500 kW");
  });

  test("peaks that would overlap stack downwards, and apart ones share the top row", () => {
    const echo = { ...spiky, id: "q", label: "Echo", colour: "--app-good" as const, points: spiky.points.map(([t, v]): [number, number] => [t, v - 300]) };
    createChart(container, options({ series: [spiky, echo], yCap: 25 }));
    const at = (id: string) => peaksOf(id).map((peak) => Number(peak.getAttribute("y")));
    expect(at("p")).toEqual([19, 19]);
    expect(at("q")).toEqual([32, 32]);
  });

  test("peaks sit above every series, each on a surface box spanning its text", () => {
    const echo = { ...spiky, id: "q", label: "Echo", colour: "--app-good" as const };
    createChart(container, options({ series: [spiky, echo], yCap: 25 }));
    const marks = container.querySelector(".app-chart-peaks")!;
    expect(marks.previousElementSibling).toBe(series("q"));
    const tops = [...marks.querySelectorAll(".app-chart-peak-box")].map((box) => Number(box.getAttribute("y")));
    expect(Math.min(...tops)).toBe(Number(marks.parentElement!.getAttribute("y")));
    expect([...marks.children].map((node) => node.getAttribute("class"))).toEqual(
      Array.from({ length: 4 }, () => ["app-chart-peak-box", "app-chart-peak"]).flat(),
    );
    for (const text of [...peaksOf("p"), ...peaksOf("q")]) {
      const box = text.previousElementSibling as SVGElement;
      const width = text.textContent!.length * 6.5;
      expect(box.style.getPropertyValue("fill")).toBe("var(--app-surface)");
      expect(Number(box.getAttribute("width"))).toBeCloseTo(width);
      expect(Number(box.getAttribute("x"))).toBeCloseTo(Number(text.getAttribute("x")) - width / 2);
      const y = Number(box.getAttribute("y"));
      expect(y).toBeLessThan(Number(text.getAttribute("y")) - 8);
      expect(y + Number(box.getAttribute("height"))).toBeGreaterThan(Number(text.getAttribute("y")));
    }
  });

  test("without a cap, or with one above every value, no peak is marked", () => {
    const chart = createChart(container, options({ series: [spiky] }));
    expect(container.querySelector(".app-chart-peak")).toBeNull();
    chart.update(options({ series: [spiky], yCap: 2000 }));
    expect(container.querySelector(".app-chart-peak")).toBeNull();
  });

  test("a cap at or below yMin is ignored", () => {
    for (const yCap of [0, -5]) {
      container.replaceChildren();
      createChart(container, options({ series: [spiky], yMin: 0, yCap }));
      const ticks = [...container.querySelectorAll(".app-chart-grid text")].map((t) => Number(t.textContent));
      expect(Math.max(...ticks)).toBeGreaterThanOrEqual(1500);
      expect(container.querySelector(".app-chart-peak")).toBeNull();
    }
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
