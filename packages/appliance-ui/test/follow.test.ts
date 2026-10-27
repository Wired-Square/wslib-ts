import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { eventSource, follow } from "../src/follow.ts";
import type { FeedListener, FeedTransport } from "../src/follow.ts";

const SILENCE_MS = 45_000;
const REOPEN_MS = 5_000;

beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

/** A transport the test drives, keeping every connection it was asked for. */
function fake() {
  const opened: { url: string; on: FeedListener; close: ReturnType<typeof mock.fn> }[] = [];
  const transport: FeedTransport = (url, on) => {
    const close = mock.fn();
    opened.push({ url, on, close });
    return close;
  };
  return { transport, opened, latest: () => opened.at(-1)! };
}

function followed(transport: Parameters<typeof follow>[2], names = ["log"]) {
  const state = { live: false, opened: 0, closed: false, heard: 0, logs: [] as unknown[] };
  const stop = follow(
    "/api/logs/events",
    Object.fromEntries(names.map((name) => [name, (body: unknown) => state.logs.push(body)])),
    transport,
    {
      live: (live) => (state.live = live),
      opened: () => state.opened++,
      closed: () => (state.closed = true),
      heard: () => state.heard++,
    },
    SILENCE_MS,
  );
  return { state, stop };
}

test("a transport's open, events and heartbeats drive the feed, and silence ends live", () => {
  const { transport, opened, latest } = fake();
  const { state, stop } = followed(transport);
  assert.equal(opened.length, 1);
  assert.equal(latest().url, "/api/logs/events");

  latest().on.onOpen();
  assert.deepEqual([state.live, state.opened], [true, 1]);

  latest().on.onEvent("log", '{"seq":1}');
  latest().on.onEvent("log", "not json");
  assert.deepEqual(state.logs, [{ seq: 1 }]);
  assert.equal(state.heard, 2, "a body that will not parse was still heard");

  for (const name of ["heartbeat", "unasked"]) {
    mock.timers.tick(SILENCE_MS - 1);
    latest().on.onEvent(name, "{}");
    mock.timers.tick(SILENCE_MS - 1);
    assert.equal(state.live, true, `${name} is something arriving`);
    assert.equal(state.heard, 2, `and ${name} is not an event anybody asked for`);
  }
  mock.timers.tick(1);
  assert.equal(state.live, false, "three missed heartbeats");

  stop();
  assert.equal(latest().close.mock.callCount(), 1);
});

test("a close with 401 or 403 ends the feed, and one with any other status reopens it", () => {
  for (const status of [401, 403]) {
    const { transport, opened, latest } = fake();
    const { state, stop } = followed(transport);
    latest().on.onOpen();
    latest().on.onClose(status);
    mock.timers.tick(REOPEN_MS * 2);
    assert.deepEqual([state.live, state.closed, opened.length], [false, true, 1], `${status}`);
    stop();
  }

  for (const status of [0, 200, 502]) {
    const { transport, opened, latest } = fake();
    const { state, stop } = followed(transport);
    latest().on.onOpen();
    latest().on.onClose(status);
    assert.equal(state.live, false);
    mock.timers.tick(REOPEN_MS - 1);
    assert.equal(opened.length, 1);
    mock.timers.tick(1);
    assert.deepEqual([state.closed, opened.length], [false, 2], `${status}`);
    latest().on.onOpen();
    assert.equal(state.opened, 2);
    stop();
  }
});

test("a connection is ignored after its close: one reopen, and no late event lands", () => {
  const { transport, opened } = fake();
  const { state, stop } = followed(transport);
  const first = opened[0]!.on;
  first.onOpen();
  first.onClose(0);
  first.onClose(0);
  first.onEvent("log", '{"seq":9}');
  first.onOpen();
  assert.deepEqual([state.live, state.opened, state.logs], [false, 1, []]);
  mock.timers.tick(REOPEN_MS * 3);
  assert.equal(opened.length, 2, "one reopen for two closes");
  stop();
});

test("an event after stop sets nothing", () => {
  const { transport, latest } = fake();
  const { state, stop } = followed(transport);
  stop();
  latest().on.onOpen();
  latest().on.onEvent("log", '{"seq":1}');
  assert.deepEqual([state.live, state.opened, state.heard, state.logs], [false, 0, 0, []]);
});

test("a close after the feed is stopped reopens nothing", () => {
  const { transport, opened, latest } = fake();
  const { state, stop } = followed(transport);
  stop();
  latest().on.onClose(0);
  mock.timers.tick(REOPEN_MS * 2);
  assert.deepEqual([state.closed, opened.length], [false, 1]);
});

test("EventSource retrying on its own is only a drop, and a closed one is asked its status", async () => {
  const sources: FakeEventSource[] = [];
  class FakeEventSource extends EventTarget {
    static readonly CLOSED = 2;
    readyState = 0;
    close = mock.fn();
    constructor() {
      super();
      sources.push(this);
    }
  }
  Object.assign(globalThis, { EventSource: FakeEventSource });
  const asked = mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response(null, { status: 401 })),
  );

  const names = ["log", "heartbeat"];
  const { state, stop } = followed(eventSource(names), names);
  const source = sources[0]!;
  source.dispatchEvent(new Event("open"));
  source.dispatchEvent(new MessageEvent("log", { data: '{"seq":7}' }));
  source.dispatchEvent(new MessageEvent("heartbeat", { data: '"ok"' }));
  assert.deepEqual(state.logs, [{ seq: 7 }, "ok"], "a handler named heartbeat, dispatched once");

  source.dispatchEvent(new Event("error"));
  assert.equal(state.live, false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(asked.mock.callCount(), 0, "still connecting, so nothing was asked");

  source.readyState = FakeEventSource.CLOSED;
  source.dispatchEvent(new Event("error"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(asked.mock.callCount(), 1);
  assert.equal(state.closed, true);

  stop();
  assert.equal(source.close.mock.callCount(), 0, "it had already closed");
});
