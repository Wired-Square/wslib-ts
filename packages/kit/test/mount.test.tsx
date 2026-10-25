import { createContext, useContext } from "solid-js";
import type { JSX } from "solid-js";
import { expect, test } from "vitest";

import { mount } from "../src/testing";

const Layer = createContext<string[]>([]);
const Within = (props: { name: string; children: JSX.Element }) => (
  <Layer.Provider value={[...useContext(Layer), props.name]}>{props.children}</Layer.Provider>
);
const Layers = () => <p>{useContext(Layer).join(" > ")}</p>;
const around = (view: () => JSX.Element) => <Within name="session">{view()}</Within>;

test("around goes outside wrap's view, and mount still returns the element", () => {
  const root = mount(() => <Layers />, { wrap: (screen) => <Within name="router">{screen()}</Within>, around });
  expect(root.textContent).toBe("session > router");
});

test("around goes outside a yielding wrap's view, and mount still returns what it yields", () => {
  const history = mount(() => <Layers />, {
    wrap: (screen) => ({ view: <Within name="router">{screen()}</Within>, yields: ["/"] }),
    around,
  });
  expect(history).toEqual(["/"]);
  expect(document.body.textContent).toBe("session > router");
});

test("around with no wrap goes straight around the screen", () => {
  expect(mount(() => <Layers />, { around }).textContent).toBe("session");
});
