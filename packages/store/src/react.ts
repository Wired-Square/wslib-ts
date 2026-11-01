import { useRef, useSyncExternalStore } from "react";

import { createStore, shallow } from "./index.js";
import type { Store } from "./index.js";

/** `create`'s hook, which is also its store. */
export type StoreHook<S> = Store<S> & (<T = S>(selector?: (state: S) => T, equals?: (a: T, b: T) => boolean) => T);

const whole = <S, T>(state: S) => state as unknown as T;

/** The store's selection, re-rendering only when `equals` says it changed; the whole state without a selector. */
export function useStore<S, T = S>(
  store: Pick<Store<S>, "getState" | "subscribe">,
  selector: (state: S) => T = whole,
  equals: (a: T, b: T) => boolean = Object.is,
): T {
  const last = useRef<{ state: S; selector: (state: S) => T; selection: T }>(undefined);
  const select = () => {
    const state = store.getState();
    const cached = last.current;
    if (cached && Object.is(cached.state, state) && cached.selector === selector) return cached.selection;
    const next = selector(state);
    const selection = cached && equals(cached.selection, next) ? cached.selection : next;
    last.current = { state, selector, selection };
    return selection;
  };
  return useSyncExternalStore(store.subscribe, select, select);
}

/** A store and a hook reading it in one: `useCounter((s) => s.count)`, `useCounter.getState()`. */
export function create<S extends object>(init: Parameters<typeof createStore<S>>[0]): StoreHook<S> {
  const store = createStore(init);
  return Object.assign(<T = S>(selector?: (state: S) => T, equals?: (a: T, b: T) => boolean) => useStore(store, selector, equals), store);
}

/** A selector that keeps its previous result while the next is `shallow`-equal, for selectors that build objects or arrays. */
export function useShallow<S, T>(selector: (state: S) => T): (state: S) => T {
  const prev = useRef<T>(undefined);
  return (state) => {
    const next = selector(state);
    return shallow(prev.current, next) ? (prev.current as T) : (prev.current = next);
  };
}
