import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";

import { IconSet, SearchInput } from "../src/index";
import { mount } from "../src/testing";
import { forcedColours, read, rule } from "./css";

function searching(initial = "") {
  const [value, setValue] = createSignal(initial);
  const onValue = vi.fn(setValue);
  const root = mount(() => <SearchInput label="Search certificates" placeholder="Search…" value={value()} onValue={onValue} />);
  return { root, value, onValue, input: root.querySelector("input")! };
}

test("a SearchInput is a labelled search box that corrects, capitalises and spell-checks nothing", () => {
  const { input } = searching();
  expect(input.type).toBe("search");
  expect(input.getAttribute("aria-label")).toBe("Search certificates");
  expect(input.placeholder).toBe("Search…");
  expect(input.className).toBe("app-field__input app-search__input");
  for (const off of ["autocomplete", "autocorrect", "autocapitalize"]) expect(input.getAttribute(off), off).toBe("off");
  expect(input.getAttribute("spellcheck")).toBe("false");
});

test("typing tells the caller, and the clear button shows only while there is a value", () => {
  const { root, input, value } = searching();
  expect(root.querySelector("button")).toBeNull();
  input.value = "acme";
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  expect(value()).toBe("acme");
  const clear = root.querySelector("button")!;
  expect(clear.getAttribute("aria-label")).toBe("Clear");
  expect(clear.type).toBe("button");
  expect(clear.querySelector("svg")!.getAttribute("stroke")).toBe("currentColor");
});

test("clearing empties the value, tells the caller, and returns focus to the box", () => {
  const { root, input, onValue } = searching("acme");
  expect(input.value).toBe("acme");
  const clear = root.querySelector("button")!;
  clear.focus();
  clear.click();
  expect(onValue).toHaveBeenLastCalledWith("");
  expect(input.value).toBe("");
  expect(root.querySelector("button")).toBeNull();
  expect(document.activeElement).toBe(input);
});

test("the clear glyph comes from IconSet, and the caller's own onInput still runs", () => {
  const own = vi.fn();
  const onValue = vi.fn();
  const root = mount(() => (
    <IconSet icons={{ clear: () => "×" }}>
      <SearchInput label="Filter" value="x" onValue={onValue} onInput={own} class="toolbar-search" />
    </IconSet>
  ));
  expect(root.querySelector("button")!.textContent).toBe("×");
  expect(root.firstElementChild!.className).toBe("app-search toolbar-search");
  root.querySelector("input")!.dispatchEvent(new InputEvent("input", { bubbles: true }));
  expect(own).toHaveBeenCalledOnce();
  expect(onValue).toHaveBeenCalledWith("x");
});

test("the clear button sits inside the box, which leaves it room and hides WebKit's own, and keeps a ring under forced colours", () => {
  const css = read("kit.css");
  expect(rule(css, ".app-search")).toMatch(/position: relative;/);
  expect(rule(css, ".app-search__input")).toMatch(/padding-inline-end: 2rem;/);
  expect(css.indexOf("\n.app-search__input {")).toBeGreaterThan(css.indexOf("\n.app-field__input {"));
  expect(rule(css, ".app-search__input::-webkit-search-cancel-button")).toMatch(/appearance: none;/);
  expect(rule(css, ".app-search__clear")).toMatch(/position: absolute;[^}]*color: var\(--app-text-muted\);/);
  expect(rule(css, ".app-search__clear:focus-visible")).toMatch(/outline: none;\s*box-shadow: var\(--app-focus\);/);
  expect(forcedColours(css)).toMatch(/:is\([^)]*\.app-search__clear\):focus-visible[^{]*\{\s*outline: 2px solid Highlight;/);
});
