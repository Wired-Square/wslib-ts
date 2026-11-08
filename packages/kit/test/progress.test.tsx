import { expect, test } from "vitest";
import { createSignal } from "solid-js";

import { Progress } from "../src/index";
import { mount } from "../src/testing";
import { forcedColours, read, rule } from "./css";

test("a Progress is a native bar named by its visible label, with the percent done and the time left", () => {
  const [sent, setSent] = createSignal<number | undefined>(undefined);
  const root = mount(() => <Progress label="Uploading backup.tar" value={sent()} max={200} eta={sent() && 185} />);
  const bar = root.querySelector("progress")!;
  expect(document.getElementById(bar.getAttribute("aria-labelledby")!)!.textContent).toBe("Uploading backup.tar");
  expect(bar.hasAttribute("value"), "no value yet is indeterminate").toBe(false);
  expect(root.querySelector(".app-progress__head .app-muted")!.textContent).toBe("");

  setSent(50);
  expect(bar.value).toBe(50);
  expect(bar.max).toBe(200);
  expect(root.querySelector(".app-progress__head .app-muted")!.textContent).toBe("25% · about 3m left");

  setSent(undefined);
  expect(bar.hasAttribute("value"), "and is again when the value goes").toBe(false);
});

test("a Progress's max is 1 by default, and its time left is rounded to whole seconds", () => {
  const root = mount(() => <Progress label="Restoring" value={0.5} eta={41.6} />);
  expect(root.querySelector("progress")!.max).toBe(1);
  expect(root.textContent).toBe("Restoring50% · about 42s left");
});

test("a Progress bar is drawn in the accent on the sunken surface, and native under forced colours", () => {
  const css = read("kit.css");
  expect(rule(css, ".app-progress__bar")).toMatch(/appearance: none;[^}]*background: var\(--app-surface-sunken\);/);
  expect(rule(css, ".app-progress__bar::-webkit-progress-value")).toMatch(/background: var\(--app-accent\);/);
  expect(rule(css, ".app-progress__bar::-moz-progress-bar")).toMatch(/background: var\(--app-accent\);/);
  expect(rule(forcedColours(css), ".app-progress__bar,\n.app-progress__bar:indeterminate")).toMatch(
    /appearance: auto;\s*background: none;\s*animation: none;/,
  );
});
