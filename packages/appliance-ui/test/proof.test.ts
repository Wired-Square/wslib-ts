import assert from "node:assert/strict";
import { test } from "node:test";
import { STALE_PROOF } from "@wired-square/appliance-types";

import { click, find, load, mount, proofDialog, prove, settled, textOf, within } from "./mount.ts";
import type { Answer } from "./mount.ts";
import type { Element } from "./universal.ts";

const proofs = () => load<typeof import("../src/parts/withProof.tsx")>("/src/parts/withProof.tsx");

const totp = (on: boolean): Answer => (path) =>
  path === "/api/session/totp" ? Response.json({ on, recovery_codes_left: 10 }) : undefined;

const open = (root: Element) => [...within(root)].some((n) => n.tag === "dialog");

const code = (n: Element) => n.props.autocomplete === "one-time-code";

/** A `withProof` asked over a mounted host, its outcome kept once it settles. */
async function asking(answer: Answer, send = (proof: object): Promise<NonNullable<unknown> | null> => Promise.resolve(proof)) {
  const { withProof } = await proofs();
  const { root, asked } = await mount(() => null, answer);
  const outcome: { value?: unknown; error?: unknown; settled: boolean } = { settled: false };
  withProof({ for: "Delete widget-01?", about: "It is gone for good.", verb: "Delete" }, send).then(
    (value) => Object.assign(outcome, { value, settled: true }),
    (error: unknown) => Object.assign(outcome, { error, settled: true }),
  );
  await settled();
  return { root, asked, outcome };
}

test("A proof asked for opens one dialog naming the change, and resolves with what send did once it closes", async () => {
  const sent: unknown[] = [];
  const { root, outcome } = await asking(totp(false), async (proof) => {
    sent.push(proof);
    return "done";
  });
  const dialog = proofDialog(root);
  assert.match(textOf(dialog), /Delete widget-01\?/);
  assert.match(textOf(dialog), /It is gone for good\./);
  await prove(root, "correct horse battery");
  assert.deepEqual(sent, [{ password: "correct horse battery" }]);
  assert.deepEqual(outcome, { value: "done", settled: true });
  assert.ok(!open(root));
});

test("A cancelled proof resolves undefined and sends nothing", async () => {
  const sent: unknown[] = [];
  const { root, outcome } = await asking(totp(false), async (proof) => sent.push(proof));
  await click(proofDialog(root), "Cancel");
  assert.deepEqual(outcome, { value: undefined, settled: true });
  assert.deepEqual(sent, []);
  assert.ok(!open(root));
});

test("A refused proof keeps the dialog open, says why beside the field, clears it, and a second try lands", async () => {
  const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  let tries = 0;
  const { root, outcome } = await asking(totp(true), async (proof) => {
    if (tries++ === 0) throw new ApiError(403, "the code is incorrect", true);
    return proof;
  });
  await prove(root, "111111", code);
  assert.equal(outcome.settled, false);
  const field = find(proofDialog(root), (n) => n.tag === "input" && code(n));
  assert.equal(field.props.value, "", "cleared for another try");
  assert.equal(field.props["aria-invalid"], "true");
  assert.match(textOf(proofDialog(root)), /the code is incorrect/);

  await prove(root, "222222", code);
  assert.equal((outcome.value as { code: string }).code, "222222");
  assert.ok(!open(root));
});

test("A refusal that is not the proof's closes the dialog and rejects with it", async () => {
  const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  const last = new ApiError(403, "the last administrator cannot be deleted over HTTPS", true);
  const { root, outcome } = await asking(totp(false), () => Promise.reject(last));
  await prove(root, "correct horse battery");
  assert.deepEqual(outcome, { error: last, settled: true });
  assert.ok(!open(root));
});

