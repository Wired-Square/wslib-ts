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
 * Re-read on a timer, cleared with the screen.
 *
 * The mechanism is shared; the *reason* is not, and stays at each call site —
 * rows added from another browser, a feed that may have skipped.
 */
export function useRefresh(refetch: () => unknown, ms = 10_000): void {
  const timer = setInterval(() => void refetch(), ms);
  onCleanup(() => clearInterval(timer));
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
