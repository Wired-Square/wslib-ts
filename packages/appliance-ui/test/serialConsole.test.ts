import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { SerialConsoleProps } from "../src/serial/SerialConsole.tsx";
import { click, find, load, mount, settled, textOf, within } from "./mount.ts";
import { FakeSocket } from "./socket.ts";

class Dialled extends FakeSocket {
  static all: Dialled[] = [];
  readonly url: string;
  constructor(url: string) {
    super();
    this.url = url;
    Dialled.all.push(this);
  }
}

beforeEach(() => {
  Dialled.all = [];
  globalThis.WebSocket = Dialled as unknown as typeof WebSocket;
});
afterEach(() => Reflect.deleteProperty(globalThis, "WebSocket"));

const URL_PROPS = { url: "ws://box/ws/serial?address=/dev/ttyACM0", label: "Board" };

async function opened(props: SerialConsoleProps) {
  const { SerialConsole } = await load<typeof import("../src/serial/SerialConsole.tsx")>(
    "/src/serial/SerialConsole.tsx",
  );
  const { root } = await mount(() => SerialConsole(props), () => undefined);
  const socket = () => Dialled.all.at(-1)!;
  const screen = () => find(root, (n) => n.tag === "pre");
  const say = async (event: unknown) => {
    socket().text(event);
    await settled();
  };
  const press = (key: string, shiftKey = false) => {
    let prevented = false;
    (screen().props.onKeyDown as (e: unknown) => void)({
      key,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey,
      preventDefault: () => (prevented = true),
    });
    return prevented;
  };
  const paste = (text: string) => {
    let prevented = false;
    (screen().props.onPaste as (e: unknown) => void)({
      clipboardData: { getData: () => text },
      preventDefault: () => (prevented = true),
    });
    return prevented;
  };
  const sent = () => socket().sent.map((bytes) => new TextDecoder().decode(bytes));
  const buttons = () => [...within(root)].filter((n) => n.tag === "button").map((n) => textOf(n));
  const writer = async () => {
    socket().open();
    await say({ type: "attached", name: "olive", writes: true });
    await click(root, "Type");
  };
  return { root, socket, screen, say, press, paste, sent, buttons, writer, shown: () => textOf(root) };
}

test("Input is off until the session may write and the viewer turns it on, then a key goes to the port", async () => {
  const c = await opened(URL_PROPS);
  assert.equal(c.socket().url, URL_PROPS.url);
  assert.match(c.shown(), /Input is off until the console connects/);
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: false });
  assert.match(c.shown(), /Read-only: this session can watch but not type/);
  assert.deepEqual(c.buttons(), []);
  assert.equal(c.press("a"), false);

  await c.say({ type: "attached", name: "olive", writes: true });
  assert.match(c.shown(), /Input is off\. Choose Type/);
  assert.equal(c.press("a"), false);
  assert.equal(c.press("Tab"), false, "with input off, Tab moves focus");
  assert.equal(c.press("Escape"), false, "with input off, Escape is left to a surrounding dialog");
  assert.equal(c.paste("reboot\r"), false);
  assert.deepEqual(c.sent(), []);

  await click(c.root, "Type");
  assert.match(c.shown(), /Tab and Escape included; Shift\+Tab leaves/);
  assert.equal(c.press("a"), true);
  assert.equal(c.press("Enter"), true);
  assert.equal(c.press("Tab"), true);
  assert.equal(c.press("Escape"), true);
  assert.equal(c.press("Tab", true), false, "Shift+Tab moves focus out rather than going to the port");
  assert.deepEqual(c.sent(), ["a", "\r", "\t", "\x1b"]);

  await click(c.root, "Stop typing");
  assert.equal(c.press("b"), false);
  assert.deepEqual(c.buttons(), ["Type"]);
});

test("The read-only flag keeps a writer from typing", async () => {
  const c = await opened({ ...URL_PROPS, readOnly: true });
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: true });
  assert.equal(c.press("a"), false);
  assert.match(c.shown(), /Read-only\./);
  assert.deepEqual(c.buttons(), []);
  assert.deepEqual(c.sent(), []);
});

test("A paste is sent whole while input is on", async () => {
  const c = await opened(URL_PROPS);
  await c.writer();
  assert.equal(c.paste("reboot\r"), true);
  assert.deepEqual(c.sent(), ["reboot\r"]);
});

test("A pause keeps the console attached, shows its progress, and refuses input rather than queueing it", async () => {
  const c = await opened(URL_PROPS);
  await c.writer();
  await c.say({ type: "state", state: "paused", label: "Paused: flashing", message: "Writing 40%" });
  assert.match(c.shown(), /Paused: flashing \(Writing 40%\)/);
  assert.match(c.shown(), /Input is off while the port is paused/);
  assert.equal(c.press("a"), false);
  const toggle = () => find(c.root, (n) => n.tag === "button" && textOf(n).trim() === "Stop typing");
  assert.equal(toggle().props.disabled, true, "the viewer's choice holds, unchangeable, through the pause");
  await click(c.root, "Stop typing");
  await c.say({ type: "refused", reason: "paused" });
  assert.match(c.shown(), /Not sent while the port is paused\./);

  await c.say({ type: "state", state: "reading", label: "Reading" });
  assert.doesNotMatch(c.shown(), /Not sent/);
  assert.equal(toggle().props.disabled, false);
  assert.equal(c.press("b"), true);
  assert.deepEqual(c.sent(), ["b"], "nothing typed during the pause was held back");
  assert.equal(Dialled.all.length, 1);
});

