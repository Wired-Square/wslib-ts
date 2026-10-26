import { createRoot } from "solid-js";
import { expect, test, vi } from "vitest";

import { createFlash } from "../src/index";

function rooted(ms?: number) {
  return createRoot((dispose) => {
    const [on, flashAfter] = createFlash(ms);
    return { on, flashAfter, dispose };
  });
}

test("a flash turns on once its promise resolves, hands back the value, and turns off after two seconds", async () => {
  vi.useFakeTimers();
  const { on, flashAfter } = rooted();
  let land!: (value: string) => void;
  const flashed = flashAfter(new Promise<string>((resolve) => (land = resolve)));
  await Promise.resolve();
  expect(on()).toBe(false);
  land("written");
  expect(await flashed).toBe("written");
  expect(on()).toBe(true);
  vi.advanceTimersByTime(1_999);
  expect(on()).toBe(true);
  vi.advanceTimersByTime(1);
  expect(on()).toBe(false);
});

test("a rejected promise leaves the flash off and reaches the caller", async () => {
  vi.useFakeTimers();
  const { on, flashAfter } = rooted();
  await expect(flashAfter(Promise.reject(new Error("not allowed")))).rejects.toThrow("not allowed");
  expect(on()).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

test("flashing again restarts the timer", async () => {
  vi.useFakeTimers();
  const { on, flashAfter } = rooted(1_000);
  await flashAfter(Promise.resolve());
  vi.advanceTimersByTime(800);
  await flashAfter(Promise.resolve());
  vi.advanceTimersByTime(800);
  expect(on()).toBe(true);
  vi.advanceTimersByTime(200);
  expect(on()).toBe(false);
});

test("disposing the owner clears the timer, and a promise landing afterwards starts none", async () => {
  vi.useFakeTimers();
  const { flashAfter, dispose } = rooted();
  await flashAfter(Promise.resolve());
  expect(vi.getTimerCount()).toBe(1);
  let land!: () => void;
  const late = flashAfter(new Promise<void>((resolve) => (land = resolve)));
  dispose();
  expect(vi.getTimerCount()).toBe(0);
  land();
  await late;
  expect(vi.getTimerCount()).toBe(0);
});
