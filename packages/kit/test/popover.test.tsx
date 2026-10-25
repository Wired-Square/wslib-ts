import { Show, createSignal } from "solid-js";
import { expect, test, vi } from "vitest";

import { Menu, MenuItem, Popover, PopoverOption } from "../src/index";
import type { PopoverProps } from "../src/index";
import { button, mount } from "../src/testing";

const rect = (top: number, left: number, width: number, height = 28) =>
  ({ top, bottom: top + height, left, right: left + width, width, height }) as DOMRect;

/** An input with a Popover of three options anchored on it, the middle one unavailable; `open` mounts it. */
function picker(props: Partial<PopoverProps> = {}) {
  const [open, setOpen] = createSignal(false);
  const onClose = vi.fn(() => setOpen(false));
  const chosen = vi.fn();
  let anchor!: HTMLInputElement;
  mount(() => (
    <>
      <input ref={anchor} aria-label="Vault" />
      <button type="button">elsewhere</button>
      <Show when={open()}>
        <Popover anchor={anchor} role="listbox" matchWidth onClose={onClose} {...props}>
          <PopoverOption onSelect={() => chosen("a")}>Alpha</PopoverOption>
          <div role="option" aria-disabled="true">
            Beta
          </div>
          <PopoverOption selected onSelect={() => chosen("c")}>
            Gamma
          </PopoverOption>
        </Popover>
      </Show>
    </>
  ));
  anchor.getBoundingClientRect = () => rect(100, 50, 200);
  return {
    anchor,
    onClose,
    chosen,
    open: () => setOpen(true),
    panel: () => document.querySelector<HTMLElement>(".app-popover"),
    options: () => [...document.querySelectorAll<HTMLElement>("[role=option]")],
  };
}

const fire = (target: EventTarget, type: string) => target.dispatchEvent(new Event(type, { bubbles: true }));

test("a Popover is a manual popover with its role, pinned under its anchor at the anchor's width", () => {
  const p = picker();
  p.open();
  const panel = p.panel()!;
  expect(panel.getAttribute("popover")).toBe("manual");
  expect(panel.getAttribute("role")).toBe("listbox");
  expect([panel.style.top, panel.style.left, panel.style.width]).toEqual(["132px", "50px", "200px"]);
  expect(p.options()[2]!.getAttribute("aria-selected")).toBe("true");
  expect(p.options()[0]!.getAttribute("aria-selected")).toBe("false");
});

test("a press on the anchor or inside keeps a Popover open, and one anywhere else closes it", () => {
  const p = picker();
  p.open();
  fire(p.anchor, "pointerdown");
  fire(p.options()[0]!, "pointerdown");
  expect(p.onClose).not.toHaveBeenCalled();
  fire(button("elsewhere"), "pointerdown");
  expect(p.onClose).toHaveBeenCalledOnce();
  expect(p.panel()).toBeNull();
});

test("Escape closes a Popover and goes no further, so a dialog around it stays open", () => {
  const p = picker();
  const beyond = vi.fn();
  document.addEventListener("keydown", beyond);
  p.open();
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  p.anchor.dispatchEvent(escape);
  document.removeEventListener("keydown", beyond);
  expect(p.onClose).toHaveBeenCalledOnce();
  expect(escape.defaultPrevented).toBe(true);
  expect(beyond).not.toHaveBeenCalled();
});

test("a scroll inside a Popover or its anchor keeps it, and a scroll outside or a resize closes it", () => {
  const p = picker();
  p.open();
  fire(p.panel()!, "scroll");
  fire(p.anchor, "scroll");
  expect(p.onClose).not.toHaveBeenCalled();
  fire(document, "scroll");
  expect(p.onClose).toHaveBeenCalledOnce();

  p.open();
  window.dispatchEvent(new Event("resize"));
  expect(p.onClose).toHaveBeenCalledTimes(2);
});

test("a Popover leaves focus on its anchor, and focusFirstItem focuses the first available item", () => {
  const p = picker();
  p.anchor.focus();
  p.open();
  expect(document.activeElement).toBe(p.anchor);
  p.onClose();

  const q = picker({ focusFirstItem: true });
  q.open();
  expect(document.activeElement).toBe(q.options()[0]);
});

