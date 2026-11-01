import {
  areaPath,
  clip,
  clock,
  extent,
  finite,
  linePath,
  peaks,
  runs,
  scale,
  timeTicks,
  valueAt,
  valueTicks,
  visible,
  weekday,
  type Kind,
  type Point,
  type Window,
} from "./scale.ts";

export type { Kind, Point, Window } from "./scale.ts";

export interface Series {
  id: string;
  label: string;
  points: readonly Point[];
  kind: Kind;
  /** A CSS custom property's name, such as `--app-good`, drawn as `var(name)`. */
  colour: `--${string}`;
}

/** A full-height tint over a time range, coloured like a series. */
export interface Band {
  from: number;
  to: number;
  colour: Series["colour"];
  /** The fill's opacity; by default an area's, 0.2. */
  opacity?: number;
}

export interface ChartOptions {
  window: Window;
  series: readonly Series[];
  /** Drawn behind the grid and the series, in order. */
  bands?: readonly Band[];
  unit: string;
  now?: number;
  formatValue?: (value: number) => string;
  /** The y axis reaches down to at least this value. */
  yMin?: number;
  /** The y axis tops out at or below this; higher values are clipped and their peaks marked. */
  yCap?: number;
  /** The y axis's width in px, so stacked charts share a time axis; by default it fits the y labels. */
  yAxisWidth?: number;
}

export interface Chart {
  update(options: ChartOptions): void;
  destroy(): void;
}

type Style = Record<string, string>;
type Shown = { series: Series; points: Point[] };
type Layout = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  time: (x: number) => number;
  format: (value: number) => string;
};

const SVG = "http://www.w3.org/2000/svg";
const MARGIN = { top: 8, right: 16, bottom: 34 };
const CHAR_WIDTH = 6.5;
const TICK_SPACING = 64;
const MUTED = "var(--app-text-muted)";
const AREA_OPACITY = 0.2;

const styled = <E extends Element & ElementCSSInlineStyle>(node: E, style: Style) => {
  for (const [name, value] of Object.entries(style)) node.style.setProperty(name, value);
  return node;
};

function draw(parent: Element, name: string, attributes: Record<string, string | number>, style: Style = {}) {
  const node = document.createElementNS(SVG, name) as SVGElement;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  parent.append(styled(node, style));
  return node;
}

const label = (parent: Element, x: number, y: number, text: string, anchor: string) => {
  draw(parent, "text", { x, y, "text-anchor": anchor }, { fill: MUTED }).textContent = text;
};

const decimals = (step: number) => {
  let digits = 2;
  while (digits < 12 && Math.abs(Math.round(step * 10 ** digits) - step * 10 ** digits) > 1e-6) digits++;
  return digits;
};

const defaultFormat = (step: number) => {
  const digits = decimals(step);
  return (value: number) => String(Number(value.toFixed(digits)));
};

