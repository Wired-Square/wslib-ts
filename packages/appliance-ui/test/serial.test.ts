import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import type { LinkState } from "../src/serial/link.ts";
import type { ConsoleEvent, EchoSpan } from "../src/serial/wire.ts";
import { load } from "./mount.ts";
import { FakeSocket } from "./socket.ts";

const link = () => load<typeof import("../src/serial/link.ts")>("/src/serial/link.ts");

const port = { path: "/dev/ttyACM0", serialNumber: "E66138" };

test("serialUrl is the app's own socket under the page's base, the default baud left out", async () => {
  const { DEFAULT_BAUD, serialUrl } = await link();
  const url = new URL(serialUrl(port, DEFAULT_BAUD, "https://bench.local/apps/serial/ws/serial"));
  assert.equal(url.origin + url.pathname, "wss://bench.local/apps/serial/ws/serial");
  assert.deepEqual(Object.fromEntries(url.searchParams), { address: "/dev/ttyACM0", usb_serial: "E66138" });
});

test("serialUrl names another baud, and no USB serial for a port without one", async () => {
  const { serialUrl } = await link();
  const url = new URL(serialUrl({ path: "/dev/ttyUSB0", serialNumber: null }, 74880, "http://localhost/ws/serial"));
  assert.equal(url.protocol, "ws:");
  assert.deepEqual(Object.fromEntries(url.searchParams), { address: "/dev/ttyUSB0", baud: "74880" });
});

async function dialled() {
  const { openLink } = await link();
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];
  const states: LinkState[] = [];
  const received: [string, readonly EchoSpan[]][] = [];
  const events: ConsoleEvent[] = [];
  const opened = openLink(
    "ws://x/ws/serial",
    {
      state: (s) => states.push(s),
      output: (b, spans) => received.push([new TextDecoder().decode(b), spans]),
      event: (e) => events.push(e),
    },
    (url) => {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  );
  return { sockets, urls, states, received, events, ...opened };
}

afterEach(() => mock.timers.reset());

test("A socket that never opens is unreachable and is not dialled again", async () => {
  const opened = await dialled();
  mock.timers.enable({ apis: ["setTimeout"] });
  opened.sockets[0]!.drop();
  mock.timers.tick(60_000);
  assert.deepEqual(opened.states, [{ is: "connecting" }, { is: "unreachable" }]);
  assert.equal(opened.sockets.length, 1);
});

test("One the back end refused before attaching is unreachable with its message, and is not dialled again", async () => {
  const opened = await dialled();
  mock.timers.enable({ apis: ["setTimeout"] });
  const socket = opened.sockets[0]!;
  socket.open();
  socket.text({ type: "error", message: "/dev/ttyACM0 is held by the app flasher" });
  socket.drop();
  mock.timers.tick(60_000);
  assert.deepEqual(opened.states, [
    { is: "connecting" },
    { is: "unreachable", message: "/dev/ttyACM0 is held by the app flasher" },
  ]);
  assert.equal(opened.events.length, 1, "the error is still handed on");
  assert.equal(opened.sockets.length, 1);
});

test("One revoked after attaching redials once, and is unreachable when that dial is refused", async () => {
  const opened = await dialled();
  mock.timers.enable({ apis: ["setTimeout"] });
  opened.sockets[0]!.attach();
  opened.sockets[0]!.text({ type: "error", message: "access revoked" });
  opened.sockets[0]!.drop();
  mock.timers.tick(1000);
  assert.equal(opened.sockets.length, 2);
  opened.sockets[1]!.open();
  opened.sockets[1]!.text({ type: "error", message: "not permitted" });
  opened.sockets[1]!.drop();
  mock.timers.tick(60_000);
  assert.deepEqual(opened.states, [
    { is: "connecting" },
    { is: "open" },
    { is: "retrying", inMs: 1000 },
    { is: "connecting" },
    { is: "unreachable", message: "not permitted" },
  ]);
  assert.equal(opened.sockets.length, 2);
});

