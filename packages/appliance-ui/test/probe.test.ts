import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import type { BrandingView } from "@wired-square/appliance-types";

import { startProbe } from "../src/shell/probe.ts";
import type { Probed } from "../src/shell/probe.ts";

const MS = 5_000;

const view = (build: string, hostname = "widget-1234"): BrandingView => ({
  build,
  app_name: "Widget Monitor",
  manufacturer: "A Manufacturer",
  tokens: {},
  tokens_dark: {},
  hostname,
});

const page = new (class extends EventTarget {
  hidden = false;
})();

let answers: (() => Promise<Response>)[];
let sent: RequestInit[];

beforeEach(() => {
  page.hidden = false;
  answers = [];
  sent = [];
  Object.assign(globalThis, { document: page });
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  mock.method(globalThis, "fetch", (_path: string, init: RequestInit) => {
    sent.push(init);
    const answer = answers.shift();
    assert.ok(answer, "a probe nobody expected");
    return answer();
  });
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

const answered = (build: string, etag: string, hostname?: string) => () =>
  Promise.resolve(Response.json(view(build, hostname), { headers: { etag } }));
const unchanged = (etag: string) => () =>
  Promise.resolve(new Response(null, { status: 304, headers: { etag } }));
const tags = () => sent.map((init) => new Headers(init.headers).get("if-none-match"));

/** A pending answer, and the means to settle it. */
function held() {
  const settle = { answer: (_: Response) => {}, fail: (_: unknown) => {} };
  answers.push(
    () =>
      new Promise((resolve, reject) => {
        settle.answer = resolve;
        settle.fail = reject;
      }),
  );
  return settle;
}

function mounted(
  build: string | undefined,
  state: Partial<Pick<Probed, "busy" | "tag" | "rendered" | "failed">> = {},
) {
  const shell = {
    busy: () => false,
    page: () => (build === undefined ? undefined : view(build)),
    tag: () => undefined,
    rendered: () => true,
    failed: () => false,
    ...state,
    adopt: mock.fn<Probed["adopt"]>(),
    reload: mock.fn(),
    reask: mock.fn(),
  };
  return { shell, stop: startProbe(shell, MS) };
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

async function tick() {
  mock.timers.tick(MS);
  await settled();
}

test("the probe sends the tag it was last answered with, and a 304 is the same build", async () => {
  const { shell, stop } = mounted("b1");
  answers.push(answered("b1", 'W/"one"'), unchanged('W/"one"'), unchanged('W/"one"'));

  await tick();
  await tick();
  await tick();
  stop();

  assert.deepEqual(tags(), [null, 'W/"one"', 'W/"one"']);
  assert.ok(sent.every((init) => init.cache === "no-store"));
  assert.equal(shell.reload.mock.callCount(), 0);
  assert.equal(shell.adopt.mock.callCount(), 0);
  assert.equal(shell.reask.mock.callCount(), 0);
});

test("the first probe sends the tag the page's first answer came with", async () => {
  const { shell, stop } = mounted("b1", { tag: () => 'W/"one"' });
  answers.push(unchanged('W/"one"'));

  await tick();
  stop();

  assert.deepEqual(tags(), ['W/"one"']);
  assert.equal(shell.reload.mock.callCount(), 0);
  assert.equal(shell.reask.mock.callCount(), 0);
});

test("a different build reloads, after a 304 as well as on the first", async () => {
  const { shell, stop } = mounted("b1");
  answers.push(
    answered("b1", 'W/"one"'),
    unchanged('W/"one"'),
    answered("b2", 'W/"two"'),
    unchanged('W/"two"'),
  );

  await tick();
  await tick();
  assert.equal(shell.reload.mock.callCount(), 0);
  await tick();
  await tick();
  stop();

  assert.deepEqual(tags(), [null, 'W/"one"', 'W/"one"', 'W/"two"']);
  assert.equal(shell.reload.mock.callCount(), 2);
});

test("a 304 to a probe that sent no tag is a failure, not an answer", async () => {
  const { shell, stop } = mounted("b1");
  answers.push(unchanged('W/"one"'));

  await tick();
  stop();

  assert.equal(shell.reask.mock.callCount(), 1);
  assert.equal(shell.reload.mock.callCount(), 0);
});

test("a refusal is a failure, whatever its body says", async () => {
  const { shell, stop } = mounted("b1");
  answers.push(() => Promise.resolve(Response.json(view("b2"), { status: 503 })));

  await tick();
  stop();

  assert.equal(shell.reask.mock.callCount(), 1);
  assert.equal(shell.reload.mock.callCount(), 0);
});

test("a page with no first answer adopts the probe's", async () => {
  const { shell, stop } = mounted(undefined);
  answers.push(answered("b1", 'W/"one"'));

  await tick();
  stop();

  assert.equal(shell.adopt.mock.calls[0]?.arguments[0]?.build, "b1");
});

test("an answer naming another hostname is adopted, without a reload", async () => {
  const { shell, stop } = mounted("b1");
  answers.push(answered("b1", 'W/"one"'), answered("b1", 'W/"two"', "widget-5678"));

  await tick();
  await tick();
  stop();

  assert.equal(shell.adopt.mock.callCount(), 1);
  assert.equal(shell.adopt.mock.calls[0]?.arguments[0]?.hostname, "widget-5678");
  assert.equal(shell.reload.mock.callCount(), 0);
});

test("a page with no first answer and nothing rendered reloads on the first", async () => {
  const { shell, stop } = mounted(undefined, { rendered: () => false });
  answers.push(answered("b1", 'W/"one"'));

  await tick();
  stop();

  assert.equal(shell.reload.mock.callCount(), 1);
  assert.equal(shell.adopt.mock.callCount(), 0);
});

test("an answer after a failed ask re-asks the session, and a failure does not again", async () => {
  const { shell, stop } = mounted("b1", { failed: () => true });
  answers.push(answered("b1", 'W/"one"'), () => Promise.reject(new TypeError("Failed to fetch")));

  await tick();
  await tick();
  stop();

  assert.equal(shell.reask.mock.callCount(), 1);
});

test("a shell already asking is not probed", async () => {
  const { stop } = mounted("b1", { busy: () => true });

  await tick();
  stop();

  assert.equal(sent.length, 0);
});

test("a hidden tab is not probed, and is probed once as soon as it is shown", async () => {
  const { stop } = mounted("b1");
  page.hidden = true;

  await tick();
  await tick();
  page.dispatchEvent(new Event("visibilitychange"));
  await settled();
  assert.equal(sent.length, 0);

  page.hidden = false;
  answers.push(answered("b1", 'W/"one"'));
  page.dispatchEvent(new Event("visibilitychange"));
  await settled();
  stop();

  assert.equal(sent.length, 1);
});

test("one probe is in flight at a time, and a failure re-asks the session", async () => {
  const { shell, stop } = mounted("b1");
  const pending = held();

  await tick();
  await tick();
  page.dispatchEvent(new Event("visibilitychange"));
  await tick();
  assert.equal(sent.length, 1);

  pending.fail(new TypeError("Failed to fetch"));
  await settled();
  assert.equal(shell.reask.mock.callCount(), 1);

  answers.push(answered("b1", 'W/"one"'));
  await tick();
  stop();
  assert.equal(sent.length, 2);
});

test("stopping it stops the timer and the listener", async () => {
  const { stop } = mounted("b1");
  stop();

  await tick();
  page.dispatchEvent(new Event("visibilitychange"));
  await settled();

  assert.equal(sent.length, 0);
});

test("a probe is aborted when it has not answered within the interval, and not after it has", async () => {
  const { shell, stop } = mounted("b1");
  const pending = held();
  await tick();
  await tick();
  assert.equal(sent[0]?.signal?.aborted, true);
  pending.fail(new DOMException("timed out", "AbortError"));
  await settled();
  assert.equal(shell.reask.mock.callCount(), 1);

  answers.push(answered("b1", 'W/"one"'), unchanged('W/"one"'));
  await tick();
  await tick();
  stop();
  assert.equal(sent.length, 3);
  assert.equal(sent[1]?.signal?.aborted, false);
});

test("the timeout covers reading the body, not only the headers", async () => {
  const { stop } = mounted("b1");
  answers.push(() => Promise.resolve(new Response(new ReadableStream())));

  await tick();
  await tick();
  assert.equal(sent[0]?.signal?.aborted, true);
  stop();
});

test("stopping it aborts the probe in flight, and nothing is done with its answer", async () => {
  for (const land of [
    (pending: ReturnType<typeof held>) => pending.answer(Response.json(view("b2"))),
    (pending: ReturnType<typeof held>) => pending.fail(new DOMException("aborted", "AbortError")),
  ]) {
    const { shell, stop } = mounted(undefined, { rendered: () => false });
    const pending = held();
    await tick();

    stop();
    assert.equal(sent.at(-1)?.signal?.aborted, true);
    land(pending);
    await settled();

    assert.equal(shell.reload.mock.callCount(), 0);
    assert.equal(shell.adopt.mock.callCount(), 0);
    assert.equal(shell.reask.mock.callCount(), 0);
  }
});
