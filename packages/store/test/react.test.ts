import { createStore } from "@wired-square/store";
import { create, useShallow, useStore } from "@wired-square/store/react";
import { StrictMode, act, createElement as h } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});

function render(view: ReactNode) {
  const element = document.createElement("div");
  const root = createRoot(element);
  roots.push(root);
  act(() => root.render(h(StrictMode, null, view)));
  return element;
}

type Counter = { count: number; label: string; bump: () => void };
const counter = () =>
  create<Counter>((set) => ({ count: 0, label: "a", bump: () => set((s) => ({ count: s.count + 1 })) }));

function Probe<T>({ read, show }: { read: () => T; show: (value: T) => string }) {
  probed();
  return h("p", null, show(read()));
}
const probed = vi.fn();
afterEach(() => probed.mockClear());
const renders = () => probed.mock.calls.length;

test("useStore follows the store and re-renders only when the selection changes", () => {
  const store = createStore<{ count: number; label: string }>(() => ({ count: 0, label: "a" }));
  const element = render(h(Probe<number>, { read: () => useStore(store, (s) => s.count), show: String }));
  expect(element.textContent).toBe("0");
  const before = renders();
  act(() => store.setState({ label: "b" }));
  expect(renders()).toBe(before);
  act(() => store.setState({ count: 4 }));
  expect(element.textContent).toBe("4");
  expect(renders()).toBeGreaterThan(before);
});

test("useStore holds a selection its equality calls unchanged", () => {
  const store = createStore<{ count: number; label: string }>(() => ({ count: 0, label: "a" }));
  const element = render(
    h(Probe<readonly number[]>, {
      read: () => useStore(store, (s) => [s.count] as const, (a, b) => a[0] === b[0]),
      show: (pair) => pair.join(),
    }),
  );
  const before = renders();
  act(() => store.setState({ label: "b" }));
  expect(renders()).toBe(before);
  act(() => store.setState({ count: 1 }));
  expect(element.textContent).toBe("1");
});

test("create's hook selects, and with no selector gives the whole state", () => {
  const useCounter = counter();
  const element = render([
    h(Probe<number>, { key: "count", read: () => useCounter((s) => s.count), show: (n) => `count ${n};` }),
    h(Probe<Counter>, { key: "whole", read: () => useCounter(), show: (s) => `whole ${s.count}${s.label}` }),
  ]);
  expect(element.textContent).toBe("count 0;whole 0a");
  act(() => useCounter.getState().bump());
  expect(element.textContent).toBe("count 1;whole 1a");
});

test("create's hook carries the store's getState, setState and subscribe", () => {
  const useCounter = counter();
  const listener = vi.fn();
  const unsubscribe = useCounter.subscribe(listener);
  const prev = useCounter.getState();
  useCounter.setState({ label: "b" });
  expect(listener).toHaveBeenCalledWith(useCounter.getState(), prev);
  unsubscribe();
  useCounter.setState((s) => ({ count: s.count + 2 }));
  expect(useCounter.getState()).toMatchObject({ count: 2, label: "b" });
  expect(listener).toHaveBeenCalledOnce();
});

test("useShallow keeps a fresh but equal object, so an unrelated change does not re-render", () => {
  const useCounter = counter();
  const element = render(
    h(Probe<{ count: number }>, {
      read: () => useCounter(useShallow((s) => ({ count: s.count }))),
      show: ({ count }) => String(count),
    }),
  );
  const before = renders();
  act(() => useCounter.setState({ label: "b" }));
  expect(renders()).toBe(before);
  act(() => useCounter.setState({ count: 3 }));
  expect(element.textContent).toBe("3");
});

test("a selector building a fresh object each call settles rather than looping", () => {
  const useCounter = counter();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const element = render(
    h(Probe<{ count: number }>, { read: () => useCounter((s) => ({ count: s.count })), show: ({ count }) => String(count) }),
  );
  act(() => useCounter.setState({ count: 2 }));
  expect(element.textContent).toBe("2");
  expect(renders()).toBeLessThan(10);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