/** Draws a time-series chart into `container`, sized to it, until `destroy()`. */
export function createChart(container: HTMLElement, initial: ChartOptions): Chart {
  let options = initial;
  let size = { width: 0, height: 0 };
  let layout: Layout | undefined;
  let shown: Shown[] = [];
  let pointer: number | undefined;
  let frame: number | undefined;
  let hideOnRelease = false;

  const root = styled(document.createElement("div"), { position: "relative", width: "100%", height: "100%" });
  root.className = "app-chart";
  const svg = styled(document.createElementNS(SVG, "svg"), {
    position: "absolute",
    left: "0",
    top: "0",
    display: "block",
    "font-family": "var(--app-font)",
    "font-size": "11px",
    "touch-action": "pan-y",
  });
  const readout = styled(document.createElement("div"), {
    position: "absolute",
    "pointer-events": "none",
    "white-space": "nowrap",
    "font-family": "var(--app-font)",
    "font-size": "12px",
    padding: "4px 8px",
    color: "var(--app-text)",
    background: "var(--app-surface)",
    border: "1px solid var(--app-border)",
    "border-radius": "var(--app-radius)",
    "box-shadow": "var(--app-shadow)",
  });
  readout.className = "app-chart-readout";
  readout.hidden = true;
  root.append(svg, readout);
  container.append(root);

  function render() {
    svg.replaceChildren();
    size = { width: root.clientWidth, height: root.clientHeight };
    const { width, height } = size;
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    const { from, to } = options.window;
    shown = options.series.map((series) => ({ series, points: visible(series.points, options.window) }));
    layout = undefined;
    if (width <= 0 || height <= 0 || !Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return;

    const values = valueTicks(extent(shown.map(({ series, points }) => ({ points, kind: series.kind })), options.window, options.yMin), options.yCap);
    const format = options.formatValue ?? defaultFormat(values.ticks[1]! - values.ticks[0]!);
    const labels = values.ticks.map(format);
    const left = finite(options.yAxisWidth) ? Math.max(0, options.yAxisWidth) : Math.max(...labels.map((text) => text.length)) * CHAR_WIDTH + 12;
    const right = width - MARGIN.right;
    const bottom = height - MARGIN.bottom;
    const { top } = MARGIN;
    if (!(right > left && bottom > top)) return;
    const x = scale([from, to], [left, right]);
    const y = scale(values.domain, [bottom, top]);
    layout = { left, right, top, bottom, time: scale([left, right], [from, to]), format };

    const bands = draw(svg, "g", { class: "app-chart-bands" });
    for (const band of options.bands ?? []) {
      const inside = clip(band, options.window);
      if (!inside) continue;
      draw(
        bands,
        "rect",
        { x: x(inside.from), y: top, width: x(inside.to) - x(inside.from), height: bottom - top },
        { fill: `var(${band.colour})`, "fill-opacity": String(band.opacity ?? AREA_OPACITY) },
      );
    }

    const grid = draw(svg, "g", { class: "app-chart-grid" });
    values.ticks.forEach((value, i) => {
      draw(grid, "line", { x1: left, x2: right, y1: y(value), y2: y(value) }, { stroke: "var(--app-border)" });
      label(grid, left - 6, y(value) + 4, labels[i]!, "end");
    });
    if (values.domain[0] < 0 && values.domain[1] > 0) {
      draw(grid, "line", { class: "app-chart-zero", x1: left, x2: right, y1: y(0), y2: y(0) }, { stroke: "var(--app-border-strong)" });
    }

    const axis = draw(svg, "g", { class: "app-chart-time" });
    draw(axis, "line", { x1: left, x2: right, y1: bottom, y2: bottom }, { stroke: "var(--app-border-strong)" });
    for (const tick of timeTicks(options.window, Math.floor((right - left) / TICK_SPACING))) {
      const at = x(tick.time);
      const anchor = at - left < 16 ? "start" : right - at < 16 ? "end" : "middle";
      draw(axis, "line", { x1: at, x2: at, y1: bottom, y2: bottom + 4 }, { stroke: "var(--app-border-strong)" });
      label(axis, at, bottom + 16, tick.label, anchor);
      if (tick.period) label(axis, at, bottom + 29, tick.period, anchor);
    }

    const baseline = y(Math.min(Math.max(0, values.domain[0]), values.domain[1]));
    const plot = draw(
      svg,
      "svg",
      { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}` },
      { overflow: "hidden" },
    );
    const rows: [number, number][][] = [];
    const marks: { series: Series; text: string; at: number; half: number; row: number }[] = [];
    for (const { series, points } of shown) {
      const group = draw(plot, "g", { class: "app-chart-series", "data-series": series.id });
      const vertices = runs(points, series.kind).map((run) => run.map(([t, v]): [number, number] => [x(t), y(v)]));
      const colour = `var(${series.colour})`;
      if (series.kind === "area") {
        draw(group, "path", { d: areaPath(vertices, baseline) }, { fill: colour, "fill-opacity": String(AREA_OPACITY), stroke: "none" });
      }
      draw(
        group,
        "path",
        { d: linePath(vertices) },
        { fill: "none", stroke: colour, "stroke-width": "1.5", "stroke-linejoin": "round", "stroke-linecap": "round" },
      );
      for (const [t, v] of peaks(points, series.kind, options.window, values.domain[1])) {
        const text = `↑ ${format(v)}`;
        const half = (text.length * CHAR_WIDTH) / 2;
        const at = Math.min(Math.max(x(t), left + half), right - half);
        const fits = rows.findIndex((spans) => spans.every(([a, b]) => at + half < a || at - half > b));
        const row = fits === -1 ? rows.push([]) - 1 : fits;
        rows[row]!.push([at - half, at + half]);
        marks.push({ series, text, at, half, row });
      }
    }
    // Above every series, each on a box in the surface colour, so no series' line runs through a mark's digits.
    const peakMarks = draw(plot, "g", { class: "app-chart-peaks" });
    for (const { series, text, at, half, row } of marks) {
      const baseline = top + 11 + row * 13;
      draw(peakMarks, "rect", { class: "app-chart-peak-box", x: at - half, y: baseline - 10, width: 2 * half, height: 13 }, { fill: "var(--app-surface)" });
      draw(peakMarks, "text", { class: "app-chart-peak", "data-series": series.id, x: at, y: baseline, "text-anchor": "middle" }, {
        fill: `var(${series.colour})`,
        stroke: "var(--app-surface)",
        "stroke-width": "3",
        "paint-order": "stroke",
      }).textContent = text;
    }

    const { now } = options;
    if (now !== undefined && now >= from && now <= to) {
      draw(svg, "line", { class: "app-chart-now", x1: x(now), x2: x(now), y1: top, y2: bottom }, { stroke: "var(--app-accent)", "stroke-dasharray": "3 3" });
    }
    point();
  }

  function point() {
    svg.querySelector(".app-chart-cursor")?.remove();
    readout.hidden = pointer === undefined || !layout;
    if (pointer === undefined || !layout) return;
    const at = Math.min(Math.max(pointer, layout.left), layout.right);
    draw(svg, "line", { class: "app-chart-cursor", x1: at, x2: at, y1: layout.top, y2: layout.bottom }, { stroke: MUTED });

    const time = layout.time(at);
    const minute = new Date(Math.round(time / 60_000) * 60_000);
    const { format } = layout;
    const heading = document.createElement("div");
    heading.textContent = `${weekday(minute)} ${clock(minute)}`;
    styled(heading, { color: MUTED });
    readout.replaceChildren(
      heading,
      ...shown.map(({ series, points }) => {
        const value = valueAt(points, time, series.kind);
        const row = document.createElement("div");
        const swatch = styled(document.createElement("span"), {
          display: "inline-block",
          width: "8px",
          height: "8px",
          "margin-right": "6px",
          "border-radius": "2px",
          background: `var(${series.colour})`,
        });
        row.dataset.series = series.id;
        row.append(swatch, `${series.label} ${finite(value) ? `${format(value)} ${options.unit}` : "–"}`);
        return row;
      }),
    );
    const width = readout.offsetWidth;
    const beside = at + 12 + width <= size.width ? at + 12 : at - 12 - width;
    styled(readout, { left: `${Math.max(0, beside)}px`, top: `${layout.top}px` });
  }

  const offset = (event: PointerEvent) => event.clientX - svg.getBoundingClientRect().left;
  const show = (at: number | undefined) => {
    pointer = at;
    point();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") {
      if (pointer === undefined) return;
      hideOnRelease = false;
    }
    pointer = offset(event);
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      point();
    });
  };
  // A touch's pointerup is followed at once by pointerleave, so a tap holds the readout until the next tap, and a drag scrubs it.
  const press = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    hideOnRelease = pointer !== undefined;
    show(offset(event));
  };
  const release = () => {
    if (hideOnRelease) show(undefined);
    hideOnRelease = false;
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") show(undefined);
  };
  const elsewhere = (event: PointerEvent) => {
    if (pointer !== undefined && !event.composedPath().includes(root)) show(undefined);
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", press);
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointerleave", leave);
  document.addEventListener("pointerdown", elsewhere);
  const observer =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (root.clientWidth !== size.width || root.clientHeight !== size.height) render();
        });
  observer?.observe(root);
  render();

  return {
    update(next) {
      options = next;
      render();
    },
    destroy() {
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerdown", press);
      svg.removeEventListener("pointerup", release);
      svg.removeEventListener("pointerleave", leave);
      document.removeEventListener("pointerdown", elsewhere);
      root.remove();
    },
  };
}
