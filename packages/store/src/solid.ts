import { createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";

import type { Store } from "./index.js";

/** A signal of the store's selection, notifying only when `equals` says it changed; unsubscribes with its owner. */
export function fromStore<S, T>(
  store: Pick<Store<S>, "getState" | "subscribe">,
  selector: (state: S) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): Accessor<T> {
  const [value, setValue] = createSignal(selector(store.getState()), { equals });
  onCleanup(store.subscribe((state) => setValue(() => selector(state))));
  return value;
}
