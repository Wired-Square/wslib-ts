import { createRoot, createSignal } from "solid-js";
import { expect, test, vi } from "vitest";

import { Refusal, createAction } from "../src/index";

function rooted() {
  return createRoot((dispose) => ({ action: createAction(), dispose }));
}

test("succeed sets the success sentence, which clears after four seconds", async () => {
  vi.useFakeTimers();
  const { action } = rooted();
  await action.run(
    () => 3,
    (n) => action.succeed(`Revoked ${n}`),
  );
  expect(action.succeeded()).toBe("Revoked 3");
  vi.advanceTimersByTime(3_999);
  expect(action.succeeded()).toBe("Revoked 3");
  vi.advanceTimersByTime(1);
  expect(action.succeeded()).toBeUndefined();
});

test("a success clears when the next run starts, and a setter's returned string is no success", async () => {
  vi.useFakeTimers();
  const { action } = rooted();
  await action.run(
    () => {},
    () => action.succeed("Saved"),
  );
  const [name, setName] = createSignal("");
  let finish!: (value: string) => void;
  const next = action.run(() => new Promise<string>((resolve) => (finish = resolve)), setName);
  expect(action.succeeded()).toBeUndefined();
  finish("admin");
  await next;
  expect([name(), action.succeeded()]).toEqual(["admin", undefined]);
});

test("a success's timer is cleared when its owner is disposed", () => {
  vi.useFakeTimers();
  const { action, dispose } = rooted();
  action.succeed("Saved");
  expect(vi.getTimerCount()).toBe(1);
  dispose();
  expect(vi.getTimerCount()).toBe(0);
});

test("failed is set only once the body has settled", async () => {
  const { action } = rooted();
  let refuse!: (error: Error) => void;
  const running = action.run(() => new Promise<void>((_, reject) => (refuse = reject)));
  expect([action.pending(), action.failed()]).toEqual([true, undefined]);
  refuse(new Refusal("the vault is locked"));
  await running;
  expect([action.pending(), action.failed()]).toEqual([false, "the vault is locked"]);
});
