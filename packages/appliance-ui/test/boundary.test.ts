import assert from "node:assert/strict";
import { test } from "node:test";

import { BOUNDARY, click, load, mount, settled, textOf } from "./mount.ts";

/** A screen failing with `status` until `failing` is false, in a `ScreenBoundary` on a path the test moves. */
async function bounded(status: number) {
  const { ScreenBoundary } = await load<typeof import("@wired-square/kit")>("@wired-square/kit");
  const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  const { createComponent, createSignal } = await load<typeof import("solid-js")>("solid-js");
  const [pathname, setPathname] = createSignal("/settings/backup");
  const state = { failing: true };
  const screen = () => {
    if (state.failing) throw new ApiError(status, "the daemon is restarting", true);
    return "the screen";
  };
  const { root } = await mount(
    () =>
      createComponent(ScreenBoundary, {
        pathname,
        get children() {
          return createComponent(screen, {});
        },
      }),
    () => undefined,
  );
  return { root, state, setPathname };
}

test("A screen's failure is shown in its place, and Try again shows the screen once it answers", async () => {
  const { root, state } = await bounded(503);
  assert.equal(textOf(root), "the daemon is restarting Try again");
  state.failing = false;
  await click(root, "Try again");
  assert.equal(textOf(root), "the screen");
});

test("A screen's failure clears when the path changes, and not before", async () => {
  const { root, state, setPathname } = await bounded(503);
  state.failing = false;
  await settled();
  assert.equal(textOf(root), "the daemon is restarting Try again");
  setPathname("/settings/about");
  await settled();
  assert.equal(textOf(root), "the screen");
});

test("A request nothing answered goes on to the boundary around the product", async () => {
  const { root } = await bounded(0);
  assert.match(textOf(root), new RegExp(`^${BOUNDARY}`));
});
