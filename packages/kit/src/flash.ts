import { createSignal, getOwner, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

/** `on` turns true for `ms` once a promise given to `flashAfter` resolves; `flashAfter` hands back that promise's outcome. */
export function createFlash(ms = 2_000): [on: Accessor<boolean>, flashAfter: <T>(promise: Promise<T>) => Promise<T>] {
  const [on, setOn] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let live = true;
  if (getOwner())
    onCleanup(() => {
      live = false;
      clearTimeout(timer);
    });

  const flashAfter = async <T,>(promise: Promise<T>) => {
    const value = await promise;
    if (live) {
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), ms);
    }
    return value;
  };

  return [on, flashAfter];
}
