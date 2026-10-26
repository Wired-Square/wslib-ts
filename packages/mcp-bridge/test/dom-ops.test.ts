import { page, shown } from "./dom.ts";

import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { test } from "node:test";

import { DOM_OPS, DOM_OP_CLASS, domOps, runDomOp, type DomOpClass } from "../src/dom-ops.ts";

const opsOf = (kind: DomOpClass) => Object.entries(DOM_OP_CLASS).flatMap(([op, k]) => (k === kind ? [op] : []));

test("DOM_OPS lists the six ops in the contract's order, as domOps and DOM_OP_CLASS name them", () => {
  deepEqual(DOM_OPS, ["query", "click", "type", "press", "wait_for", "console"]);
  deepEqual(Object.keys(domOps), DOM_OPS);
  deepEqual(Object.keys(DOM_OP_CLASS).sort(), [...DOM_OPS].sort());
});

test("query, wait_for and console are read-only; click, type and press drive", () => {
  deepEqual(opsOf("read"), ["query", "wait_for", "console"]);
  deepEqual(opsOf("drive"), ["click", "type", "press"]);
});

test("an op outside the contract is refused", async () => {
  await rejects(runDomOp("navigate", {}), /unknown dom op navigate/);
  await rejects(runDomOp("toString", {}), /unknown dom op toString/);
});

test("query reports each match, narrowed by text", async () => {
  page(`<button aria-label="Go" role="tab" aria-selected="true">Save</button><button disabled>Cancel</button>
        <input type="checkbox" checked><input value="typed">`);
  shown(document.querySelector("button")!);
  const { matches } = (await runDomOp("query", { selector: "button", text: "Save" })) as { matches: Record<string, unknown>[] };
  deepEqual(matches, [
    {
      text: "Save",
      role: "tab",
      ariaLabel: "Go",
      value: null,
      checked: null,
      disabled: false,
      expanded: null,
      selected: true,
      rect: { x: 10, y: 20, width: 30, height: 40 },
      inViewport: true,
      clippedBy: null,
    },
  ]);
  const all = (await runDomOp("query", { selector: "button, input" })) as { matches: Record<string, unknown>[] };
  deepEqual(
    all.matches.map(({ disabled, checked, value }) => ({ disabled, checked, value })),
    [
      { disabled: false, checked: null, value: null },
      { disabled: true, checked: null, value: null },
      { disabled: false, checked: true, value: null },
      { disabled: false, checked: null, value: "typed" },
    ],
  );
});

test("click presses the match at index, 0 by default, narrowed by text", async () => {
  page("<button>One</button><button>Two</button><button>Two</button>");
  const clicks: string[] = [];
  document.querySelectorAll("button").forEach((b, i) => b.addEventListener("click", () => clicks.push(`${b.textContent}${i}`)));
  deepEqual(await runDomOp("click", { selector: "button", index: 0 }), {});
  await runDomOp("click", { selector: "button", text: "Two", index: 1 });
  deepEqual(clicks, ["One0", "Two2"]);
  equal(document.activeElement, document.querySelectorAll("button")[2]);
  await rejects(runDomOp("click", { selector: "button", text: "Two", index: 2 }), /2 match\(es\) for button with text "Two"; no index 2/);
});

test("type sets the field's value and fires input and change", async () => {
  page("<input>");
  const input = document.querySelector("input")!;
  const fired: string[] = [];
  for (const kind of ["input", "change"]) input.addEventListener(kind, () => fired.push(`${kind}:${input.value}`));
  deepEqual(await runDomOp("type", { selector: "input", text: "hello" }), {});
  deepEqual(fired, ["input:hello", "change:hello"]);
  equal(document.activeElement, input);
});

test("press sends the key to the selector's match, or to the focused element", async () => {
  page("<input id=a><input id=b>");
  const keys: string[] = [];
  document.querySelectorAll("input").forEach((el) => {
    el.addEventListener("keydown", (e) => keys.push(`${el.id}:down:${e.key}`));
    el.addEventListener("keyup", (e) => keys.push(`${el.id}:up:${e.key}`));
  });
  deepEqual(await runDomOp("press", { key: "Enter", selector: "#b" }), {});
  document.querySelector<HTMLInputElement>("#a")!.focus();
  await runDomOp("press", { key: "Escape" });
  deepEqual(keys, ["b:down:Enter", "b:up:Enter", "a:down:Escape", "a:up:Escape"]);
});

test("wait_for waits until a match is visible, or until none is", async () => {
  page("<p>Loading</p>");
  setTimeout(() => {
    page("<p>Done</p>");
    shown(document.querySelector("p")!);
  }, 60);
  const { elapsedMs } = (await runDomOp("wait_for", { selector: "p", text: "Done", state: "visible", timeout_ms: 5000 })) as {
    elapsedMs: number;
  };
  equal(typeof elapsedMs, "number");
  setTimeout(() => page(""), 60);
  await runDomOp("wait_for", { selector: "p", state: "gone", timeout_ms: 5000 });
  equal(document.querySelector("p"), null);
});

test("wait_for gives up after timeout_ms", async () => {
  page("<p>Loading</p>");
  await rejects(runDomOp("wait_for", { selector: "p", state: "visible", timeout_ms: 60 }), /^Error: p not visible after 60 ms$/);
});

test("console returns what was captured since import, by level and seq, and clears on request", async () => {
  type Read = { entries: { seq: number; level: string; message: string; stack?: string }[]; dropped: number };
  const read = async (args: object) => (await runDomOp("console", { clear: false, ...args })) as Read;
  await read({ clear: true });

  console.warn("low", { on: 1 });
  console.error(new Error("broke"));
  window.dispatchEvent(new window.ErrorEvent("error", { error: new TypeError("thrown") }));
  window.dispatchEvent(Object.assign(new window.Event("unhandledrejection"), { reason: "refused" }));

  const all = await read({});
  deepEqual(
    all.entries.map(({ level, message }) => [level, message]),
    [
      ["warn", 'low {"on":1}'],
      ["error", "Error: broke"],
      ["uncaught", "TypeError: thrown"],
      ["rejection", "refused"],
    ],
  );
  match(all.entries[1]!.stack ?? "", /broke/);
  equal(all.dropped, 0);

  deepEqual((await read({ levels: ["uncaught", "rejection"] })).entries.map((e) => e.level), ["uncaught", "rejection"]);
  deepEqual((await read({ since: all.entries[2]!.seq })).entries.map((e) => e.level), ["rejection"]);
  equal((await read({ clear: true })).entries.length, 4);
  equal((await read({})).entries.length, 0);
});
