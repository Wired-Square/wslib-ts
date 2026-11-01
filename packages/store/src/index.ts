type Update<S> = Partial<S> | ((state: S) => Partial<S>);
type Listener<S> = (state: S, prev: S) => void;

export type Store<S> = {
  getState: () => S;
  setState: (update: Update<S>) => void;
  subscribe: (listener: Listener<S>) => () => void;
};

/** A store whose `setState` shallow-merges each update into a new state, skipping one that returns the state itself. */
export function createStore<S extends object>(init: (set: Store<S>["setState"], get: () => S) => S): Store<S> {
  let state: S;
  const listeners = new Set<Listener<S>>();
  const getState = () => state;
  const setState = (update: Update<S>) => {
    const next = typeof update === "function" ? update(state) : update;
    if (Object.is(next, state)) return;
    const prev = state;
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state, prev));
  };
  const subscribe = (listener: Listener<S>) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  state = init(setState, getState);
  return { getState, setState, subscribe };
}

/** Whether two values are identical, or hold identical values: plain objects by own key, arrays, Maps and Sets. */
export function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || !a || typeof b !== "object" || !b) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const [x, y] = [keyed(a), keyed(b)];
  if (x && y) return x.size === y.size && [...x].every(([key, value]) => y.has(key) && Object.is(value, y.get(key)));
  return sameSequence(a, b);
}

function keyed(value: object): Map<unknown, unknown> | undefined {
  if (!(Symbol.iterator in value)) return new Map(Object.entries(value));
  if (value instanceof Map) return value;
  const { entries } = value as { entries?: () => Iterable<readonly [unknown, unknown]> };
  return typeof entries === "function" ? new Map(entries.call(value)) : undefined;
}

function sameSequence(a: object, b: object): boolean {
  const [left, right] = [(a as Iterable<unknown>)[Symbol.iterator](), (b as Iterable<unknown>)[Symbol.iterator]()];
  for (;;) {
    const [l, r] = [left.next(), right.next()];
    if (l.done || r.done) return !!l.done && !!r.done;
    if (!Object.is(l.value, r.value)) return false;
  }
}
