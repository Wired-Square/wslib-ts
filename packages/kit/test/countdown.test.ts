import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { startCountdown, stillOpen } from "../src/countdown";

const THREE_MINUTES = 180_000;

let shown: number[];
const show = (left: number) => void shown.push(left);
const last = () => shown.at(-1);
const visibilityChanges = () => document.dispatchEvent(new Event("visibilitychange"));

beforeEach(() => {
  shown = [];
  vi.useFakeTimers({ now: 1_000_000 });
});

afterEach(() => vi.useRealTimers());

test("a hidden tab whose ticks never came shows the time left as soon as it is shown", () => {
  const stop = startCountdown(THREE_MINUTES, show);
  expect(last()).toBe(THREE_MINUTES);

  vi.advanceTimersByTime(1_000);
  vi.setSystemTime(Date.now() + 42_000);
  visibilityChanges();
  stop();

  expect(last(), "the throttled ticks are not what it counts").toBe(THREE_MINUTES - 43_000);
});

test("at the deadline it shows 0 and stops, and the change can no longer be kept or undone", () => {
  const stop = startCountdown(THREE_MINUTES, show);
  const pending = { state: "pending", rollback: { in_ms: THREE_MINUTES } } as const;
  expect(stillOpen(pending, last() ?? 0)).toBe(true);

  vi.setSystemTime(Date.now() + THREE_MINUTES + 5_000);
  visibilityChanges();
  expect(last()).toBe(0);
  expect(stillOpen(pending, last() ?? 0), "Keep and the way there go at time up").toBe(false);

  const count = shown.length;
  vi.advanceTimersByTime(5_000);
  visibilityChanges();
  expect(shown.length, "a finished countdown was still running").toBe(count);
  stop();
});

test("only a pending change with a rollback is open", () => {
  const rollback = { in_ms: 1 };
  expect(stillOpen({ state: "pending", rollback }, 1)).toBe(true);
  expect(stillOpen({ state: "pending", rollback: null }, 1)).toBe(false);
  expect(stillOpen({ state: "rolled_back", rollback }, 1)).toBe(false);
});