test("The proof is refused by the daemon's marker, a clock skew, a 429 that says when, or a reauth sentence, and nothing else", async () => {
  const { refusedProof } = await proofs();
  const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  const error = (status: number, message: string, body: Record<string, unknown> = {}) =>
    new ApiError(status, message, true, undefined, { error: message, ...body } as never);
  const skewed = new ApiError(400, "the code is incorrect", true, { minutes: 7 } as never);
  for (const [refused, why] of [
    [error(403, "whatever it says", { proof: "refused" }), "the marker"],
    [skewed, "a clock skew"],
    [error(429, "too many tries", { retry_after: 30 }), "a 429 that says when"],
    [error(403, "the code is incorrect"), "a wrong code"],
    [error(403, "that code has just been used; wait for the next one"), "a spent code"],
    [error(403, "the password is incorrect"), "a wrong password"],
    [error(403, "the passkey was not accepted"), "a refused passkey"],
    [error(403, "while TOTP is on, this needs a code from the authenticator app, a recovery code or a passkey"), "the password alone"],
    [error(403, `${STALE_PROOF} in the last 5 minutes`), "a stale proof"],
  ] as const) {
    assert.equal(refusedProof(refused), true, why);
  }
  for (const [other, why] of [
    [error(429, "too many tries"), "a 429 that does not say when"],
    [error(404, "this account has no such passkey"), "a target that is gone"],
    [error(403, "the last administrator cannot be deleted over HTTPS"), "another 403"],
    [error(400, "the code is incorrect"), "a sentence at another status"],
    [new Error("the code is incorrect"), "not the appliance's"],
  ] as const) {
    assert.equal(refusedProof(other), false, why);
  }
});

test("A proof asked with no host mounted throws, and a second while one is open is refused", async () => {
  const { withProof } = await proofs();
  assert.throws(() => withProof({ for: "Delete widget-01?" }, async () => null), /no ProofHost mounted/);

  const { root } = await asking(totp(false));
  await assert.rejects(withProof({ for: "Something else" }, async () => null), /another proof is being asked for/);
  assert.match(textOf(proofDialog(root)), /Delete widget-01\?/, "the first stays open");
});

test("The dialog's code field takes six digits as a one-time code, and a recovery code is not held to them", async () => {
  const { root } = await asking(totp(true));
  const field = () => find(proofDialog(root), (n) => n.tag === "input" && code(n));
  assert.deepEqual(
    [field().props.maxLength, field().props.pattern, field().props.inputmode],
    [6, "[0-9]*", "numeric"],
  );
  const select = find(proofDialog(root), (n) => n.tag === "select");
  for (let at: Element | undefined = select; at; at = at.parent) {
    (at.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { value: "recovery" } });
  }
  await settled();
  assert.deepEqual([field().props.maxLength, field().props.pattern], [undefined, undefined]);
});

/** A browser with passkeys whose every `get` is counted. */
async function withPasskeys(run: (gets: () => number) => Promise<void>) {
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const bytes = (...b: number[]) => new Uint8Array(b).buffer;
  let gets = 0;
  Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      credentials: {
        get: async () => {
          gets++;
          return {
            id: "AQI",
            rawId: bytes(1, 2),
            type: "public-key",
            response: { clientDataJSON: bytes(3), authenticatorData: bytes(5), signature: bytes(6), userHandle: null },
          };
        },
      },
    },
  });
  try {
    await run(() => gets);
  } finally {
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }
}

test("A passkey is asked for when the dialog is sent, and again with a fresh challenge after a refusal", async () => {
  await withPasskeys(async (gets) => {
    const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
    let tries = 0;
    const answer: Answer = (path, init) =>
      path === "/api/session/totp"
        ? Response.json({ on: false, recovery_codes_left: 0 })
        : path === "/api/session/passkey/availability"
          ? Response.json({ state: "ready", via: "box.local" })
          : path === "/api/session/passkeys/hosts"
            ? Response.json([{ host: "box.local", passkeys: 1 }])
            : path === "/api/session/reauthentication/options" && init.method === "POST"
              ? Response.json({ challenge: "AQ", rpId: "box.local", timeout: 60000, allowCredentials: [], userVerification: "required" })
              : undefined;
    const { root, asked, outcome } = await asking(answer, async (proof) => {
      if (tries++ === 0) throw new ApiError(403, "the passkey was not accepted", true);
      return proof;
    });
    const select = find(proofDialog(root), (n) => n.tag === "select");
    for (let at: Element | undefined = select; at; at = at.parent) {
      (at.props.onChange as ((e: unknown) => void) | undefined)?.({ target: { value: "passkey" } });
    }
    await settled();
    assert.match(textOf(proofDialog(root)), /Your passkey is asked for when you go ahead/);
    assert.equal(gets(), 0, "not before the dialog is sent");

    const send = async () => {
      (find(proofDialog(root), (n) => n.tag === "form").props.onSubmit as (e: unknown) => void)({ preventDefault() {} });
      await settled();
    };
    await send();
    assert.equal(gets(), 1);
    assert.match(textOf(proofDialog(root)), /the passkey was not accepted/);
    await send();
    assert.equal(gets(), 2);
    const challenges = asked.filter((a) => a.path === "/api/session/reauthentication/options").length;
    assert.equal(challenges, 2, "a challenge per ceremony");
    assert.ok("passkey" in (outcome.value as object));
    assert.ok(!open(root));
  });
});