test("One that attached and dropped redials, waiting longer each time up to fifteen seconds", async () => {
  const opened = await dialled();
  mock.timers.enable({ apis: ["setTimeout"] });
  opened.sockets[0]!.attach();
  const waits: number[] = [];
  for (let i = 0; i < 6; i++) {
    opened.sockets.at(-1)!.drop();
    const retry = opened.states.at(-1);
    if (retry?.is === "retrying") waits.push(retry.inMs);
    mock.timers.tick(retry?.is === "retrying" ? retry.inMs : 0);
  }
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 15000, 15000]);
  assert.equal(opened.sockets.length, 7);
  opened.sockets.at(-1)!.attach();
  opened.sockets.at(-1)!.drop();
  assert.deepEqual(opened.states.at(-1), { is: "retrying", inMs: 1000 }, "attaching resets the wait");
});

test("Each dial carries the secret held then, and none with no store", async (t) => {
  const { carrySession } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  t.after(() => {
    carrySession(undefined);
    Reflect.deleteProperty(globalThis, "document");
  });
  Object.assign(globalThis, { document: { baseURI: "http://x/" } });
  const plain = await dialled();
  plain.close();
  let secret = "s-1";
  carrySession({ read: () => secret, keep: () => {} });
  const opened = await dialled();
  mock.timers.enable({ apis: ["setTimeout"] });
  opened.sockets[0]!.attach();
  secret = "s-2";
  opened.sockets[0]!.drop();
  mock.timers.tick(1000);
  opened.close();
  assert.deepEqual(plain.urls, ["ws://x/ws/serial"]);
  assert.deepEqual(opened.urls, ["ws://x/ws/serial?appliance_session=s-1", "ws://x/ws/serial?appliance_session=s-2"]);
});

test("Bytes are handed on as they arrive, and closing stops the redial", async () => {
  const opened = await dialled();
  mock.timers.enable({ apis: ["setTimeout"] });
  const socket = opened.sockets[0]!;
  socket.open();
  socket.binary("hello");
  opened.close();
  socket.drop();
  mock.timers.tick(60_000);
  assert.deepEqual(opened.received, [["hello", []]]);
  assert.equal(socket.closed, true);
  assert.equal(opened.sockets.length, 1);
  assert.equal(socket.binaryType, "arraybuffer");
});

test("A spans event goes with the output after it, and other events are handed on", async () => {
  const opened = await dialled();
  const socket = opened.sockets[0]!;
  socket.open();
  const spans = [{ start: 0, len: 2, by: "alex", colour: 0 }];
  socket.text({ type: "spans", spans });
  socket.binary("ls\r\n");
  socket.binary("boot");
  const paused = { type: "state", state: "paused", label: "Paused: flashing", message: "Writing 40%" };
  socket.text(paused);
  assert.deepEqual(opened.received, [
    ["ls\r\n", spans],
    ["boot", []],
  ]);
  assert.deepEqual(opened.events, [paused]);
});

test("Input is sent only while the console is open", async () => {
  const opened = await dialled();
  const socket = opened.sockets[0]!;
  assert.equal(opened.send(Uint8Array.of(0x03)), false);
  socket.open();
  assert.equal(opened.send(Uint8Array.of(0x03)), true);
  socket.drop();
  assert.equal(opened.send(Uint8Array.of(0x03)), false);
  assert.deepEqual(socket.sent, [Uint8Array.of(0x03)]);
});

test("Keys are what a terminal sends, Tab and Escape too, and a Cmd shortcut, a bare modifier or Shift+Tab nothing", async () => {
  const { keyBytes } = await link();
  type Mods = Partial<Pick<KeyboardEvent, "ctrlKey" | "altKey" | "metaKey" | "shiftKey">>;
  const press = (key: string, mods: Mods = {}) =>
    keyBytes({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
  assert.deepEqual(
    [press("a"), press("Enter"), press("Backspace"), press("ArrowUp"), press("Tab"), press("Escape")],
    ["a", "\r", "\x7f", "\x1b[A", "\t", "\x1b"],
  );
  assert.equal(press("c", { ctrlKey: true }), "\x03");
  assert.equal(press("i", { ctrlKey: true }), "\t");
  const shiftTab = press("Tab", { shiftKey: true });
  assert.deepEqual([press("v", { metaKey: true }), press("Shift"), shiftTab], [undefined, undefined, undefined]);
});
