# @wired-square/store

A small state store: framework-free compiled JavaScript, with a Solid signal and a React hook over it. Its semantics
are zustand's vanilla store's, without middleware or a replace mode.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/store
```

## Entry points

| Subpath | What |
|---|---|
| `.` | `createStore`, `shallow` and the `Store` type |
| `./solid` | `fromStore`, a signal of a selection |
| `./react` | `useStore`, `create` and `useShallow` for React 19 |

Each is compiled JavaScript with types.

## The store

```ts
import { createStore } from "@wired-square/store";

const counter = createStore<{ count: number; label: string; bump: () => void }>((set) => ({
  count: 0,
  label: "",
  bump: () => set((s) => ({ count: s.count + 1 })),
}));

counter.getState().bump();
const unsubscribe = counter.subscribe((state, prev) => console.log(prev.count, "->", state.count));
counter.setState({ count: 10 });
```

`setState` takes a partial state, or a function of the current state returning one. A result identical to the current
state (`Object.is`) is dropped; anything else is shallow-merged into a new state object, and each listener is called
with the new state and the previous one. Only identity is checked, so an equal-valued partial still notifies. `get()`
returns `undefined` while the initialiser runs.

`shallow(a, b)` is true when the two are `Object.is`, or are of one kind and hold `Object.is` values: plain objects by
their own keys, arrays and other iterables in order, Maps by entry and Sets by member.

## Solid

```ts
import { shallow } from "@wired-square/store";
import { fromStore } from "@wired-square/store/solid";

const count = fromStore(counter, (s) => s.count); // Accessor<number>
const pair = fromStore(counter, (s) => [s.count, s.label], shallow);
```

The signal changes only when the selection does, by `Object.is` or the equality given. It unsubscribes when its owner
is disposed.

## React

```tsx
import { shallow } from "@wired-square/store";
import { create, useShallow, useStore } from "@wired-square/store/react";

const useCounter = create<{ count: number; label: string; bump: () => void }>((set) => ({
  count: 0,
  label: "",
  bump: () => set((s) => ({ count: s.count + 1 })),
}));

const count = useCounter((s) => s.count);
const all = useCounter();
const { label } = useCounter(useShallow((s) => ({ label: s.label })));
useCounter.getState().bump();
useStore(otherStore, (s) => s.items, shallow);
```

`create` returns a hook that is also its store, with `getState`, `setState` and `subscribe`. The hook, like
`useStore`, re-renders only when its selection changes, by `Object.is` or the equality given, and with no selector
returns the whole state. `useShallow` wraps a selector so that a fresh object or array equal by `shallow` to the last
keeps the last. A selector that builds a fresh object each call still settles without `useShallow`, but re-renders on
every change to the store.

## Peers

- `solid-js` ^1.9.11, optional, for `./solid`.
- `react` ^19.0.0, optional, for `./react`.

`.` needs neither.
