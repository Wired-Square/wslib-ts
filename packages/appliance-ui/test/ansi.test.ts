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

test("A marker sits inline where the input went, the device's output after it starts a new line in its colour", () => {
  const screen = new Scrollback();
  screen.write("\x1b[33mPassword: ");
  screen.note("⌨alex·8", { by: "alex", colour: 3 });
  screen.write("ok");
  assert.deepEqual(screen.lines, [
    [
      { text: "Password: ", ink: "warn" },
      { text: "⌨alex·8", ink: "warn", who: { by: "alex", colour: 3 }, mark: true },
    ],
    [{ text: "ok", ink: "warn" }],
  ]);
});

test("Output that breaks the line after a marker breaks it once, and a carriage return keeps the marker", () => {
  const screen = new Scrollback();
  screen.note("⌨alex·1", { by: "alex", colour: 1 });
  screen.write("\r\n-- stub");
  screen.note("⌨alex·2", { by: "alex", colour: 1 });
  screen.write("\rboot");
  assert.deepEqual(text(screen), ["⌨alex·1", "-- stub⌨alex·2", "boot"]);
});

test("A console's own line stands apart from the device's output on either side", () => {
  const screen = new Scrollback();
  screen.write("boot");
  screen.mark("— reconnected —");
  screen.write("ok");
  assert.deepEqual(screen.lines, [
    [{ text: "boot" }],
    [{ text: "— reconnected —", ink: "muted", mark: true }],
    [{ text: "ok" }],
  ]);
});

test("ANSI blue, magenta and cyan each keep their own ink", () => {
  const screen = new Scrollback();
  screen.write("\x1b[34mb\x1b[95mm\x1b[36mc");
  assert.deepEqual(screen.lines[0]!.map((run) => run.ink), ["blue", "magenta", "cyan"]);
});
