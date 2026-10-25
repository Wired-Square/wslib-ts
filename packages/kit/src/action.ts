import { createSignal, getOwner, onCleanup } from "solid-js";
import { refusalMessage } from "@wired-square/kit/core";

export interface Action {
  pending: () => boolean;
  /** Cleared by a success rather than by the next attempt, so a timed refetch does not blink it. */
  failed: () => string | undefined;
  /** The sentence given to `succeed`, for four seconds or until the next run. */
  succeeded: () => string | undefined;
  succeed: (sentence: string) => void;
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
  const [succeeded, setSucceeded] = createSignal<string | undefined>();
  let generation = 0;
  let fading: ReturnType<typeof setTimeout> | undefined;
  const fade = () => {
    clearTimeout(fading);
    setSucceeded(undefined);
  };
  const succeed = (sentence: string) => {
    fade();
    setSucceeded(sentence);
    fading = setTimeout(fade, 4_000);
  };
  if (getOwner()) onCleanup(() => clearTimeout(fading));

  const run = async <R,>(act: () => Promise<R> | R, then?: (result: R) => void) => {
    // A disabled control can still be reached by a keyboard repeat, or a caller that never bound `pending`.
    if (pending() && !options.supersede) return;

    const mine = ++generation;
    setPending(true);
    fade();
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

  return { pending, failed, succeeded, succeed, run };
}
