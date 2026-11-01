import { createStore, shallow } from "@wired-square/store";
import { describe, expect, it, vi } from "vitest";

const counterStore = () => createStore<{ count: number; label: string }>(() => ({ count: 0, label: "a" }));

describe("createStore", () => {
  it("shallow-merges a partial into a new state object", () => {
    const store = counterStore();
    const before = store.getState();
    store.setState({ count: 1 });
    expect(store.getState()).toEqual({ count: 1, label: "a" });
    expect(store.getState()).not.toBe(before);
    expect(before).toEqual({ count: 0, label: "a" });
  });

  it("passes the current state to an updater and merges what it returns", () => {
    const store = counterStore();
    store.setState({ count: 2 });
    store.setState((s) => ({ count: s.count + 1 }));
    expect(store.getState()).toEqual({ count: 3, label: "a" });
  });

  it("hands set and get to the initialiser", () => {
    const store = createStore<{ count: number; bump: () => number }>((set, get) => ({
      count: 0,
      bump: () => {
        set((s) => ({ count: s.count + 1 }));
        return get().count;
      },
    }));
    expect(store.getState().bump()).toBe(1);
    expect(store.getState().count).toBe(1);
  });

  it("returns undefined from get while the initialiser runs", () => {
    let during: unknown = "unread";
    createStore<{ count: number }>((_set, get) => {
      during = get();
      return { count: 0 };
    });
    expect(during).toBeUndefined();
  });

  it("skips the update and notification when the updater returns the current state", () => {
    const store = counterStore();
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState((s) => s);
    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("still notifies for an equal-valued partial, as only identity is checked", () => {
    const store = counterStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ count: 0 });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("calls listeners with the new state and the previous one", () => {
    const store = counterStore();
    const prev = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ label: "b" });
    expect(listener).toHaveBeenCalledWith(store.getState(), prev);
  });

  it("stops notifying once unsubscribed", () => {
    const store = counterStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setState({ count: 1 });
    unsubscribe();
    store.setState({ count: 2 });
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("shallow", () => {
  it("compares primitives by Object.is", () => {
    expect(shallow(1, 1)).toBe(true);
    expect(shallow(NaN, NaN)).toBe(true);
    expect(shallow(0, -0)).toBe(false);
    expect(shallow<unknown>("a", 1)).toBe(false);
    expect(shallow<unknown>(null, {})).toBe(false);
  });

  it("compares plain objects by their own keys, one level deep", () => {
    const inner = { x: 1 };
    expect(shallow({ a: 1, b: inner }, { a: 1, b: inner })).toBe(true);
    expect(shallow({ a: 1, b: inner }, { a: 1, b: { x: 1 } })).toBe(false);
    expect(shallow<object>({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallow<object>({ a: undefined }, { b: undefined })).toBe(false);
  });

  it("compares arrays by position", () => {
    expect(shallow([1, "a"], [1, "a"])).toBe(true);
    expect(shallow([1, 2], [2, 1])).toBe(false);
    expect(shallow([1], [1, 2])).toBe(false);
  });

  it("compares Maps by entry and Sets by member, in any order", () => {
    expect(shallow(new Map([["a", 1], ["b", 2]]), new Map([["b", 2], ["a", 1]]))).toBe(true);
    expect(shallow(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
    expect(shallow(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(shallow(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });

  it("tells apart values of different kinds with the same contents", () => {
    expect(shallow<object>([1], { 0: 1 })).toBe(false);
    expect(shallow<object>(new Map(), new Set())).toBe(false);
  });

  it("compares other iterables in order", () => {
    function* count(n: number) {
      for (let i = 0; i < n; i++) yield i;
    }
    expect(shallow(count(2), count(2))).toBe(true);
    expect(shallow(count(2), count(3))).toBe(false);
  });
});
