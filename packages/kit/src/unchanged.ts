/**
 * Whether two JSON-shaped documents say the same, whatever their key order:
 * destructuring an entry out and spreading the rest back moves the survivors.
 */
export function unchanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v === null || typeof v !== "object") return v;
  return Object.fromEntries(
    Object.entries(v)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => [k, canonical(x)]),
  );
}
