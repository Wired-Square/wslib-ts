import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { refusalMessage } from "@wired-square/kit/core";

import {
  ApiError,
  SESSION_HEADER,
  api,
  carrySession,
  download,
  fromBase,
  onUnauthenticated,
  upload,
  withSession,
} from "../src/api.ts";

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
  carrySession(undefined);
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

test("a refusal keeps the body it came in, fields beside the sentence and all", async () => {
  const body = { error: "too many tries", retry_after: 30 };
  respond = () => Promise.resolve(Response.json(body, { status: 429 }));

  const error = await api("/api/session/totp/off").catch((error: unknown) => error);

  assert.ok(error instanceof ApiError);
  assert.deepEqual([error.message, error.body], ["too many tries", body]);
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

/** A store holding `secret`, remembering everything it was told to keep. */
function held(secret: string | undefined) {
  const kept: (string | undefined)[] = [];
  carrySession({ read: () => secret, keep: (next) => kept.push((secret = next)) });
  return kept;
}

const carried = (init: RequestInit | undefined) => new Headers(init?.headers).get(SESSION_HEADER);

test("with no store, no request carries a secret", async () => {
  respond = async () => new Response(null, { status: 204, headers: { [SESSION_HEADER]: "s-2" } });
  await api<null>("/api/session");
  assert.equal(carried(sent[0]), null);
  assert.equal(withSession("/api/logs/events"), "/api/logs/events");
});

test("a held secret is sent, and one handed back is kept for the next request", async () => {
  const kept = held("s-1");
  respond = async () => new Response(null, { status: 204, headers: { [SESSION_HEADER]: "s-2" } });
  await api<null>("/api/session", { method: "POST", body: {} });
  await download("/api/backup", "backup.tar").catch(() => undefined);
  assert.deepEqual(sent.map(carried), ["s-1", "s-2"]);
  assert.deepEqual(kept, ["s-2", "s-2"]);
});

test("a 401 forgets the secret, and a 401 handing back a new one keeps that", async () => {
  const kept = held("s-1");
  respond = async () => new Response(null, { status: 401 });
  await api("/api/session").catch(() => undefined);
  assert.deepEqual(kept, [undefined]);
  respond = async () => new Response(null, { status: 401, headers: { [SESSION_HEADER]: "s-3" } });
  await api("/api/session").catch(() => undefined);
  assert.deepEqual(kept, [undefined, "s-3"]);
});

test("the secret goes in the query only to the page base's api/ and ws/, and only when held", () => {
  Object.assign(globalThis, { document: { baseURI: "https://box.local/apps/hello/settings" } });
  try {
    assert.equal(withSession("api/logs/events"), "api/logs/events", "none held");
    held("s 1");
    assert.equal(
      withSession(fromBase("/api/logs/events")),
      "https://box.local/apps/hello/api/logs/events?appliance_session=s+1",
    );
    assert.equal(
      withSession("wss://box.local/apps/hello/ws/serial?baud=9600"),
      "wss://box.local/apps/hello/ws/serial?baud=9600&appliance_session=s+1",
    );
    for (const elsewhere of [
      "https://box.local/api/switcher",
      "https://box.local/apps/hello/assets/logo.svg",
      "https://other.local/apps/hello/api/logs/events",
      "https://box.local/apps/hello/apiary",
    ]) {
      assert.equal(withSession(elsewhere), elsewhere);
    }
  } finally {
    Reflect.deleteProperty(globalThis, "document");
  }
});

/** The part of `XMLHttpRequest` `upload` drives, moved along by the test. */
class FakeXhr {
  static last: FakeXhr;
  readonly HEADERS_RECEIVED = 2;
  readyState = 0;
  status = 0;
  responseText = "";
  method = "";
  url = "";
  body: unknown;
  aborted = false;
  sentHeaders = new Headers();
  answerHeaders = new Headers();
  upload: { onprogress?: (event: { loaded: number }) => void; onload?: () => void } = {};
  onreadystatechange?: () => void;
  onerror?: () => void;
  onload?: () => void;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    [this.method, this.url, this.readyState] = [method, url, 1];
  }
  setRequestHeader(name: string, value: string) {
    this.sentHeaders.set(name, value);
  }
  getResponseHeader(name: string) {
    return this.answerHeaders.get(name);
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
  }
  progress(loaded: number) {
    this.upload.onprogress?.({ loaded });
  }
  sent() {
    this.upload.onload?.();
  }
  answer(status: number, text = "", headers: Record<string, string> = {}) {
    [this.readyState, this.status, this.responseText] = [this.HEADERS_RECEIVED, status, text];
    this.answerHeaders = new Headers(headers);
    this.onreadystatechange?.();
    this.readyState = 4;
    this.onload?.();
  }
}

Object.assign(globalThis, { XMLHttpRequest: FakeXhr });

const UPLOAD_WAIT = 10 * MINUTE;
const archive = new Blob(["0123456789"]);

function uploading<T>(init?: Parameters<typeof upload>[3]) {
  const reported: [number, number][] = [];
  const outcome = upload<T>("/api/import", archive, (sent, total) => reported.push([sent, total]), init).catch(
    (error: unknown) => error,
  );
  return { xhr: FakeXhr.last, reported, outcome };
}

test("an upload sends the file itself, reports its progress, and resolves to the parsed answer", async () => {
  const { xhr, reported, outcome } = uploading<{ id: number }>();
  assert.equal(xhr.method, "POST");
  assert.equal(xhr.url, "/api/import");
  assert.equal(xhr.body, archive, "the Blob is the body, so the browser streams it");
  xhr.progress(4);
  xhr.progress(10);
  xhr.sent();
  xhr.answer(201, '{"id":7}');
  assert.deepEqual(await outcome, { id: 7 });
  assert.deepEqual(reported, [
    [4, 10],
    [10, 10],
  ]);
});

test("an upload answered 202 or 204 with no body resolves to null", async () => {
  for (const status of [202, 204]) {
    const { xhr, outcome } = uploading({ method: "PUT" });
    assert.equal(xhr.method, "PUT");
    xhr.answer(status);
    assert.equal(await outcome, null);
  }
});

test("an upload carries the held secret and its headers, and keeps one handed back", async () => {
  const kept = held("s-1");
  const { xhr, outcome } = uploading({ headers: [["x-archive", "db"]] });
  assert.equal(xhr.sentHeaders.get(SESSION_HEADER), "s-1");
  assert.equal(xhr.sentHeaders.get("x-archive"), "db");
  xhr.answer(204, "", { [SESSION_HEADER]: "s-2" });
  await outcome;
  assert.deepEqual(kept, ["s-2"]);
});

test("an upload refused is the ApiError api throws, and a 401 forgets the secret and signs the screen out", async () => {
  const refusedBy = async (status: number, text: string) => {
    const { xhr, outcome } = uploading();
    xhr.answer(status, text);
    const error = await outcome;
    assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
    return error;
  };
  const tooBig = await refusedBy(413, '{"error":"the archive is larger than the disk has room for"}');
  assert.deepEqual([tooBig.status, tooBig.message, tooBig.fromErrorBody], [413, "the archive is larger than the disk has room for", true]);
  const plain = await refusedBy(400, "invalid archive");
  assert.deepEqual([plain.status, plain.message, plain.fromErrorBody], [400, "invalid archive", false]);
  assert.equal((await refusedBy(502, "")).status, 0, "a proxy's bare 502 is unanswered");

  const kept = held("s-1");
  let heard = 0;
  const stop = onUnauthenticated(() => heard++);
  assert.equal((await refusedBy(401, "")).status, 401);
  stop();
  assert.deepEqual([kept, heard], [[undefined], 1]);
});

const assertUnanswered = (error: unknown) => {
  assert.ok(error instanceof ApiError, `escaped as: ${String(error)}`);
  assert.equal(error.status, 0);
  assert.equal(error.message, UNANSWERED);
};

test("an upload has no overall deadline, but fails as unanswered once no bytes have gone for the wait", async () => {
  const { xhr, outcome } = uploading();
  for (let sent = 1; sent <= 5; sent++) {
    mock.timers.tick(UPLOAD_WAIT - 1);
    xhr.progress(sent);
  }
  assert.equal(xhr.aborted, false, "slow but moving");
  mock.timers.tick(UPLOAD_WAIT);
  assertUnanswered(await outcome);
  assert.equal(xhr.aborted, true);
});

test("an upload whose body has gone fails as unanswered when no answer begins within the wait", async () => {
  const { xhr, outcome } = uploading();
  xhr.progress(10);
  xhr.sent();
  mock.timers.tick(UPLOAD_WAIT);
  assertUnanswered(await outcome);
  assert.equal(xhr.aborted, true);
});

test("an upload's answer, once begun, is not timed", async () => {
  const { xhr, outcome } = uploading();
  xhr.sent();
  xhr.readyState = xhr.HEADERS_RECEIVED;
  xhr.onreadystatechange?.();
  mock.timers.tick(2 * UPLOAD_WAIT);
  xhr.answer(204);
  assert.equal(await outcome, null);
});

test("an upload that fails on the network is unanswered", async () => {
  const { xhr, outcome } = uploading();
  xhr.onerror?.();
  assertUnanswered(await outcome);
});

test("an upload aborted by the caller's signal rejects with its reason, as fetch would", async () => {
  const own = new AbortController();
  const { xhr, outcome } = uploading({ signal: own.signal });
  const reason = new Error("screen closed");
  own.abort(reason);
  assert.equal(await outcome, reason);
  assert.equal(xhr.aborted, true);

  const before = await upload("/api/import", archive, () => {}, { signal: own.signal }).catch((error: unknown) => error);
  assert.equal(before, reason, "a signal already aborted sends nothing");
});
