import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { refusalMessage } from "@wired-square/kit/core";

import { ApiError, api, download, fromBase, onUnauthenticated } from "../src/api.ts";

const MINUTE = 60_000;
const UNANSWERED = "nothing answered — it may be restarting, or unreachable from here";

let respond: (signal: AbortSignal | null | undefined) => Promise<Response>;
let sent: RequestInit[];

beforeEach(() => {
  sent = [];
  mock.timers.enable({ apis: ["setTimeout"] });
  // `AbortSignal.timeout` on the mocked clock, as it runs on the real one.
  mock.method(AbortSignal, "timeout", (ms: number) => {
    const expiry = new AbortController();
    setTimeout(() => expiry.abort(new DOMException("timed out", "TimeoutError")), ms);
    return expiry.signal;
  });
  mock.method(globalThis, "fetch", (_path: string, init: RequestInit) => {
    sent.push(init);
    return respond(init.signal);
  });
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

const settled = () => new Promise((resolve) => setImmediate(resolve));

// Each fake answer does what a real fetch does once its signal aborts: the
// promise rejects, or the body errors. With no signal, nothing ends it.
test("a call nobody answers gives up as unanswered after a minute", async () => {
  respond = (signal) =>
    new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason)));

  let outcome: unknown;
  api("/api/host/network").catch((error: unknown) => (outcome = error));
  mock.timers.tick(MINUTE);
  await settled();

  assert.ok(outcome instanceof ApiError, `still waiting: ${String(outcome)}`);
  assert.equal(outcome.status, 0);
  assert.equal(outcome.message, UNANSWERED);
});

test("a body still arriving when the minute is up is read in full", async () => {
  let rest = (_: string) => {};
  respond = (signal) => {
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        const bytes = new TextEncoder();
        stream.enqueue(bytes.encode('{"backup":'));
        signal?.addEventListener("abort", () => stream.error(signal.reason));
        rest = (tail) => {
          if (signal?.aborted) return;
          stream.enqueue(bytes.encode(tail));
          stream.close();
        };
      },
    });
    return Promise.resolve(new Response(body));
  };

  const call = api<{ backup: string }>("/api/backup/inspect");
  await settled();
  mock.timers.tick(MINUTE);
  rest('"whole"}');

  assert.deepEqual(await call, { backup: "whole" });
});

test("a call carrying its own signal keeps it in place of the minute", async () => {
  const own = new AbortController();
  respond = () => Promise.resolve(Response.json(null));

  await api("/api/session", { signal: own.signal });

  assert.equal(sent[0]?.signal, own.signal);
});

const bodyReaders = [
  (signal: AbortSignal) => api("/api/backup/inspect", { signal }),
  (signal: AbortSignal) => download("/api/backup", "backup.tar", { signal }),
];

test("a body cut off by the caller's signal fails as unanswered", async () => {
  respond = (signal) => {
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('{"backup":'));
        signal?.addEventListener("abort", () => stream.error(signal.reason));
      },
    });
    return Promise.resolve(new Response(body));
  };

  for (const call of bodyReaders) {
    const own = new AbortController();
    const outcome = call(own.signal).catch((error: unknown) => error);
    await settled();
    own.abort(new Error("screen closed"));

    const error = await outcome;
    assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
    assert.equal(error.status, 0);
    assert.equal(error.message, UNANSWERED);
  }
});

test("a body cut off by a dropped connection fails as unanswered", async () => {
  respond = () =>
    Promise.resolve(
      new Response(
        new ReadableStream({ start: (stream) => stream.error(new TypeError("terminated")) }),
      ),
    );

  for (const call of bodyReaders) {
    const error = await call(new AbortController().signal).catch((error: unknown) => error);
    assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
    assert.equal(error.status, 0);
    assert.equal(error.message, UNANSWERED);
  }
});

test("an answer whose whole body is not JSON fails as a parse error", async () => {
  respond = () => Promise.resolve(new Response("<html>"));

  const error = await api("/api/backup/inspect").catch((error: unknown) => error);

  assert.ok(error instanceof SyntaxError, `failed as: ${String(error)}`);
});

test("a refusal whose body is cut off by the caller's signal fails as unanswered", async () => {
  respond = (signal) => {
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('{"error":'));
        signal?.addEventListener("abort", () => stream.error(signal.reason));
      },
    });
    return Promise.resolve(new Response(body, { status: 403 }));
  };

  const own = new AbortController();
  const outcome = api("/api/host/network", { signal: own.signal }).catch((error: unknown) => error);
  await settled();
  own.abort(new Error("screen closed"));

  const error = await outcome;
  assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
  assert.equal(error.status, 0);
  assert.equal(error.message, UNANSWERED);
});

test("a refusal whose body is lost with the signal live keeps its status", async () => {
  respond = () =>
    Promise.resolve(
      new Response(
        new ReadableStream({ start: (stream) => stream.error(new TypeError("terminated")) }),
        { status: 503 },
      ),
    );

  const error = await api("/api/host/network", { signal: new AbortController().signal }).catch(
    (error: unknown) => error,
  );

  assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
  assert.equal(error.status, 503);
  assert.equal(error.message, "the request was refused, with nothing said about why (503)");
});

test("a 401 whose body is cut off by the caller's signal still signs the screen out", async () => {
  respond = (signal) => {
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('{"error":'));
        signal?.addEventListener("abort", () => stream.error(signal.reason));
      },
    });
    return Promise.resolve(new Response(body, { status: 401 }));
  };
  let heard = 0;
  const stop = onUnauthenticated(() => heard++);

  const own = new AbortController();
  const outcome = api("/api/session", { signal: own.signal }).catch((error: unknown) => error);
  await settled();
  own.abort(new Error("screen closed"));
  const error = await outcome;
  stop();

  assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
  assert.equal(error.status, 401);
  assert.equal(error.message, "the request was refused, with nothing said about why (401)");
  assert.equal(heard, 1);
});

test("a programming error reaches the operator as the fixed sentence", () => {
  mock.method(console, "error", () => {});
  assert.equal(refusalMessage(new TypeError("tls is undefined")), "something went wrong in this page");
});

test("a path is asked for under the page's base, and as written with no document", async () => {
  const asked: string[] = [];
  mock.method(globalThis, "fetch", (path: string) => {
    asked.push(path);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  await api<null>("/api/session");
  Object.assign(globalThis, { document: { baseURI: "https://box.local/apps/hello/settings" } });
  try {
    await api<null>("/api/session");
    assert.equal(fromBase("api/logs/events"), "https://box.local/apps/hello/api/logs/events");
  } finally {
    Reflect.deleteProperty(globalThis, "document");
  }
  assert.deepEqual(asked, ["/api/session", "https://box.local/apps/hello/api/session"]);
});

test("a form is sent as the browser frames it, and anything else as JSON", async () => {
  respond = async () => new Response(null, { status: 204 });
  const form = new FormData();
  form.append("password", "correct horse battery");
  await api<null>("/api/upgrade", { method: "POST", body: form });
  await api<null>("/api/session/password", { method: "PUT", body: { a: 1 } });

  const [asForm, asJson] = sent;
  assert.ok(asForm && asJson);
  assert.equal(asForm.body, form);
  assert.equal(new Headers(asForm.headers).get("content-type"), null);
  assert.equal(asJson.body, '{"a":1}');
  assert.equal(new Headers(asJson.headers).get("content-type"), "application/json");
});
