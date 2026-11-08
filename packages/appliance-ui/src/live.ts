/**
 * Keeping a screen current without asking on every event.
 *
 * `useFeed` says when something happened; these two say when to look again.
 * A feed makes a screen live rather than authoritative — a lagged receiver
 * skips events — so a screen folding one keeps a timer behind it, and a burst
 * of events is one refetch rather than thirty.
 */
import { onCleanup } from "solid-js";

/**
 * Re-read on a timer, cleared with the screen. A hidden tab has no reader, so
 * the timer stops while it is hidden, and showing it re-reads once.
 *
 * The mechanism is shared; the *reason* is not, and stays at each call site —
 * rows added from another browser, a feed that may have skipped.
 */
export function useRefresh(refetch: () => unknown, ms = 10_000): void {
  const page = globalThis.document;
  let timer: ReturnType<typeof setInterval> | undefined;
  const start = () => (timer = setInterval(() => void refetch(), ms));
  const followVisibility = () => {
    clearInterval(timer);
    if (page.visibilityState === "hidden") return;
    void refetch();
    start();
  };
  if (page?.visibilityState !== "hidden") start();
  page?.addEventListener("visibilitychange", followVisibility);
  onCleanup(() => {
    clearInterval(timer);
    page?.removeEventListener("visibilitychange", followVisibility);
  });
}

/**
 * Collapse a burst of calls into one, trailing.
 *
 * Each feed event arrives in its own `EventSource` callback — a separate
 * macrotask, so Solid does not batch them. Trailing rather than leading: the
 * last event of a storm is the one whose state the screen should end up
 * showing.
 */
export function debounced(run: () => void, ms = 750): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  return () => {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
}
