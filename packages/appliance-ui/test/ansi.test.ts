import assert from "node:assert/strict";
import { test } from "node:test";

import { Scrollback } from "../src/serial/ansi.ts";

const text = (screen: Scrollback) => screen.lines.map((line) => line.map((run) => run.text).join(""));
const bytes = (s: string) => new TextEncoder().encode(s);

test("A status line keeps its colour and the reset ends it", () => {
  const screen = new Scrollback();
  screen.write("\r\n\x1b[31m[serial: error — missing address and usb_serial]\x1b[0m\r\nboot");
  assert.deepEqual(text(screen), ["", "[serial: error — missing address and usb_serial]", "boot"]);
  assert.deepEqual(screen.lines[1], [{ text: "[serial: error — missing address and usb_serial]", ink: "bad" }]);
  assert.deepEqual(screen.lines[2], [{ text: "boot" }]);
});

test("An escape or a character split across chunks is put back together", () => {
  const screen = new Scrollback();
  for (const byte of bytes("\x1b[1;32mok ✓\x1b[0m")) screen.write(Uint8Array.of(byte));
  assert.deepEqual(screen.lines, [[{ text: "ok ✓", ink: "good", bold: true }]]);
});

test("A bare carriage return starts the line again, as a progress line does", () => {
  const screen = new Scrollback();
  screen.write("10%\r50%\r100%\ndone");
  assert.deepEqual(text(screen), ["100%", "done"]);
});

test("Cursor movement, titles and stray control bytes are dropped", () => {
  const screen = new Scrollback();
  screen.write("\x1b[2J\x1b[Hprompt\x07\x1b]0;title\x07$ \x1b[K");
  assert.deepEqual(text(screen), ["prompt$ "]);
});

test("Only the newest lines are kept", () => {
  const screen = new Scrollback(3);
  screen.write("1\n2\n3\n4\n5");
  assert.deepEqual(text(screen), ["3", "4", "5"]);
});

test("A line that changes is a new array, and the lines before it are not", () => {
  const screen = new Scrollback();
  screen.write("one\ntw");
  const [first, second] = screen.lines;
  screen.write("o");
  assert.equal(screen.lines[0], first);
  assert.notEqual(screen.lines[1], second);
});

test("Echoed spans are marked as the writer's, the rest stays the device's", () => {
  const screen = new Scrollback();
  screen.output(bytes("$ ls\r\nok"), [{ start: 2, len: 2, by: "alex", colour: 3 }]);
  assert.deepEqual(screen.lines, [[{ text: "$ " }, { text: "ls", who: { by: "alex", colour: 3 } }], [{ text: "ok" }]]);
});

test("A marker sits inline where the input went and doesn't change the device's colour", () => {
  const screen = new Scrollback();
  screen.write("\x1b[33mPassword: ");
  screen.note("⌨alex·8", { by: "alex", colour: 3 });
  screen.write("ok");
  assert.deepEqual(screen.lines, [
    [
      { text: "Password: ", ink: "warn" },
      { text: "⌨alex·8", ink: "warn", who: { by: "alex", colour: 3 }, mark: true },
      { text: "ok", ink: "warn" },
    ],
  ]);
});
