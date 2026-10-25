/** A measurement, or a dash: blank would read as zero. */
export function num(value: number | null | undefined, unit = "", digits = 0): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(digits)}${unit}`;
}

/** `1 device`, `2 devices`. Regular plurals only. */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function commaList(text: string): string[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function when(at: string | null | undefined): string {
  return at ? new Date(at).toLocaleString() : "—";
}

export function time(at: string | null | undefined): string {
  return at ? new Date(at).toLocaleTimeString() : "—";
}

export function day(at: string | null | undefined): string {
  return at ? new Date(at).toLocaleDateString() : "—";
}

/** `3s ago`, `4m ago`. `now` is a parameter so a ticking signal makes the text count up. */
export function ago(at: number, now: number): string {
  // Clamped: a wall clock steps backwards under an NTP correction.
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export type DateMode = "utc" | "local" | "relative";

export type RelativeWording = (at: Date, now: number) => string;

const LAYOUT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

function relativeTo(at: Date, now: number, locale: string | undefined): string {
  const seconds = Math.round((at.getTime() - now) / 1000);
  const [unit, span] = UNITS.find(([, span]) => Math.abs(seconds) >= span) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.trunc(seconds / span), unit);
}

/** `at` in a mode; `relative` replaces the platform's wording, a countdown say. `now` defaults to the clock. */
export function formatWhen(
  at: Date,
  mode: DateMode,
  options: { locale?: string | undefined; now?: number; relative?: RelativeWording | undefined } = {},
): string {
  const { locale, now = Date.now(), relative } = options;
  if (mode === "relative") return relative ? relative(at, now) : relativeTo(at, now, locale);
  if (mode === "utc") return `${new Intl.DateTimeFormat(locale, { ...LAYOUT, timeZone: "UTC" }).format(at)} UTC`;
  return new Intl.DateTimeFormat(locale, { ...LAYOUT, timeZoneName: "short" }).format(at);
}
