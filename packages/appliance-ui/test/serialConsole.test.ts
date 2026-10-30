import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import type { SerialConsoleProps } from "../src/serial/SerialConsole.tsx";
import { find, load, mount, settled, textOf, within } from "./mount.ts";
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
  const press = (key: string) => {
    let prevented = false;
    (screen().props.onKeyDown as (e: unknown) => void)({
      key,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault: () => (prevented = true),
    });
    return prevented;
  };
  const sent = () => socket().sent.map((bytes) => new TextDecoder().decode(bytes));
  return { root, socket, screen, say, press, sent, shown: () => textOf(root) };
}

test("Input is off until the session may write, then a key goes to the port", async () => {
  const c = await opened(URL_PROPS);
  assert.equal(c.socket().url, URL_PROPS.url);
  assert.match(c.shown(), /Input is off until the console connects/);
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: false });
  assert.match(c.shown(), /Read-only: this session can watch but not type/);
  assert.equal(c.press("a"), false);

  await c.say({ type: "attached", name: "olive", writes: true });
  assert.match(c.shown(), /Click the console and type, or paste/);
  assert.equal(c.press("a"), true);
  assert.equal(c.press("Enter"), true);
  assert.deepEqual(c.sent(), ["a", "\r"]);
});

test("The read-only flag keeps a writer from typing", async () => {
  const c = await opened({ ...URL_PROPS, readOnly: true });
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: true });
  assert.equal(c.press("a"), false);
  assert.match(c.shown(), /Read-only\./);
  assert.deepEqual(c.sent(), []);
});

test("A paste is sent whole while the session may write", async () => {
  const c = await opened(URL_PROPS);
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: true });
  let prevented = false;
  (c.screen().props.onPaste as (e: unknown) => void)({
    clipboardData: { getData: () => "reboot\r" },
    preventDefault: () => (prevented = true),
  });
  assert.equal(prevented, true);
  assert.deepEqual(c.sent(), ["reboot\r"]);
});

test("A pause keeps the console attached, shows its progress, and refuses input rather than queueing it", async () => {
  const c = await opened(URL_PROPS);
  c.socket().open();
  await c.say({ type: "attached", name: "olive", writes: true });
  await c.say({ type: "state", state: "paused", label: "Paused: flashing", message: "Writing 40%" });
  assert.match(c.shown(), /Paused: flashing \(Writing 40%\)/);
  assert.match(c.shown(), /Input is off while the port is paused/);
  assert.equal(c.press("a"), false);
  await c.say({ type: "refused", message: "the port is paused" });
  assert.match(c.shown(), /Not sent: the port is paused/);

  await c.say({ type: "state", state: "reading", label: "Reading" });
  assert.doesNotMatch(c.shown(), /Not sent/);
  assert.equal(c.press("b"), true);
  assert.deepEqual(c.sent(), ["b"], "nothing typed during the pause was held back");
  assert.equal(Dialled.all.length, 1);
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
  assert.match(c.shown(), /Board at 115200 baud/);
  const first = c.socket();
  assert.equal(first.url, "wss://box.local/apps/hello/ws/serial?address=%2Fdev%2FttyUSB0");

  const field = find(c.root, (n) => n.props.class === "app-field");
  (field.props.onChange as (e: unknown) => void)({ target: { value: "74880" } });
  await settled();
  assert.equal(first.closed, true);
  assert.equal(new URL(c.socket().url).searchParams.get("baud"), "74880");
  assert.match(c.shown(), /Board at 74880 baud/);
});
