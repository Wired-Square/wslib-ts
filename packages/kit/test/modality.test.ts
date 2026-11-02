import { expect, test, vi } from "vitest";

import { forcedColours, read } from "./css";

const html = document.documentElement;
const press = (init: KeyboardEventInit) => document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
const point = () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

test("outside WebKit, the kit leaves the input modality to the browser", async () => {
  vi.spyOn(navigator, "vendor", "get").mockReturnValue("Google Inc.");
  await import("../src/index");
  press({ key: "a" });
  point();
  expect(html.hasAttribute("data-app-modality")).toBe(false);
});

test("in WebKit, the kit's entry marks a key press as keyboard and a pointer press as pointer, ignoring Escape and chords", async () => {
  vi.resetModules();
  await import("../src/index");
  expect(html.hasAttribute("data-app-modality"), "nothing is assumed before the first press").toBe(false);
  press({ key: "Tab" });
  expect(html.getAttribute("data-app-modality")).toBe("keyboard");
  point();
  expect(html.getAttribute("data-app-modality")).toBe("pointer");
  for (const ignored of [{ key: "Escape" }, { key: "c", metaKey: true }, { key: "c", ctrlKey: true }, { key: "Meta", metaKey: true }]) {
    press(ignored);
    expect(html.getAttribute("data-app-modality"), JSON.stringify(ignored)).toBe("pointer");
  }
  const stopped = document.createElement("button");
  document.body.append(stopped);
  stopped.addEventListener("keydown", (e) => e.stopPropagation());
  stopped.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(html.getAttribute("data-app-modality"), "heard before a component stops it").toBe("keyboard");
  stopped.remove();
});

test("after a pointer press only a field keeps its ring, and forced colours keep every ring", () => {
  const css = read("kit.css");
  const quiet = css.indexOf(
    '\n:root[data-app-modality="pointer"] :focus-visible:not(input, textarea, select),\n' +
      ':root[data-app-modality="pointer"] .app-visually-hidden:focus-visible + .app-pick-file__label {\n' +
      "  --app-focus: 0 0 transparent;\n}",
  );
  expect(quiet).toBeGreaterThan(0);
  expect(forcedColours(css.slice(quiet))).toMatch(/:focus-visible[^{]*\{\s*outline: 2px solid Highlight;/);
  expect(read("../package.json")).toMatch(/"sideEffects": \[[^\]]*"\.\/src\/modality\.ts"/);
});
