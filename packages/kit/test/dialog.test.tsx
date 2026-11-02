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
  expect(close.className, "an icon button, so it matches the controls at any density").toBe("app-btn app-btn--plain app-btn--icon app-dialog__close");
  expect(close.getAttribute("aria-label")).toBe("Close");
  expect(close.title).toBe("Close");
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

test("DialogActions' status is a polite live region beside the buttons", () => {
  const [picked, setPicked] = createSignal(1);
  const root = mount(() => (
    <DialogActions
      onCancel={() => {}}
      status={`${picked()} of 2 selected`}
      confirm={<Button tone="primary">Add</Button>}
    />
  ));
  const status = root.querySelector("[role=status]")!;
  expect(status.className).toBe("app-dialog__status");
  expect(status.textContent).toBe("1 of 2 selected");
  setPicked(2);
  expect(status.textContent).toBe("2 of 2 selected");
  expect(button("Cancel").className, "plain beside a confirm").toBe("app-btn app-btn--plain");
});

test("DialogActions without a status has no live region", () => {
  const root = mount(() => <DialogActions onCancel={() => {}} confirm={<Button>Add</Button>} />);
  expect(root.querySelector("[role=status]")).toBeNull();
});

test("DialogActions with nothing to confirm is one Close button in the default tone, disabled while pending", () => {
  const onCancel = vi.fn();
  const [pending, setPending] = createSignal(false);
  const root = mount(() => <DialogActions onCancel={onCancel} pending={pending()} />);
  expect([...root.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Close"]);
  expect(button("Close").className).toBe("app-btn");
  button("Close").click();
  expect(onCancel).toHaveBeenCalledOnce();
  setPending(true);
  expect(button("Close").disabled).toBe(true);
});
