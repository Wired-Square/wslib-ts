import type { Tone } from "./Notice";

export type Rollback = { in_ms: number };

export type WarningScope = "this_change" | "standing";

export type Warning = { text: string; scope: WarningScope };

export type SettledBy = "operator" | "read_back";

/** A change, where it stands, and when to look again. `check_after_ms` is a hint, `null` once terminal. */
export type Pending<T> = {
  change: T;
  check_after_ms: number | null;
  /** Present only where not confirming undoes the change. */
  rollback: Rollback | null;
  warnings: Array<Warning>;
} & ({ state: "pending" } | { state: "settled"; by: SettledBy } | { state: "rolled_back" } | { state: "expired" });

const SHORTEST_WAIT_MS = 1_000;
const LONGEST_WAIT_MS = 15_000;
const FAILURES_BEFORE_STOPPING = 3;

/**
 * The wait before each next re-read: backing off to 15 s or the hint,
 * whichever is longer, or the hint when `steady`, and `recheckUnansweredMs`
 * after a first unanswered call in a row.
 */
export function rereadPacer() {
  let waitMs = 0;
  return (hintMs: number, unanswered: number, steady = false, recheckUnansweredMs?: number) => {
    if (unanswered === 1 && recheckUnansweredMs !== undefined) return recheckUnansweredMs;
    const grown = Math.min(Math.max(waitMs * 1.5, SHORTEST_WAIT_MS), LONGEST_WAIT_MS);
    waitMs = steady ? hintMs : Math.max(hintMs, grown);
    return waitMs;
  };
}

/** Re-reads go on until three fail in a row, bar the recheck after a first unanswered call. */
export function rereadsGoOn(failures: number, unanswered: number, recheckUnansweredMs: number | undefined) {
  const recheck = unanswered === 1 && recheckUnansweredMs !== undefined;
  return failures < FAILURES_BEFORE_STOPPING || recheck;
}

/** The badge's tone, its word, and what a screen reader hears after it. */
export function badge(pending: Pending<unknown>, leftMs: number, outOfTouch: boolean): [Tone, string, string] {
  switch (pending.state) {
    case "pending":
      if (outOfTouch) return ["warn", "unknown", "This page has stopped getting answers about it."];
      if (pending.rollback === null) {
        return ["neutral", "confirming…", "Applied; not yet seen to take."];
      }
      if (leftMs === 0) return ["warn", "time up", "Read it again to see whether it was undone."];
      return ["neutral", `undone in ${clock(leftMs)}`, "Unless it is kept."];
    case "settled":
      return pending.by === "operator"
        ? ["good", "kept", "Confirmed by hand."]
        : ["good", "confirmed", "Read back from the device."];
    case "rolled_back":
      return ["warn", "rolled back", "The previous settings are back."];
    case "expired":
      return ["warn", "unconfirmed", "Still applied, and never seen to take."];
    default:
      return ["neutral", (pending as { state: string }).state, ""];
  }
}

function clock(leftMs: number) {
  const s = Math.ceil(leftMs / 1_000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