test("withPassword asks the password, or a passkey where one is made here, and hands send a Reauthentication", async () => {
  const { withPassword } = await proofs();
  const { root } = await mount(() => null, () => undefined);
  let sent: unknown;
  const done = withPassword({ for: "Change the address" }, async (proof) => (sent = proof));
  await settled();
  assert.match(textOf(proofDialog(root)), /Change the address/);
  assert.ok(!textOf(proofDialog(root)).includes("Use a passkey instead"), "none made here");
  await prove(root, "correct horse battery");
  assert.deepEqual(await done, { password: "correct horse battery" });
  assert.deepEqual(sent, { password: "correct horse battery" });
});

/** `Proved` with `props` over a mounted host, the proofs `act` was handed, and how often it closed. */
async function proved(props: { tone?: "danger"; act?: (proof: object) => Promise<void> } = {}) {
  const { Proved } = await load<typeof import("../src/parts/Proved.tsx")>("/src/parts/Proved.tsx");
  const acted: object[] = [];
  let closed = 0;
  const { root } = await mount(
    () =>
      Proved({
        title: "Remove widget-01?",
        verb: "Remove",
        act: props.act ?? (async (proof) => void acted.push(proof)),
        onClose: () => closed++,
        children: "It is gone for good.",
        ...(props.tone && { tone: props.tone }),
      }),
    totp(false),
  );
  return { root, acted, closed: () => closed };
}

const verbButton = (root: Element) =>
  [...within(root)].find((n) => n.tag === "button" && textOf(n) === "Remove" && n.props.type !== "submit");

test("Proved asks the proof over itself on its button, in its tone, primary by default, and closes once act is done", async () => {
  const { root, acted, closed } = await proved();
  assert.match(textOf(root), /Remove widget-01\?.*It is gone for good\./);
  assert.equal(verbButton(root)?.props.class, "app-btn app-btn--primary");
  await click(root, "Remove");
  const ask = proofDialog(root);
  assert.match(textOf(ask), /Remove widget-01\?/);
  assert.equal(find(ask, (n) => n.props.type === "submit").props.class, "app-btn app-btn--primary");
  await prove(root, "correct horse battery");
  assert.deepEqual(acted, [{ password: "correct horse battery" }]);
  assert.equal(closed(), 1);

  const danger = await proved({ tone: "danger" });
  assert.equal(verbButton(danger.root)?.props.class, "app-btn app-btn--danger");
});

test("Proved stays open on a cancelled proof, and shows a refusal that is not the proof's", async () => {
  const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  const cancelled = await proved();
  await click(cancelled.root, "Remove");
  await click(proofDialog(cancelled.root), "Cancel");
  assert.deepEqual([cancelled.acted, cancelled.closed()], [[], 0]);
  assert.match(textOf(cancelled.root), /Remove widget-01\?/);

  const refused = await proved({ act: () => Promise.reject(new ApiError(403, "widget-01 is in use", true)) });
  await click(refused.root, "Remove");
  await prove(refused.root, "correct horse battery");
  assert.equal(refused.closed(), 0);
  assert.match(textOf(refused.root), /widget-01 is in use/);
});
