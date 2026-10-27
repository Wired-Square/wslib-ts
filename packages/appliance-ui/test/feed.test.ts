import assert from "node:assert/strict";
import { test } from "node:test";

import type { FeedListener, FeedTransport } from "../src/follow.ts";
import { load } from "./mount.ts";

type Events = { poll: { n: number }; alarm: { n: number } };

/** A `sharedFeed` over a transport the test drives, and a way to subscribe under an owner the test disposes. */
async function shared() {
  const { sharedFeed } = await load<typeof import("../src/feed.ts")>("/src/feed.ts");
  const { createRoot } = await load<typeof import("solid-js")>("solid-js");
  const connections: { on: FeedListener; closed: boolean }[] = [];
  const transport: FeedTransport = (_url, on) => {
    const connection = { on, closed: false };
    connections.push(connection);
    return () => (connection.closed = true);
  };
  const subscribe = sharedFeed<Events>("/api/events", { poll: true, alarm: true }, transport);
  const join = (handlers: Parameters<typeof subscribe>[0]) =>
    createRoot((leave) => ({ ...subscribe(handlers), leave }));
  return { connections, join };
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

test("Subscribers share one connection, each hearing only the events it handles", async () => {
  const { connections, join } = await shared();
  const polls: number[] = [];
  const alarms: number[] = [];
  const poller = join({ poll: (e) => polls.push(e.n) });
  const alarmer = join({ alarm: (e) => alarms.push(e.n) });
  assert.equal(connections.length, 1);

  const { on } = connections[0]!;
  on.onOpen();
  on.onEvent("poll", '{"n":1}');
  assert.deepEqual([polls, alarms], [[1], []]);
  assert.ok(poller.heard() !== undefined);
  assert.equal(alarmer.heard(), undefined, "a poll is not heard by a subscriber to alarms");
  assert.deepEqual([alarmer.live(), alarmer.opened()], [true, 1], "the connection's state is everybody's");

  on.onEvent("alarm", '{"n":2}');
  assert.deepEqual([polls, alarms], [[1], [2]]);
  poller.leave();
  alarmer.leave();
});

async function oneHandlerThrows(reported: unknown[]) {
  const { connections, join } = await shared();
  const polls: number[] = [];
  const thrower = join({
    poll: () => {
      throw new Error("a broken screen");
    },
  });
  const poller = join({ poll: (e) => polls.push(e.n) });
  connections[0]!.on.onEvent("poll", '{"n":1}');
  assert.deepEqual(polls, [1]);
  assert.deepEqual(
    reported.map((e) => (e as Error).message),
    ["a broken screen"],
  );
  assert.ok(thrower.heard() !== undefined && poller.heard() !== undefined);
  thrower.leave();
  poller.leave();
}

test("A handler that throws is reported, and the subscribers after it still hear the event", async () => {
  const reported: unknown[] = [];
  Object.assign(globalThis, { reportError: (e: unknown) => reported.push(e) });
  try {
    await oneHandlerThrows(reported);
  } finally {
    Reflect.deleteProperty(globalThis, "reportError");
  }
});

test("Where there is no reportError, as in Node 22, a handler that throws is logged instead", async (t) => {
  const own = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  Reflect.deleteProperty(globalThis, "reportError");
  t.after(() => own && Object.defineProperty(globalThis, "reportError", own));
  const logged: unknown[] = [];
  t.mock.method(console, "error", (e: unknown) => logged.push(e));
  await oneHandlerThrows(logged);
});

test("A subscriber that joins while an event is handed out does not hear it, and one that left does not", async () => {
  const { connections, join } = await shared();
  const heard: string[] = [];
  let next: ReturnType<typeof join> | undefined;
  const first = join({
    poll: () => {
      heard.push("first");
      first.leave();
      later.leave();
      next = join({ poll: () => heard.push("next") });
    },
  });
  const later = join({ poll: () => heard.push("later") });
  connections[0]!.on.onEvent("poll", '{"n":1}');
  assert.deepEqual(heard, ["first"]);
  connections[0]!.on.onEvent("poll", '{"n":2}');
  assert.deepEqual(heard, ["first", "next"]);
  next?.leave();
});

test("A body that will not parse still moves heard for the subscribers to its event", async () => {
  const { connections, join } = await shared();
  const poller = join({ poll: () => assert.fail("an unparsed body is not handed out") });
  const alarmer = join({ alarm: () => {} });
  connections[0]!.on.onEvent("poll", "{");
  assert.ok(poller.heard() !== undefined);
  assert.equal(alarmer.heard(), undefined);
  poller.leave();
  alarmer.leave();
});

test("The connection closes a tick after the last subscriber leaves, and one arriving within it inherits it", async () => {
  const { connections, join } = await shared();
  join({ poll: () => {} }).leave();
  join({ alarm: () => {} }).leave();
  assert.equal(connections.length, 1);
  assert.equal(connections[0]!.closed, false, "the last to leave holds it for a tick");

  const back = join({ poll: () => {} });
  await tick();
  assert.deepEqual([connections.length, connections[0]!.closed], [1, false]);

  back.leave();
  await tick();
  assert.equal(connections[0]!.closed, true);
  join({ poll: () => {} }).leave();
  assert.equal(connections.length, 2, "a subscriber after the close opens another");
});
