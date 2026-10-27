/**
 * One feed subscription, as signals: `follow` in `./follow` is the connection
 * and its watchdog.
 */
import { FEED_HEARTBEAT_S } from "@wired-square/appliance-types";
import { createRoot, createSignal, onCleanup, runWithOwner } from "solid-js";
import type { Accessor } from "solid-js";

import { fromBase } from "./api";
import { eventSource, follow } from "./follow";
import type { FeedTransport } from "./follow";

/**
 * How long without anything arriving before the feed is declared gone: three
 * missed heartbeats. Derived from the daemon's own interval so the two cannot
 * drift into a feed that reads dead while healthy.
 */
const SILENCE_MS = 3 * FEED_HEARTBEAT_S * 1000;

/**
 * Subscribe to `url`, handing each named event's parsed body to its handler.
 *
 * `E` maps event names to the wire type each carries; a body this build cannot
 * parse is dropped, though it still counts as the feed being alive. The
 * subscription closes with the owning component. `transport` carries it, an
 * `EventSource` unless one is given.
 *
 * `opened` counts connections, and is what a screen re-reads its snapshot on:
 * the daemon has subscribed this feed before it sends the head, so a snapshot
 * fetched after `open` overlaps the feed rather than leaving a gap — and a
 * reconnect is where the daemon may have restarted. `closed` is the route
 * refusing this session, which nothing here can mend. `heard` is when a named
 * event last arrived, by this browser's clock — heartbeats prove the
 * connection, not the data, so they do not move it — for `FeedStatus`.
 */
export function useFeed<E extends Record<string, unknown>>(
  url: string,
  handlers: EveryHandler<E>,
  transport?: FeedTransport,
): {
  live: Accessor<boolean>;
  opened: Accessor<number | undefined>;
  closed: Accessor<boolean>;
  heard: Accessor<number | undefined>;
} {
  const [heardAt, setHeardAt] = createSignal<number>();
  return { ...connect(url, handlers, transport, () => setHeardAt(Date.now())), heard: heardAt };
}

/** `useFeed` with each named event's arrival, before its body is parsed, told to `heard`. */
function connect(
  url: string,
  handlers: Record<string, (data: never) => void>,
  transport: FeedTransport | undefined,
  heard: (name: string) => void,
) {
  const [live, setLive] = createSignal(false);
  const [opened, setOpened] = createSignal<number>();
  const [closed, setClosed] = createSignal(false);

  onCleanup(
    follow(
      fromBase(url),
      handlers as Record<string, (data: unknown) => void>,
      transport ?? eventSource(Object.keys(handlers)),
      {
        live: setLive,
        opened: () => setOpened((n) => (n ?? 0) + 1),
        closed: () => setClosed(true),
        heard,
      },
      SILENCE_MS,
    ),
  );
  return { live, opened, closed };
}

type EveryHandler<E> = { [K in keyof E & string]: (data: E[K]) => void };

export type FeedHandlers<E extends Record<string, unknown>> = Partial<EveryHandler<E>>;

/**
 * One `useFeed` connection to `url` for every subscriber: the first
 * `subscribe` opens it and it closes a tick after the last subscriber's owner
 * is cleaned up, so a screen replacing another inherits it. `events` names
 * every event `E` carries. `live`, `opened` and `closed` are the connection's;
 * `heard` is the subscriber's own, moved only by the events it handles. A
 * handler that throws goes to `reportError`, or `console.error` where there is
 * none, and the others still run.
 */
export function sharedFeed<E extends Record<string, unknown>>(
  url: string,
  events: { [K in keyof E & string]: true },
  transport?: FeedTransport,
): (handlers: FeedHandlers<E>) => ReturnType<typeof useFeed> {
  type Subscriber = { handlers: FeedHandlers<E>; heard: (at: number) => void };
  const subscribers = new Set<Subscriber>();
  let shared: { feed: ReturnType<typeof connect>; close: () => void } | undefined;
  let closing: ReturnType<typeof setTimeout> | undefined;

  const handling = (name: string, act: (subscriber: Subscriber, handle: (data: never) => void) => void) => {
    for (const subscriber of [...subscribers]) {
      const handle = subscriber.handlers[name as keyof E & string];
      if (!handle || !subscribers.has(subscriber)) continue;
      try {
        act(subscriber, handle);
      } catch (e) {
        if (typeof reportError === "function") reportError(e);
        else console.error(e);
      }
    }
  };
  const fannedOut = Object.fromEntries(
    Object.keys(events).map((name) => [name, (data: never) => handling(name, (_, handle) => handle(data))]),
  );
  const heardBy = (name: string) => {
    const at = Date.now();
    handling(name, (subscriber) => subscriber.heard(at));
  };

  return (handlers) => {
    clearTimeout(closing);
    shared ??= runWithOwner(null, () =>
      createRoot((close) => ({ feed: connect(url, fannedOut, transport, heardBy), close })),
    )!;
    const [heard, setHeard] = createSignal<number>();
    const subscriber = { handlers, heard: setHeard };
    subscribers.add(subscriber);
    onCleanup(() => {
      subscribers.delete(subscriber);
      if (subscribers.size > 0) return;
      closing = setTimeout(() => {
        shared?.close();
        shared = undefined;
      });
    });
    return { ...shared.feed, heard };
  };
}
