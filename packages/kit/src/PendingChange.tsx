import { For, Show, createSignal, onCleanup, untrack } from "solid-js";
import type { JSX } from "solid-js";
import { refusalMessage, unanswered as nothingAnswered } from "@wired-square/kit/core";
import type { Pending } from "@wired-square/kit/core";

import { Badge } from "./Badge";
import { Button } from "./Button";
import { startCountdown, stillOpen } from "./countdown";
import { badge, rereadPacer, rereadsGoOn } from "./reread";

export interface PendingChangeProps<T> {
  /** Read once, at mount: remount it (`<Show when={…} keyed>`) to follow another change. */
  of: Pending<T>;
  /** Answers the same change, or throws. */
  reread: () => Promise<Pending<T>>;
  /** Offered as Keep while pending with a rollback. */
  confirm?: (() => Promise<Pending<T>>) | undefined;
  /** Offered as Undo while pending with a rollback. */
  rollBack?: (() => Promise<Pending<T>>) | undefined;
  describe: (change: T) => JSX.Element;
  /** Keep and Undo stay shown but cannot be clicked. */
  held?: boolean | undefined;
  /** Re-reads keep to each response's `check_after_ms` rather than backing off. */
  steady?: boolean | undefined;
  /** How soon to re-read after a first unanswered call in a row, counting only the newest call. */
  recheckUnansweredMs?: number | undefined;
  /** While pending, the badge reads "unknown". */
  outOfTouch?: boolean | undefined;
  /** Each response in a terminal state, never the mount's `of`. */
  onSettled?: (pending: Pending<T>) => void;
}

type Caller = "timer" | "reread" | "button";

/**
 * A change applied and not yet known to have taken, inline for a table cell.
 * It counts a rollback down from each response, re-reads while pending (see
 * `rereadPacer`), and on a terminal state or a refusal keeps only the
 * `standing` warnings.
 */
export function PendingChange<T>(props: PendingChangeProps<T>) {
  const first = untrack(() => props.of);
  const [latest, setLatest] = createSignal(first);
  const [leftMs, setLeftMs] = createSignal(0);
  const [failed, setFailed] = createSignal<{ why: string; answered: boolean }>();
  const [inFlight, setInFlight] = createSignal(0);

  let asked = 0;
  let landed = 0;
  let settledBefore = 0;
  let failures = 0;
  let unanswered = 0;
  const nextWait = rereadPacer();
  let mounted = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopCounting = () => {};
  const countDown = (pending: Pending<T>) => {
    stopCounting();
    stopCounting = startCountdown(pending.rollback?.in_ms ?? 0, setLeftMs);
  };
  countDown(first);
  onCleanup(() => {
    mounted = false;
    clearTimeout(timer);
    stopCounting();
  });

  const scheduleReread = (pending: Pending<T>) => {
    clearTimeout(timer);
    if (pending.state !== "pending" || pending.check_after_ms === null) return;
    const waitMs = nextWait(
      pending.check_after_ms,
      unanswered,
      props.steady,
      props.recheckUnansweredMs,
    );
    timer = setTimeout(() => void rereadNow(), waitMs);
  };

  let rereading = false;
  const rereadNow = async () => {
    if (rereading) return;
    clearTimeout(timer);
    rereading = true;
    try {
      await ask(props.reread, "timer");
    } finally {
      rereading = false;
    }
  };

  const ask = async (call: () => Promise<Pending<T>>, by: Caller) => {
    const mine = ++asked;
    if (by !== "timer") {
      clearTimeout(timer);
      setInFlight((n) => n + 1);
    }
    try {
      const next = await call();
      if (mine === asked) unanswered = 0;
      if (!mounted || mine < landed) return;
      if (next.state === "pending" && mine <= settledBefore) return;
      landed = mine;
      failures = 0;
      setFailed(undefined);
      setLatest(() => next);
      countDown(next);
      scheduleReread(next);
      if (next.state !== "pending") {
        settledBefore = asked;
        props.onSettled?.(next);
      }
    } catch (error) {
      const answered = !nothingAnswered(error);
      if (mine === asked) unanswered = answered ? 0 : unanswered + 1;
      if (!mounted || mine < landed || mine <= settledBefore) return;
      setFailed({ why: refusalMessage(error), answered });
      if (by !== "button") failures++;
      if (rereadsGoOn(failures, unanswered, props.recheckUnansweredMs)) scheduleReread(latest());
    } finally {
      if (mounted && by !== "timer") setInFlight((n) => n - 1);
    }
  };

  scheduleReread(first);
  const rereadWhenShown = () => {
    const now = latest();
    if (!document.hidden && now.state === "pending" && now.check_after_ms !== null) {
      void rereadNow();
    }
  };
  document.addEventListener("visibilitychange", rereadWhenShown);
  onCleanup(() => document.removeEventListener("visibilitychange", rereadWhenShown));

  const busy = () => inFlight() > 0;
  const timeUp = () =>
    latest().state === "pending" && latest().rollback !== null && leftMs() === 0;
  const marker = () => badge(latest(), leftMs(), props.outOfTouch ?? false);
  const warnings = () =>
    latest().warnings.filter(
      (w) => (latest().state === "pending" && !failed()?.answered) || w.scope === "standing",
    );

  return (
    <span class="app-pending">
      {props.describe(latest().change)}
      <Badge tone={marker()[0]}>
        {marker()[1]}
        <Show when={marker()[2]}>
          <span class="app-visually-hidden">: {marker()[2]}</span>
        </Show>
      </Badge>
      <Show when={stillOpen(latest(), leftMs())}>
        <Show when={props.confirm}>
          {(confirm) => (
            <Button
              tone="primary"
              pending={busy()}
              disabled={props.held}
              onClick={() => void ask(confirm(), "button")}
            >
              Keep
            </Button>
          )}
        </Show>
        <Show when={props.rollBack}>
          {(rollBack) => (
            <Button
              tone="plain"
              pending={busy()}
              disabled={props.held}
              onClick={() => void ask(rollBack(), "button")}
            >
              Undo
            </Button>
          )}
        </Show>
      </Show>
      <Show when={latest().state === "expired" || timeUp() || failed()}>
        <Button tone="plain" pending={busy()} onClick={() => void ask(props.reread, "reread")}>
          Read again
        </Button>
      </Show>
      <Show when={failed()}>
        {(failure) => (
          <span class="app-pending__failed">
            <Show
              when={failure().answered}
              fallback={
                <>
                  not answered<span class="app-visually-hidden">: {failure().why}</span>
                </>
              }
            >
              refused: {failure().why}
            </Show>
          </span>
        )}
      </Show>
      <Show when={warnings().length > 0}>
        <span class="app-pending__warnings">
          <For each={warnings()}>{(w, i) => <>{i() > 0 && " · "}{w.text}</>}</For>
        </span>
      </Show>
    </span>
  );
}
