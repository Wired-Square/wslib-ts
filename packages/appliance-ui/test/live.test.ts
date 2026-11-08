import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { load } from "./mount.ts";

/** A `document` whose visibility the test sets, announcing each change as a browser does. */
class Page extends EventTarget {
  visibilityState: DocumentVisibilityState;

  constructor(state: DocumentVisibilityState) {
    super();
    this.visibilityState = state;
  }

  show(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

afterEach(() => {
  mock.timers.reset();
  Reflect.deleteProperty(globalThis, "document");
});

/** `useRefresh` under an owner the test disposes, on a page shown as `state`, counting its reads. */
async function refreshing(state: DocumentVisibilityState) {
  const { useRefresh } = await load<typeof import("../src/live.ts")>("/src/live.ts");
  const { createRoot } = await load<typeof import("solid-js")>("solid-js");
  const page = new Page(state);
  Object.assign(globalThis, { document: page });
  mock.timers.enable({ apis: ["setInterval"] });
  let reads = 0;
  const dispose = createRoot((dispose) => {
    useRefresh(() => reads++, 1_000);
    return dispose;
  });
  return { page, reads: () => reads, dispose };
}

test("useRefresh stops its timer while the tab is hidden, and re-reads once when it is shown", async () => {
  const { page, reads, dispose } = await refreshing("visible");
  mock.timers.tick(2_000);
  assert.equal(reads(), 2);

  page.show("hidden");
  mock.timers.tick(5_000);
  assert.equal(reads(), 2, "a hidden tab is not read");

  page.show("visible");
  assert.equal(reads(), 3, "shown, it reads at once");
  mock.timers.tick(1_000);
  assert.equal(reads(), 4, "and the timer runs again");

  dispose();
  page.show("visible");
  mock.timers.tick(5_000);
  assert.equal(reads(), 4, "the timer and the listener go with the screen");
});

test("useRefresh on a screen mounted hidden starts its timer only once the tab is shown", async () => {
  const { page, reads, dispose } = await refreshing("hidden");
  mock.timers.tick(5_000);
  assert.equal(reads(), 0);

  page.show("visible");
  mock.timers.tick(1_000);
  assert.equal(reads(), 2);
  dispose();
});
