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

test("a shim with a document but no navigator.vendor loads the kit", async () => {
  vi.resetModules();
  vi.spyOn(navigator, "vendor", "get").mockReturnValue(undefined as unknown as string);
  await expect(import("../src/index")).resolves.toBeDefined();
  vi.restoreAllMocks();
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

test("after a pointer press only a text field keeps its ring, and forced colours keep every ring", () => {
  const css = read("kit.css");
  const quiet = css.indexOf("{\n  --app-focus: 0 0 transparent;\n}");
  const selector = css.slice(css.lastIndexOf("}", quiet) + 1, quiet).replaceAll(":focus-visible", "");
  const quietens = (markup: string) => {
    document.body.innerHTML = markup;
    return document.body.firstElementChild!.matches(selector);
  };
  html.setAttribute("data-app-modality", "pointer");
  for (const ringed of ["<input>", '<input type="search">', "<textarea></textarea>", "<select></select>"]) {
    expect(quietens(ringed), ringed).toBe(false);
  }
  for (const quietened of ["<button></button>", '<input type="checkbox">', '<input type="radio">', '<input type="range">']) {
    expect(quietens(quietened), quietened).toBe(true);
  }
  document.body.innerHTML = "";
  html.removeAttribute("data-app-modality");
  expect(forcedColours(css.slice(quiet))).toMatch(/:focus-visible[^{]*\{\s*outline: 2px solid Highlight;/);
  expect(JSON.parse(read("../package.json")).sideEffects).toContain("./src/modality.ts");
});

test("after a pointer press a dialog and a tickbox drop the platform's own ring, except under forced colours", () => {
  expect(read("kit.css")).toMatch(
    /\n@media \(forced-colors: none\) \{\n {2}:root\[data-app-modality="pointer"\] :is\(\.app-dialog, \.app-tick__box\):focus-visible \{\n {4}outline: none;/,
  );
});