test("A refusal is said in plain words for its reason, any detail beside it, and clears when the viewer next sends", async () => {
  const c = await opened(URL_PROPS);
  await c.writer();
  await c.say({ type: "refused", reason: "no_active_reader" });
  assert.match(c.shown(), /Not sent: nothing is reading this port, so input can't be sent\./);
  assert.equal([...within(c.root)].filter((n) => n.tag === "small").length, 0);

  assert.equal(c.press("a"), true);
  await settled();
  assert.doesNotMatch(c.shown(), /Not sent/);

  await c.say({ type: "refused", reason: "not_permitted", detail: "watch-only link" });
  assert.match(c.shown(), /Not sent: this session can watch but not type\. watch-only link/);
  assert.equal(textOf(find(c.root, (n) => n.tag === "small")), "watch-only link");
});

test("A reconnect clears a refusal and leaves a marker line in the scrollback", async (t) => {
  const c = await opened(URL_PROPS);
  await c.writer();
  c.socket().binary("boot");
  await c.say({ type: "refused", reason: "paused" });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  c.socket().drop();
  t.mock.timers.tick(1000);
  c.socket().open();
  await settled();
  assert.doesNotMatch(c.shown(), /Not sent/);
  const lines = c.screen().children.map((line) => textOf(line));
  assert.deepEqual(lines, ["boot\n", "— reconnected —\n", "\n"]);
});

test("Echoes and markers are drawn as their writer's, and the roster names who is attached", async () => {
  const c = await opened(URL_PROPS);
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: true });
  await c.say({
    type: "participants",
    participants: [
      { name: "olive", via: "local", colour: 0 },
      { name: "alex", via: "controller", colour: 3 },
    ],
  });
  assert.match(c.shown(), /olive \(you\)/);
  assert.match(c.shown(), /alex \(relayed\)/);

  c.socket().text({ type: "spans", spans: [{ start: 2, len: 2, by: "alex", colour: 3 }] });
  c.socket().binary("$ ls\r\n");
  await c.say({ type: "input", by: "alex", colour: 3, marker: "⌨alex·8" });
  const coloured = [...within(c.screen())].filter(
    (n) => (n.props.classList as Record<string, boolean> | undefined)?.["app-console__who--3"],
  );
  assert.deepEqual(
    coloured.map((n) => [textOf(n), n.props.title]),
    [
      ["ls", "alex"],
      ["⌨alex·8", "alex"],
    ],
  );
});

test("A console that never opens offers to try again, and trying dials once more", async () => {
  const c = await opened(URL_PROPS);
  c.socket().drop();
  await settled();
  assert.match(c.shown(), /The serial console didn't connect/);
  const retry = find(c.root, (n) => n.tag === "button" && textOf(n).trim() === "Try again");
  (retry.props.onClick as () => void)();
  await settled();
  assert.equal(Dialled.all.length, 2);
});

test("Given a port, it offers the bauds, and a new baud reopens the console at it", async (t) => {
  const page = globalThis.document;
  t.after(() => Object.assign(globalThis, { document: page }));
  Object.assign(globalThis, { document: { baseURI: "https://box.local/apps/hello/" } });
  const c = await opened({
    port: { path: "/dev/ttyUSB0", serialNumber: null },
    label: "Board",
    warning: "Opening may reset the board.",
  });
  assert.match(c.shown(), /Opening may reset the board\./);
  assert.match(c.shown(), /Board \(requested 115200 baud\)/);
  const first = c.socket();
  assert.equal(first.url, "wss://box.local/apps/hello/ws/serial?address=%2Fdev%2FttyUSB0");

  const field = find(c.root, (n) => n.props.class === "app-field");
  (field.props.onChange as (e: unknown) => void)({ target: { value: "74880" } });
  await settled();
  assert.equal(first.closed, true);
  assert.equal(new URL(c.socket().url).searchParams.get("baud"), "74880");
  assert.match(c.shown(), /Board \(requested 74880 baud\)/);

  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: true });
  assert.match(c.shown(), /Board \(requested 74880 baud\)/, "a relay may attach before the port's baud is known");
  await c.say({ type: "attached", name: "olive", writes: true, baud: 115200 });
  assert.match(c.shown(), /Board \(115200 baud\)/);
  assert.doesNotMatch(c.shown(), /requested/);
});

test("Given a URL, the heading is the label until the port's baud is known", async () => {
  const c = await opened(URL_PROPS);
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: false });
  assert.doesNotMatch(c.shown(), /baud/);
  await c.say({ type: "attached", name: "olive", writes: false, baud: 74880 });
  assert.match(c.shown(), /Board \(74880 baud\)/);
});
