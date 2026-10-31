/** A time in ms since the epoch and its value; a missing value is a gap. */
export type Point = [time: number, value: number | null];
export type Kind = "line" | "area" | "step";
export type Window = { from: number; to: number };

/** A time tick; `period` names the day, month or year it starts when that differs from the tick before. */
export type TimeTick = { time: number; label: string; period?: string };

const MINUTE = 60_000;
const DAY_MINUTES = 1440;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  let lo = Infinity;
  let hi = -Infinity;
  const include = (v: number | null) => {
    if (!finite(v)) return;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  };
  for (const { points, kind } of series) {
    for (const [t, v] of points) if (t >= window.from && t <= window.to) include(v);
    include(valueAt(points, window.from, kind));
    include(valueAt(points, window.to, kind));
  }
  if (lo > hi) return floor === undefined ? [0, 1] : [floor, floor + 1];
  if (floor !== undefined) lo = Math.min(lo, floor);
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

type Step = { unit: "minute" | "day" | "month"; n: number };

const STEPS: Step[] = [
  ...[5, 10, 15, 30, 60, 120, 180, 360, 720].map((n) => ({ unit: "minute" as const, n })),
  ...[1, 2, 7, 14].map((n) => ({ unit: "day" as const, n })),
  ...[1, 3, 6, 12].map((n) => ({ unit: "month" as const, n })),
];
const LONGEST_MINUTES = { minute: 1, day: DAY_MINUTES + 60, month: 31 * DAY_MINUTES };

// Ticks count wall-clock minutes from a Monday, so they step on the local calendar across daylight saving and weeks start on Mondays.
const EPOCH = Date.UTC(2000, 0, 3);
const wall = (d: Date) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) - EPOCH) / MINUTE;
const onWall = (minutes: number) => new Date(EPOCH + minutes * MINUTE);
const local = (minutes: number) => {
  const u = onWall(minutes);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes());
};

const stepMinutes = ({ unit, n }: Step) => n * (unit === "day" ? DAY_MINUTES : 1);
const index = (step: Step, minutes: number) => {
  if (step.unit !== "month") return Math.floor(minutes / stepMinutes(step));
  const u = onWall(minutes);
  return Math.floor(((u.getUTCFullYear() - 2000) * 12 + u.getUTCMonth()) / step.n);
};
const minutesAt = (step: Step, k: number) =>
  step.unit === "month" ? (Date.UTC(2000, k * step.n, 1) - EPOCH) / MINUTE : k * stepMinutes(step);

function dates(step: Step, { from, to }: Window): Date[] {
  const out: Date[] = [];
  for (let k = index(step, wall(new Date(from))); ; k++) {
    const minutes = minutesAt(step, k);
    const at = local(minutes);
    if (at.getTime() > to) return out;
    if (at.getTime() >= from && wall(at) === minutes) out.push(at);
  }
}

function labelled(ticks: Date[], { unit }: Step): TimeTick[] {
  let previous: string | undefined;
  return ticks.map((d) => {
    const [label, period] =
      unit === "minute" ? [clock(d), weekday(d)] : unit === "day" ? [weekday(d), MONTHS[d.getMonth()]!] : [MONTHS[d.getMonth()]!, String(d.getFullYear())];
    const tick: TimeTick = { time: d.getTime(), label };
    if (period !== previous) tick.period = period;
    previous = period;
    return tick;
  });
}

/** Ticks on the local calendar at the finest of 5 minutes to 12 months that gives at most `count` of them. */
export function timeTicks(window: Window, count: number): TimeTick[] {
  const most = Math.max(1, count);
  const span = (window.to - window.from) / MINUTE;
  for (const step of STEPS.slice(0, -1)) {
    if (span / (step.n * LONGEST_MINUTES[step.unit]) > most + 2) continue;
    const ticks = dates(step, window);
    if (ticks.length <= most) return labelled(ticks, step);
  }
  const yearly = STEPS.at(-1)!;
  const ticks = dates(yearly, window);
  const every = Math.ceil(ticks.length / most);
  return labelled(ticks.filter((_, i) => i % every === 0), yearly);
}