test("the arrow keys skip an unavailable option, and Enter chooses", () => {
  const p = picker({ focusFirstItem: true });
  p.open();
  const key = (k: string) =>
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  key("ArrowDown");
  expect(document.activeElement).toBe(p.options()[2]);
  key("ArrowDown");
  expect(document.activeElement).toBe(p.options()[0]);
  key("Enter");
  expect(p.chosen).toHaveBeenCalledWith("a");
});

test("closing returns focus to the anchor only when it was inside", () => {
  const p = picker({ focusFirstItem: true });
  p.open();
  p.options()[0]!.click();
  p.onClose();
  expect(document.activeElement).toBe(p.anchor);

  p.open();
  button("elsewhere").focus();
  p.onClose();
  expect(document.activeElement).toBe(button("elsewhere"));
});

test("a Popover re-places when its body resizes, and stops watching once closed", () => {
  const watched: Element[] = [];
  let resized = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = (target: Element) => watched.push(target);
      disconnect = disconnect;
    },
  );
  try {
    const p = picker();
    p.open();
    expect(watched).toEqual([p.panel()!.firstElementChild]);
    p.anchor.getBoundingClientRect = () => rect(300, 50, 200);
    resized();
    expect(p.panel()!.style.top).toBe("332px");
    p.onClose();
    expect(disconnect).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("a Menu is placed by placePopover: above a trigger near the bottom, right-aligned and height-capped", () => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(160);
  mount(() => (
    <Menu aria-label="Actions">
      <MenuItem onSelect={() => {}}>Rename</MenuItem>
    </Menu>
  ));
  const trigger = document.querySelector<HTMLElement>(".app-menu__trigger")!;
  trigger.getBoundingClientRect = () => rect(window.innerHeight - 68, 872, 28);
  trigger.click();
  const panel = document.querySelector<HTMLElement>(".app-menu")!;
  expect(panel.style.top).toBe(`${window.innerHeight - 68 - 4 - 120}px`);
  expect(panel.style.left).toBe(`${900 - 160}px`);
  expect(panel.style.maxHeight).toBe(`${window.innerHeight - 68 - 12}px`);
});

test("a danger MenuItem is drawn in alert, and a disabled one neither closes the menu nor acts", () => {
  const selected = vi.fn();
  mount(() => (
    <Menu aria-label="Actions">
      <MenuItem danger onSelect={selected}>
        Delete
      </MenuItem>
      <MenuItem disabled onSelect={selected}>
        Renew
      </MenuItem>
    </Menu>
  ));
  document.querySelector<HTMLElement>(".app-menu__trigger")!.click();
  expect(button("Delete").className).toBe("app-menu__item app-menu__item--danger");
  expect(button("Renew").getAttribute("aria-disabled")).toBe("true");
  button("Renew").click();
  expect(selected).not.toHaveBeenCalled();
  expect(document.querySelector(".app-menu")!.textContent).toContain("Renew");
});

test("Escape closes a Menu and goes no further, so a dialog around it stays open, and focus returns to the trigger", () => {
  mount(() => (
    <Menu aria-label="Actions">
      <MenuItem onSelect={() => {}}>Rename</MenuItem>
    </Menu>
  ));
  const trigger = document.querySelector<HTMLElement>(".app-menu__trigger")!;
  trigger.click();
  const beyond = vi.fn();
  window.addEventListener("keydown", beyond);
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  button("Rename").dispatchEvent(escape);
  window.removeEventListener("keydown", beyond);
  expect(escape.defaultPrevented).toBe(true);
  expect(beyond).not.toHaveBeenCalled();
  expect(document.querySelector(".app-menu")!.matches(":popover-open")).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

test("choosing a MenuItem returns focus to the trigger before the item acts", () => {
  let focused: Element | null = null;
  mount(() => (
    <Menu aria-label="Actions">
      <MenuItem onSelect={() => (focused = document.activeElement)}>Rename</MenuItem>
    </Menu>
  ));
  const trigger = document.querySelector<HTMLElement>(".app-menu__trigger")!;
  trigger.click();
  button("Rename").click();
  expect(focused).toBe(trigger);
});
