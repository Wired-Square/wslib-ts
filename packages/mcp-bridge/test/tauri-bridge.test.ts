import { page } from "./dom.ts";

import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import type { InvokeArgs } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";

import { REPLY_EVENT, REQUEST_EVENT, answer, startHarnessBridge } from "../src/tauri-bridge.ts";

test("the events are harness:request and harness:reply", () => {
  equal(REQUEST_EVENT, "harness:request");
  equal(REPLY_EVENT, "harness:reply");
});

test("answer tries the app's ops before the DOM ops", async () => {
  page("<p>Page</p>");
  const appOps = { navigate: ({ path }: Record<string, unknown>) => ({ path }), query: () => "app" };
  deepEqual(await answer({ id: 1, op: "navigate", args: { path: "/logs" } }, appOps), { id: 1, ok: { path: "/logs" } });
  deepEqual(await answer({ id: 2, op: "query", args: { selector: "p" } }, appOps), { id: 2, ok: "app" });
  const dom = (await answer({ id: 3, op: "query", args: { selector: "p" } })) as { id: number; ok: { matches: { text: string }[] } };
  deepEqual([dom.id, dom.ok.matches[0]?.text], [3, "Page"]);
});

test("answer turns a throw into an error reply", async () => {
  const appOps = {
    refuse: () => Promise.reject(new Error("no route")),
    odd: () => {
      throw "plain";
    },
  };
  deepEqual(await answer({ id: 4, op: "refuse", args: {} }, appOps), { id: 4, error: "no route" });
  deepEqual(await answer({ id: 5, op: "odd", args: {} }, appOps), { id: 5, error: "plain" });
  deepEqual(await answer({ id: 6, op: "toString", args: {} }, appOps), { id: 6, error: "unknown dom op toString" });
});

test("startHarnessBridge answers each request event with a reply event", async () => {
  let listened: { event: string; handler: number } | undefined;
  let resolve: (emitted: unknown) => void = () => {};
  const replied = new Promise((r) => (resolve = r));
  mockIPC((cmd, args?: InvokeArgs) => {
    const { event, payload, handler } = args as { event: string; payload?: unknown; handler: number };
    if (cmd === "plugin:event|listen") listened = { event, handler };
    if (cmd === "plugin:event|emit") resolve({ event, payload });
    return handler;
  });

  await startHarnessBridge({ ping: () => "pong" });
  equal(listened?.event, "harness:request");
  const { runCallback } = (window as unknown as { __TAURI_INTERNALS__: { runCallback: (id: number, data: unknown) => void } })
    .__TAURI_INTERNALS__;
  runCallback(listened!.handler, { event: REQUEST_EVENT, id: 1, payload: { id: 7, op: "ping", args: {} } });
  deepEqual(await replied, { event: "harness:reply", payload: { id: 7, ok: "pong" } });
});
