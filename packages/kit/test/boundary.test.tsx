import { ErrorBoundary, createSignal } from "solid-js";
import { expect, test } from "vitest";

import { Refusal, ScreenBoundary } from "../src/index";
import { button, mount } from "../src/testing";

const BOUNDARY = "the app's boundary caught";

/** A screen failing until `failing` is false, in a `ScreenBoundary` on a path the test moves, inside the app's boundary. */
function bounded(unanswered: boolean) {
  const [pathname, setPathname] = createSignal("/settings/backup");
  const state = { failing: true };
  const Screen = () => {
    if (state.failing) throw new Refusal("the server is restarting", { unanswered });
    return "the screen";
  };
  const root = mount(() => (
    <ErrorBoundary fallback={(error) => `${BOUNDARY} ${String(error)}`}>
      <ScreenBoundary pathname={pathname}>
        <Screen />
      </ScreenBoundary>
    </ErrorBoundary>
  ));
  return { root, state, setPathname };
}

test("a screen's failure is shown in its place, and Try again shows the screen once it answers", () => {
  const { root, state } = bounded(false);
  expect(root.textContent).toBe("the server is restarting Try again");
  state.failing = false;
  button("Try again").click();
  expect(root.textContent).toBe("the screen");
});

test("a screen's failure clears when the path changes, and not before", () => {
  const { root, state, setPathname } = bounded(false);
  state.failing = false;
  expect(root.textContent).toBe("the server is restarting Try again");
  setPathname("/settings/about");
  expect(root.textContent).toBe("the screen");
});

test("a request nothing answered goes on to the boundary around the app", () => {
  const { root } = bounded(true);
  expect(root.textContent).toMatch(new RegExp(`^${BOUNDARY}`));
});

test("a ScreenBoundary given no path still offers Try again", () => {
  const state = { failing: true };
  const Screen = () => {
    if (state.failing) throw new Refusal("the vault is locked");
    return "the screen";
  };
  const root = mount(() => (
    <ScreenBoundary>
      <Screen />
    </ScreenBoundary>
  ));
  expect(root.textContent).toBe("the vault is locked Try again");
  state.failing = false;
  button("Try again").click();
  expect(root.textContent).toBe("the screen");
});
