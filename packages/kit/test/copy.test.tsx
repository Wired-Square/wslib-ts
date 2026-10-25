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
    expect(root.textContent).toBe("Copy⧉");
    root.querySelector("button")!.click();
    await vi.waitFor(() => expect(root.textContent).toBe("CopyCopied"));
    expect(writeText).toHaveBeenCalledWith("AB:CD");
  } finally {
    vi.unstubAllGlobals();
  }
});
