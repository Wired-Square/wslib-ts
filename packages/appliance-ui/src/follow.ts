/**
 * One feed's connections, whatever carries them, and the watchdog that decides
 * whether one is attached.
 *
 * **The watchdog is the part not to simplify away.** Keyed on events, a quiet feed
 * reads "not live" for a whole interval after every reconnect; keyed on
 * `open`/`error`, a connection a NAT quietly dropped fires neither and reads
 * "live" forever. Only the expiry of a timer reset by *anything arriving*
 * proves silence, and the daemon's `heartbeat` is a named event so that it
 * counts as arriving.
 *
 * The default transport is `EventSource`, which reconnects on its own — most of
 * why it is used in preference to `fetch` with a reader: a daemon restart is
 * ordinary. What it will not retry is an answer that is not an event stream,
 * a non-200 or a 200 of another type, and that is two different things here: a
 * session the feed's route refuses, and a proxy answering for a daemon that is
 * restarting — vite's dev server does. A plain `fetch` of the same URL tells
 * them apart by its status, so the feed is reopened unless it is the session
 * that is gone.
 */

import { fetchWithSession, withSession } from "./api";

/** Where a transport reports one connection. */
export interface FeedListener {
  /** The connection is open, and the route has subscribed it. */
  onOpen(): void;
  /** One named event and its data as sent, `heartbeat` included. */
  onEvent(name: string, data: string): void;
  /**
   * The connection ended, with the status the route answered, or 0 for none.
   * The transport is done with it: 401 and 403 end the feed, and anything else
   * is reopened 5 s later.
   */
  onClose(status: number): void;
}

/** Open one connection to a feed's `url`, reporting to `on`; the return closes it. */
export type FeedTransport = (url: string, on: FeedListener) => () => void;

/** `EventSource` retries a dropped connection itself, and says so here. */
type Listener = FeedListener & { onDrop(): void };

const REOPEN_MS = 5_000;

/** What `follow` tells its owner. */
interface Followed {
  live(live: boolean): void;
  opened(): void;
  closed(): void;
  heard(name: string): void;
}

/**
 * Keep `url` open over `transport`, handing each named event's parsed body to
 * its handler, until the return is called. A body that will not parse is
 * dropped, and still counts as the feed being alive.
 */
export function follow(
  url: string,
  handlers: Record<string, (data: unknown) => void>,
  transport: (url: string, on: Listener) => () => void,
  report: Followed,
  silenceMs: number,
): () => void {
  let current: { done: boolean; close?: (() => void) | undefined } | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let reopen: ReturnType<typeof setTimeout> | undefined;
  const alive = () => {
    report.live(true);
    clearTimeout(watchdog);
    watchdog = setTimeout(() => report.live(false), silenceMs);
  };
  const dropped = () => {
    clearTimeout(watchdog);
    report.live(false);
  };

  // A listener per connection: whatever one reports once it is done is ignored.
  const connect = () => {
    const connection: NonNullable<typeof current> = { done: false };
    current = connection;
    const close = transport(url, {
      onOpen: () => {
        if (connection.done) return;
        alive();
        report.opened();
      },
      onEvent: (name, data) => {
        if (connection.done) return;
        alive();
        const handle = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : undefined;
        if (!handle) return;
        report.heard(name);
        let body: unknown;
        try {
          body = JSON.parse(data);
        } catch {
          return;
        }
        handle(body);
      },
      onClose: (status) => {
        if (connection.done) return;
        connection.done = true;
        connection.close = undefined;
        dropped();
        if (status === 401 || status === 403) report.closed();
        else reopen = setTimeout(connect, REOPEN_MS);
      },
      onDrop: () => {
        if (!connection.done) dropped();
      },
    });
    if (!connection.done) connection.close = close;
  };
  connect();

  return () => {
    const last = current;
    if (last) last.done = true;
    clearTimeout(watchdog);
    clearTimeout(reopen);
    last?.close?.();
  };
}

/** The default transport, listening for `names` and the heartbeat. */
export function eventSource(names: string[]): (url: string, on: Listener) => () => void {
  return (url, on) => {
    const source = new EventSource(withSession(url), { withCredentials: true });
    source.addEventListener("open", () => on.onOpen());
    source.addEventListener("error", () => {
      on.onDrop();
      if (source.readyState !== EventSource.CLOSED) return;
      void statusOf(url).then((status) => on.onClose(status));
    });
    for (const name of new Set(["heartbeat", ...names])) {
      source.addEventListener(name, (e) => on.onEvent(name, (e as MessageEvent<string>).data));
    }
    return () => source.close();
  };
}

/** What the route answers a plain request, or 0 for no answer. */
async function statusOf(url: string): Promise<number> {
  try {
    const response = await fetchWithSession(url, { credentials: "same-origin" });
    void response.body?.cancel();
    return response.status;
  } catch {
    return 0;
  }
}
