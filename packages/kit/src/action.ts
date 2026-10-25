import { createSignal } from "solid-js";

import { refusalMessage } from "./refusal";

export interface Action {
  pending: () => boolean;
  /** Cleared by a success rather than by the next attempt, so a timed refetch does not blink it. */
  failed: () => string | undefined;
  /** `then` runs only when `act` resolves. */
  run: <R>(act: () => Promise<R> | R, then?: (result: R) => void) => Promise<void>;
}

export interface ActionOptions {
  /** A `run` while one is pending takes over, and the earlier one lands nothing; by default it is dropped. */
  supersede?: boolean;
}

export function createAction(options: ActionOptions = {}): Action {
  const [pending, setPending] = createSignal(false);
  const [failed, setFailed] = createSignal<string | undefined>();
  let generation = 0;

  const run = async <R,>(act: () => Promise<R> | R, then?: (result: R) => void) => {
    // A disabled control can still be reached by a keyboard repeat, or a caller that never bound `pending`.
    if (pending() && !options.supersede) return;

    const mine = ++generation;
    setPending(true);
    try {
      const result = await act();
      if (mine !== generation) return;
      setFailed(undefined);
      then?.(result);
    } catch (error) {
      if (mine === generation) setFailed(refusalMessage(error));
    } finally {
      if (mine === generation) setPending(false);
    }
  };

  return { pending, failed, run };
}
