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
