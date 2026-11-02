import { createSignal } from "solid-js";
import { expect, test, vi } from "vitest";

import { Button, Dialog, DialogActions, IconSet, SearchInput } from "../src/index";
import { button, mount } from "../src/testing";

const dialogIn = (root: HTMLElement) => root.querySelector("dialog")!;

const cancel = (dialog: HTMLDialogElement) => dialog.dispatchEvent(new Event("cancel", { cancelable: true }));

/** What a browser does to a second Escape once the page's user activation is spent. */
const platformCloses = (dialog: HTMLDialogElement) => {
  dialog.close();
  dialog.dispatchEvent(new Event("close"));
};

test("a Dialog takes a class, and shows a close button only when asked", () => {
  const root = mount(() => (
    <Dialog title="Plain" class="picker" onClose={() => {}}>
      <p>Body</p>
    </Dialog>
  ));
  expect(dialogIn(root).className).toBe("app-dialog picker");
  expect(root.querySelector(".app-dialog__close")).toBeNull();
});

test("a Dialog's close button is labelled, drawn from the icon set, last in the dialog, and closes it", () => {
  const onClose = vi.fn();
  const root = mount(() => (
    <IconSet icons={{ clear: () => <i data-glyph="clear" /> }}>
      <Dialog title="Details" closeButton onClose={onClose}>
        <p>Body</p>
      </Dialog>
    </IconSet>
  ));
  const close = root.querySelector<HTMLButtonElement>(".app-dialog__close")!;
  expect(dialogIn(root).classList).toContain("app-dialog--closable");
  expect(close.getAttribute("aria-label")).toBe("Close");
  expect(close.type).toBe("button");
  expect(close.querySelector("[data-glyph=clear]")).not.toBeNull();
  expect(dialogIn(root).lastElementChild, "so showModal never focuses it first").toBe(close);
  close.click();
  close.click();
  expect(onClose).toHaveBeenCalledOnce();
});

test("a Dialog's close button is disabled while pending, and closes once it is not", () => {
  const [pending, setPending] = createSignal(true);
  const onClose = vi.fn();
  const root = mount(() => (
    <Dialog title="Saving" closeButton pending={pending()} onClose={onClose}>
      <p>Body</p>
    </Dialog>
  ));
  const close = root.querySelector<HTMLButtonElement>(".app-dialog__close")!;
  expect(close.disabled).toBe(true);
  close.click();
  expect(onClose).not.toHaveBeenCalled();
  setPending(false);
  close.click();
  expect(onClose).toHaveBeenCalledOnce();
});

test("an undismissible Dialog needs no onClose, shows no close button, and holds against Escape and the platform's close", () => {
  const root = mount(() => (
    <Dialog title="Welcome" undismissible closeButton>
      <p>First run</p>
    </Dialog>
  ));
  const dialog = dialogIn(root);
  expect(root.querySelector(".app-dialog__close")).toBeNull();
  expect(dialog.className).toBe("app-dialog");
  expect(cancel(dialog), "Escape's cancel is prevented").toBe(false);
  expect(dialog.open).toBe(true);
  platformCloses(dialog);
  expect(dialog.open, "reopened").toBe(true);
  dialog.close();
  dialog.dispatchEvent(Object.assign(new Event("toggle"), { newState: "closed" }));
  expect(dialog.open, "reopened after a toggle too").toBe(true);
});

test("a Dialog undismissible for a while tells onClose of neither Escape nor the platform's close until it is let go", () => {
  const [busy, setBusy] = createSignal(true);
  const onClose = vi.fn();
  const root = mount(() => (
    <Dialog title="Upgrading" undismissible={busy()} onClose={onClose}>
      <p>Busy</p>
    </Dialog>
  ));
  const dialog = dialogIn(root);
  cancel(dialog);
  platformCloses(dialog);
  expect(onClose).not.toHaveBeenCalled();
  expect(dialog.open).toBe(true);
  setBusy(false);
  cancel(dialog);
  expect(onClose).toHaveBeenCalledOnce();
});

test("Escape in an empty search leaves an undismissible Dialog open", () => {
  const root = mount(() => (
    <Dialog title="Pick" undismissible>
      <SearchInput label="Search" value="" onValue={() => {}} />
    </Dialog>
  ));
  const e = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  root.querySelector("input")!.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(true);
  expect(dialogIn(root).open).toBe(true);
});
