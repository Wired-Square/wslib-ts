import type { Kind, Point, Window } from "./index.ts";

export type TimeTick = { time: number; label: string; day?: string };

const HOUR = 3_600_000;
const HOUR_STEPS = [1, 2, 3, 6, 12, 24];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function scale([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** The points in time order, keeping the nearest one beyond each edge so lines and holds reach the edges. */
export function visible(points: readonly Point[], { from, to }: Window): Point[] {
  const sorted = points.filter(([t]) => finite(t)).sort((a, b) => a[0] - b[0]);
  const first = sorted.findIndex(([t]) => t >= from);
  const start = first === -1 ? sorted.length - 1 : first - 1;
  const after = sorted.findIndex(([t]) => t > to);
  return sorted.slice(Math.max(0, start), after === -1 ? sorted.length : after + 1);
}

/** The value a series shows at `time`: a step holds each point's value until the next point, a line interpolates. */
export function valueAt(points: readonly Point[], time: number, kind: Kind): number | null {
  let i = points.length - 1;
  while (i >= 0 && points[i]![0] > time) i--;
  const at = points[i];
  if (!at || !finite(at[1])) return null;
  if (at[0] === time) return at[1];
  const next = points[i + 1];
  if (!next) return null;
  if (kind === "step") return at[1];
  if (!finite(next[1])) return null;
  return at[1] + ((time - at[0]) / (next[0] - at[0])) * (next[1] - at[1]);
}

/** The unbroken runs of a series as vertices, gaps split at missing values and steps expanded into holds. */
export function runs(points: readonly Point[], kind: Kind): [number, number][][] {
  const out: [number, number][][] = [];
  let run: [number, number][] = [];
  const end = () => {
    if (run.length) out.push(run);
    run = [];
  };
  points.forEach(([t, v], i) => {
    if (!finite(v)) return end();
    run.push([t, v]);
    const next = points[i + 1];
    if (kind === "step" && next) run.push([next[0], v]);
  });
  end();
  return out;
}

const round = (n: number) => Math.round(n * 10) / 10;
const xy = ([x, y]: [number, number]) => `${round(x)},${round(y)}`;

export function linePath(runs: [number, number][][]): string {
  return runs.map((run) => `M${run.map(xy).join("L")}${run.length === 1 ? "h0" : ""}`).join("");
}

export function areaPath(runs: [number, number][][], baseline: number): string {
  return runs
    .map((run) => `M${round(run[0]![0])},${round(baseline)}L${run.map(xy).join("L")}L${round(run.at(-1)![0])},${round(baseline)}Z`)
    .join("");
}

/** The lowest and highest values the series show inside the window, reaching down to `floor` when one is given. */
export function extent(series: readonly { points: readonly Point[]; kind: Kind }[], window: Window, floor?: number): [number, number] {
  const values = series.flatMap(({ points, kind }) => [
    ...points.flatMap(([t, v]) => (t >= window.from && t <= window.to && finite(v) ? [v] : [])),
    ...[valueAt(points, window.from, kind), valueAt(points, window.to, kind)].filter(finite),
  ]);
  if (floor !== undefined) values.push(floor);
  if (!values.length) return [0, 1];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    hi += 1;
    if (floor === undefined) lo -= 1;
  }
  return [lo, hi];
}

/** A domain widened to round numbers, with three to five evenly spaced ticks across it. */
export function valueTicks([lo, hi]: [number, number]): { domain: [number, number]; ticks: number[] } {
  const magnitude = 10 ** Math.floor(Math.log10((hi - lo) / 4));
  for (const factor of [1, 2, 2.5, 5, 10, 20]) {
    const step = factor * magnitude;
    const start = Math.floor(lo / step + 1e-9);
    const stop = Math.ceil(hi / step - 1e-9);
    if (stop - start <= 4) {
      const ticks = Array.from({ length: stop - start + 1 }, (_, i) => clean((start + i) * step));
      return { domain: [ticks[0]!, ticks.at(-1)!], ticks };
    }
  }
  return { domain: [lo, hi], ticks: [lo, hi] };
}

const clean = (n: number) => Number(n.toPrecision(12));

const pad = (n: number) => String(n).padStart(2, "0");
export const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const weekday = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
const dayOf = (d: Date) => d.toDateString();

/** Ticks on the local clock's whole hours, every 1, 2, 3, 6, 12 or 24 hours, at most `count` of them; a tick on a new day names it. */
export function timeTicks({ from, to }: Window, count: number): TimeTick[] {
  const first = new Date(from);
  first.setMinutes(0, 0, 0);
  if (first.getTime() < from) first.setTime(first.getTime() + HOUR);
  const hours: Date[] = [];
  for (let t = first.getTime(); t <= to; t += HOUR) hours.push(new Date(t));
  for (const step of HOUR_STEPS) {
    const chosen = hours.filter((d) => d.getMinutes() === 0 && d.getHours() % step === 0);
    if (chosen.length <= Math.max(1, count) || step === HOUR_STEPS.at(-1)) {
      let previous = dayOf(new Date(from));
      return chosen.map((d) => {
        const tick: TimeTick = { time: d.getTime(), label: clock(d) };
        if (dayOf(d) !== previous) tick.day = weekday(d);
        previous = dayOf(d);
        return tick;
      });
    }
  }
  return [];
}
