import {
  areaPath,
  clock,
  extent,
  finite,
  linePath,
  runs,
  scale,
  timeTicks,
  valueAt,
  valueTicks,
  visible,
  weekday,
} from "./scale.ts";

/** A time in ms since the epoch and its value; a missing value is a gap. */
export type Point = [time: number, value: number | null];
export type Kind = "line" | "area" | "step";
export type Window = { from: number; to: number };

export interface Series {
  id: string;
  label: string;
  points: readonly Point[];
  kind: Kind;
  /** A CSS custom property's name, such as `--app-good`, drawn as `var(name)`. */
  colour: `--${string}`;
  axis?: "left";
}

export interface ChartOptions {
  window: Window;
  series: readonly Series[];
  unit: string;
  now?: number;
  formatValue?: (value: number) => string;
  /** The y axis reaches down to at least this value. */
  yMin?: number;
}

export interface Chart {
  update(options: ChartOptions): void;
  destroy(): void;
}

type Style = Record<string, string>;
type Shown = { series: Series; points: Point[] };
type Layout = { left: number; right: number; top: number; bottom: number; x: (t: number) => number; time: (x: number) => number };

const SVG = "http://www.w3.org/2000/svg";
const MARGIN = { top: 8, right: 16, bottom: 34 };
const CHAR_WIDTH = 6.5;
const TICK_SPACING = 64;
const MUTED = "var(--app-text-muted)";

let charts = 0;

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

const defaultFormat = (value: number) => String(Math.round(value * 100) / 100);

/** Draws a time-series chart into `container`, sized to it, until `destroy()`. */
export function createChart(container: HTMLElement, initial: ChartOptions): Chart {
  let options = initial;
  let layout: Layout | undefined;
  let shown: Shown[] = [];
  let pointer: number | undefined;
  const clip = `app-chart-clip-${++charts}`;

  const root = styled(document.createElement("div"), { position: "relative", width: "100%", height: "100%" });
  root.className = "app-chart";
  const svg = styled(document.createElementNS(SVG, "svg"), {
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
    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    const { from, to } = options.window;
    const format = options.formatValue ?? defaultFormat;
    shown = options.series.map((series) => ({ series, points: visible(series.points, options.window) }));
    layout = undefined;
    if (width <= 0 || height <= 0 || !(to > from)) return;

    const values = valueTicks(extent(shown.map(({ series, points }) => ({ points, kind: series.kind })), options.window, options.yMin));
    const labels = values.ticks.map(format);
    const left = Math.max(...labels.map((text) => text.length)) * CHAR_WIDTH + 12;
    const right = width - MARGIN.right;
    const bottom = height - MARGIN.bottom;
    const top = MARGIN.top;
    if (right <= left || bottom <= top) return;
    const x = scale([from, to], [left, right]);
    const y = scale(values.domain, [bottom, top]);
    layout = { left, right, top, bottom, x, time: scale([left, right], [from, to]) };

    const plot = draw(draw(svg, "defs", {}), "clipPath", { id: clip });
    draw(plot, "rect", { x: left, y: top, width: right - left, height: bottom - top });

    const grid = draw(svg, "g", { class: "app-chart-grid" });
    values.ticks.forEach((value, i) => {
      draw(grid, "line", { x1: left, x2: right, y1: y(value), y2: y(value) }, { stroke: "var(--app-border)" });
      label(grid, left - 6, y(value) + 4, labels[i]!, "end");
    });

    const axis = draw(svg, "g", { class: "app-chart-time" });
    draw(axis, "line", { x1: left, x2: right, y1: bottom, y2: bottom }, { stroke: "var(--app-border-strong)" });
    for (const tick of timeTicks(options.window, Math.floor((right - left) / TICK_SPACING))) {
      const at = x(tick.time);
      const anchor = at - left < 16 ? "start" : right - at < 16 ? "end" : "middle";
      draw(axis, "line", { x1: at, x2: at, y1: bottom, y2: bottom + 4 }, { stroke: "var(--app-border-strong)" });
      label(axis, at, bottom + 16, tick.label, anchor);
      if (tick.day) label(axis, at, bottom + 29, tick.day, anchor);
    }

    const baseline = y(Math.min(Math.max(0, values.domain[0]), values.domain[1]));
    const lines = draw(svg, "g", { "clip-path": `url(#${clip})` });
    for (const { series, points } of shown) {
      const group = draw(lines, "g", { class: "app-chart-series", "data-series": series.id });
      const vertices = runs(points, series.kind).map((run) => run.map(([t, v]): [number, number] => [x(t), y(v)]));
      const colour = `var(${series.colour})`;
      if (series.kind === "area") {
        draw(group, "path", { d: areaPath(vertices, baseline) }, { fill: colour, "fill-opacity": "0.2", stroke: "none" });
      }
      draw(
        group,
        "path",
        { d: linePath(vertices) },
        { fill: "none", stroke: colour, "stroke-width": "1.5", "stroke-linejoin": "round", "stroke-linecap": "round" },
      );
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
    const format = options.formatValue ?? defaultFormat;
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
    const beside = at + 12 + width <= container.clientWidth ? at + 12 : at - 12 - width;
    styled(readout, { left: `${Math.max(0, beside)}px`, top: `${layout.top}px` });
  }

  const move = (event: PointerEvent) => {
    pointer = event.clientX - svg.getBoundingClientRect().left;
    point();
  };
  const leave = () => {
    pointer = undefined;
    point();
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", leave);
  const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(render);
  observer?.observe(container);
  render();

  return {
    update(next) {
      options = next;
      render();
    },
    destroy() {
      observer?.disconnect();
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerdown", move);
      svg.removeEventListener("pointerleave", leave);
      root.remove();
    },
  };
}
