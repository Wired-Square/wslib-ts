import { expect, test, vi } from "vitest";

import { CopyButton, IconSet } from "../src/index";
import { mount } from "../src/testing";

test("a CopyButton writes its value, then says Copied in place of the glyph for two seconds", async () => {
  vi.useFakeTimers();
  const write = vi.fn(async (_text: string) => {});
  const root = mount(() => (
    <CopyButton value="AB:CD" write={write}>
      AB:CD
    </CopyButton>
  ));
  const glyph = root.querySelector(".app-copy__glyph")!;
  expect(glyph.querySelector("svg")!.getAttribute("stroke")).toBe("currentColor");
  root.querySelector("button")!.click();
  await vi.waitFor(() => expect(glyph.textContent).toBe("Copied"));
  expect(write).toHaveBeenCalledWith("AB:CD");
  expect(root.querySelector(".app-copy__value")!.textContent).toBe("AB:CD");
  vi.advanceTimersByTime(2_000);
  expect(glyph.querySelector("svg")).not.toBeNull();
});

test("a CopyButton announces Copied through a status region outside the button, there before the copy, and keeps its name", async () => {
  vi.useFakeTimers();
  const root = mount(() => (
    <CopyButton value="AB:CD" write={async () => {}}>
      AB:CD
    </CopyButton>
  ));
  const button = root.querySelector("button")!;
  const status = root.querySelector("[role=status]")!;
  expect(button.contains(status)).toBe(false);
  expect(status.className).toBe("app-visually-hidden");
  expect(status.textContent).toBe("");
  expect(button.querySelector(".app-copy__glyph")!.getAttribute("aria-hidden")).toBe("true");

  button.click();
  await vi.waitFor(() => expect(status.textContent).toBe("Copied"));
  expect(root.querySelector("[role=status]")).toBe(status);
  vi.advanceTimersByTime(2_000);
  expect(status.textContent).toBe("");
});

test("a CopyButton says nothing when the write is refused, and writes to the clipboard by default", async () => {
  const refused = mount(() => (
    <CopyButton value="secret" write={() => Promise.reject(new Error("not allowed"))}>
      Copy
    </CopyButton>
  ));
  refused.querySelector("button")!.click();
  await new Promise((settled) => setTimeout(settled));
  expect(refused.textContent).toBe("Copy");

  const writeText = vi.fn(async (_text: string) => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  try {
    const root = mount(() => (
      <IconSet icons={{ copy: () => "⧉" }}>
        <CopyButton value="AB:CD">Copy</CopyButton>
      </IconSet>
    ));
    const button = root.querySelector("button")!;
    expect(button.textContent).toBe("Copy⧉");
    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe("CopyCopied"));
    expect(writeText).toHaveBeenCalledWith("AB:CD");
  } finally {
    vi.unstubAllGlobals();
  }
});
