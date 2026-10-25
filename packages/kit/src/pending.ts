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
