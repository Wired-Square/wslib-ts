import type { Pending } from "./pending";

/**
 * Calls `show` with the milliseconds left, now, every second, and on every
 * visibility change, until 0, reckoned from the clock rather than from ticks,
 * which a hidden tab throttles. Returns the function that stops it.
 */
export function startCountdown(inMs: number, show: (leftMs: number) => void): () => void {
  // Not `performance.now`, which stops while the machine sleeps.
  const deadline = Date.now() + inMs;
  const update = () => {
    const left = Math.max(0, deadline - Date.now());
    show(left);
    if (left === 0) stop();
  };
  const timer = setInterval(update, 1_000);
  document.addEventListener("visibilitychange", update);
  const stop = () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", update);
  };
  update();
  return stop;
}

export function stillOpen(pending: Pick<Pending<unknown>, "state" | "rollback">, leftMs: number) {
  return pending.state === "pending" && pending.rollback !== null && leftMs > 0;
}
