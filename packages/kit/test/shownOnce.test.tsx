import { expect, test, vi } from "vitest";

import { Dialog, ShownOnce } from "../src/index";
import { button, field, mount } from "../src/testing";
import { read, rule } from "./css";

test("a ShownOnce shows its value read-only and says it is shown once, its note described by the field", () => {
  const root = mount(() => (
    <Dialog title="New API key" undismissible>
      <ShownOnce label="API key" value="wsk_7f3a" onDone={() => {}} />
    </Dialog>
  ));
  const input = field("API key");
  expect(input.value).toBe("wsk_7f3a");
  expect(input.readOnly).toBe(true);
  const note = document.getElementById(input.getAttribute("aria-describedby")!)!;
  expect(note.textContent).toBe("This is shown once. Copy it now: it can't be shown again.");
  expect(root.querySelector(".app-dialog__actions .app-actions")!.textContent).toBe("Done");
});

test("a ShownOnce takes its own note, copies its value, and calls onDone on Done", async () => {
  const writeText = vi.fn(async (_text: string) => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  try {
    const onDone = vi.fn();
    mount(() => <ShownOnce label="Token" value="t-91" note="Kept nowhere after this." onDone={onDone} />);
    expect(document.getElementById(field("Token").getAttribute("aria-describedby")!)!.textContent).toBe(
      "Kept nowhere after this.",
    );
    button("Copy").click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("t-91"));
    button("Done").click();
    expect(onDone).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("a ShownOnce's value is monospace", () => {
  expect(rule(read("kit.css"), ".app-shown-once .app-field__input")).toMatch(/font-family: var\(--app-font-mono\);/);
});
