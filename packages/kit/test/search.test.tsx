import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";

import { Dialog, IconSet, SearchInput } from "../src/index";
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
  expect(rule(css, ".app-search__input")).toMatch(/appearance: none;/);
  expect(rule(forcedColours(css), ".app-search__input")).toMatch(/appearance: auto;/);
  expect(rule(css, ".app-search__clear")).toMatch(/position: absolute;[^}]*color: var\(--app-text-muted\);/);
  expect(rule(css, ".app-search__clear:focus-visible")).toMatch(/outline: none;\s*box-shadow: var\(--app-focus\);/);
  expect(forcedColours(css)).toMatch(/:is\([^)]*\.app-search__clear\):focus-visible[^{]*\{\s*outline: 2px solid Highlight;/);
});

test("a disabled or read-only SearchInput offers no clear button", () => {
  for (const locked of [{ disabled: true }, { readOnly: true }, { readonly: true }]) {
    const root = mount(() => <SearchInput label="Search" value="acme" onValue={() => {}} {...locked} />);
    expect(root.querySelector("button"), JSON.stringify(locked)).toBeNull();
  }
});

const escape = (target: Element) => {
  const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

function inDialog(initial: string) {
  const [value, setValue] = createSignal(initial);
  const onValue = vi.fn(setValue);
  const root = mount(() => (
    <dialog open>
      <SearchInput label="Search" value={value()} onValue={onValue} />
    </dialog>
  ));
  const dialog = root.querySelector("dialog")!;
  const cancel = vi.fn();
  dialog.addEventListener("cancel", cancel);
  return { dialog, cancel, onValue, value, input: root.querySelector("input")! };
}

test("the first Escape in a search with a value clears it and leaves the dialog open; the next cancels the dialog", () => {
  const { dialog, cancel, onValue, value, input } = inDialog("acme");
  expect(escape(input).defaultPrevented).toBe(true);
  expect(onValue).toHaveBeenLastCalledWith("");
  expect(value()).toBe("");
  expect(cancel).not.toHaveBeenCalled();
  expect(dialog.open).toBe(true);

  expect(escape(input).defaultPrevented).toBe(true);
  expect(cancel).toHaveBeenCalledOnce();
  expect(cancel.mock.calls[0]![0].cancelable).toBe(true);
  expect(dialog.open).toBe(false);
  expect(onValue).toHaveBeenCalledOnce();
});

test("a dialog that prevents the cancel stays open", () => {
  const { dialog, cancel, input } = inDialog("");
  cancel.mockImplementation((e: Event) => e.preventDefault());
  escape(input);
  expect(cancel).toHaveBeenCalledOnce();
  expect(dialog.open).toBe(true);
});

test("Escape in an empty search tells a kit Dialog, which closes, or holds while pending", () => {
  for (const pending of [false, true]) {
    const onClose = vi.fn();
    const root = mount(() => (
      <Dialog title="Pick" pending={pending} onClose={onClose}>
        <SearchInput label="Search" value="" onValue={() => {}} />
      </Dialog>
    ));
    escape(root.querySelector("input")!);
    expect(onClose).toHaveBeenCalledTimes(pending ? 0 : 1);
    expect(root.querySelector("dialog")!.open, `pending ${pending}`).toBe(true);
  }
});

test("Escape in a search leaves alone what is outside a dialog, inside a popover, already handled, or not Escape", () => {
  const outside = searching();
  expect(escape(outside.input).defaultPrevented).toBe(false);

  const root = mount(() => (
    <dialog open>
      <div popover="manual">
        <SearchInput label="Search" value="" onValue={() => {}} />
      </div>
    </dialog>
  ));
  const cancel = vi.fn();
  root.querySelector("dialog")!.addEventListener("cancel", cancel);
  expect(escape(root.querySelector("input")!).defaultPrevented).toBe(false);
  expect(cancel).not.toHaveBeenCalled();

  const { onValue, input } = inDialog("acme");
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  input.addEventListener("keydown", (e) => e.preventDefault());
  escape(input);
  expect(onValue).not.toHaveBeenCalled();
});
