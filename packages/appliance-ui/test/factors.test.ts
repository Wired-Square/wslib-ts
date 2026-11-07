import assert from "node:assert/strict";
import { test } from "node:test";
import type { JSX } from "solid-js";

import { BOUNDARY, admin, chooseFromMenu, click, find, load, mount, settled, textOf, within } from "./mount.ts";
import type { Answer } from "./mount.ts";
import type { Element } from "./universal.ts";

/** Submit the first form under `scope`, as Enter in one of its fields would. */
async function submit(scope: Element) {
  const form = find(scope, (n) => n.tag === "form");
  (form.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
  await settled();
}

/** Type `value` into the input `matches` finds, as the field's own input event carries it. */
async function type(scope: Element, matches: (n: Element) => boolean, value: string) {
  const input = find(scope, (n) => n.tag === "input" && matches(n));
  for (let at: Element | undefined = input; at; at = at.parent) {
    (at.props.onInput as ((e: unknown) => void) | undefined)?.({ target: { value }, currentTarget: at });
  }
  await settled();
}

const byAutocomplete = (value: string) => (n: Element) => n.props.autocomplete === value;

/** `screen` inside a session whose `refresh` is counted. */
async function withRefresh(screen: () => JSX.Element, answer: Answer) {
  const { createComponent } = await load<typeof import("solid-js")>("solid-js");
  const { SessionProvider } = await load<typeof import("../src/shell/session.ts")>("/src/shell/session.ts");
  const refreshed = { count: 0 };
  const mounted = await mount(
    () =>
      createComponent(SessionProvider, {
        value: {
          branding: () => undefined,
          me: () => null,
          local: () => undefined,
          refresh: () => refreshed.count++,
        },
        get children() {
          return screen();
        },
      }),
    answer,
  );
  return { ...mounted, refreshed };
}

const signIn = async () => (await load<typeof import("../src/shell/SignIn.tsx")>("/src/shell/SignIn.tsx")).SignIn;

test("base64url round-trips bytes unpadded, and node has no passkeys to offer", async () => {
  const { base64url, fromBase64url, passkeysUnusable } = await load<typeof import("../src/parts/webauthn.ts")>(
    "/src/parts/webauthn.ts",
  );
  const bytes = new Uint8Array([0, 251, 255, 62, 63, 1]);
  assert.equal(base64url(bytes), "APv_Pj8B");
  assert.deepEqual(new Uint8Array(fromBase64url("APv_Pj8B")), bytes);
  assert.equal(passkeysUnusable(), "this browser does not offer passkeys");
});

test("A passkey ceremony hands the browser buffers and the daemon base64url, and a cancelled one is a sentence", async () => {
  const { answerPasskey, base64url, makePasskey } = await load<typeof import("../src/parts/webauthn.ts")>(
    "/src/parts/webauthn.ts",
  );
  const seen: CredentialCreationOptions[] = [];
  const bytes = (...b: number[]) => new Uint8Array(b).buffer;
  let refuse = false;
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      credentials: {
        create: async (options: CredentialCreationOptions) => {
          seen.push(options);
          return {
            id: "AQI",
            rawId: bytes(1, 2),
            type: "public-key",
            response: { clientDataJSON: bytes(3), attestationObject: bytes(4) },
          };
        },
        get: async () => {
          if (refuse) throw Object.assign(new Error("no"), { name: "NotAllowedError" });
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
    const made = await makePasskey({
      challenge: base64url(new Uint8Array([9, 9])),
      rp: { id: "box.local", name: "Box" },
      user: { id: "dXNlcg", name: "admin", displayName: "admin" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      timeout: 300000,
      excludeCredentials: [{ type: "public-key", id: "AQI" }],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none",
    });
    assert.deepEqual(made, {
      id: "AQI",
      rawId: "AQI",
      type: "public-key",
      response: { clientDataJSON: "Aw", attestationObject: "BA" },
    });
    const publicKey = seen[0]!.publicKey!;
    assert.deepEqual(new Uint8Array(publicKey.challenge as ArrayBuffer), new Uint8Array([9, 9]));
    assert.equal(new TextDecoder().decode(publicKey.user.id as ArrayBuffer), "user");

    const options = { challenge: "CQk", rpId: "box.local", timeout: 120000, allowCredentials: [], userVerification: "required" };
    const answered = await answerPasskey(options);
    assert.deepEqual(answered.response, { clientDataJSON: "Aw", authenticatorData: "BQ", signature: "Bg" });
    refuse = true;
    await assert.rejects(answerPasskey(options), /no passkey was used/);
  } finally {
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }
});

test("A right password with TOTP on goes to the code step, which sends the pending sign-in once with the browser's time", async () => {
  const SignIn = await signIn();
  let codes = 0;
  const { root, asked, refreshed } = await withRefresh(
    () => SignIn({}),
    (path, init) => {
      if (path === "/api/session" && init.method === "POST") {
        return Response.json({ next: "code", pending: "the-pending-one" }, { status: 202 });
      }
      if (path === "/api/session/code") return codes++ === 0 ? Response.json(admin) : undefined;
      return undefined;
    },
  );
  await type(root, byAutocomplete("username"), "admin");
  await type(root, byAutocomplete("current-password"), "correct horse battery");
  await submit(root);
  assert.equal(refreshed.count, 0, "no session yet");
  assert.match(textOf(root), /Code from your authenticator app/);
  assert.doesNotMatch(textOf(root), /the-pending-one/);

  await type(root, byAutocomplete("one-time-code"), " 123456 ");
  const before = Date.now();
  await submit(root);
  await submit(root);
  const sent = asked.filter((a) => a.path === "/api/session/code");
  assert.equal(sent.length, 1, "a spent sign-in is not sent again");
  const body = sent[0]!.body as Record<string, unknown>;
  assert.equal(body.pending, "the-pending-one");
  assert.equal(body.code, "123456");
  assert.ok((body.browser_time as number) >= before);
  assert.equal(refreshed.count, 1);
});

test("A recovery code is sent as one with no time, and a sign-in that waited too long starts again", async () => {
  const SignIn = await signIn();
  const { root, asked } = await withRefresh(
    () => SignIn({}),
    (path, init) =>
      path === "/api/session" && init.method === "POST"
        ? Response.json({ next: "code", pending: "p" }, { status: 202 })
        : path === "/api/session/code"
          ? Response.json({ error: "sign in again" }, { status: 401 })
          : undefined,
  );
  await submit(root);
  await click(root, "Use a recovery code instead");
  assert.match(textOf(root), /Recovery code/);
  await type(root, byAutocomplete("one-time-code"), "ABCD-EFGH-IJKL-MNOP");
  await submit(root);
  assert.deepEqual(asked.find((a) => a.path === "/api/session/code")?.body, {
    pending: "p",
    code: "ABCD-EFGH-IJKL-MNOP",
    recovery: true,
  });
  assert.match(textOf(root), /That sign-in waited too long\. Sign in again\./);
  assert.ok(find(root, (n) => n.tag === "input" && n.props.autocomplete === "current-password"));
});

test("A code refused for the clocks says by how many minutes and which way", async () => {
  const SignIn = await signIn();
  const skewed = (minutes: number): Answer => (path, init) =>
    path === "/api/session" && init.method === "POST"
      ? Response.json({ next: "code", pending: "p" }, { status: 202 })
      : path === "/api/session/code"
        ? Response.json({ error: "this box's clock is off", clock_skew: { minutes } }, { status: 400 })
        : undefined;
  for (const [minutes, said] of [
    [7, /This box's clock is 7 minutes ahead of this device's/],
    [-1, /This box's clock is 1 minute behind this device's/],
    [-2147483648, /This device's clock and this box's are far apart/],
  ] as const) {
    const { root } = await withRefresh(() => SignIn({}), skewed(minutes));
    await submit(root);
    await type(root, byAutocomplete("one-time-code"), "123456");
    await submit(root);
    assert.match(textOf(root), said);
  }
});

test("A required enrolment shows the key, confirms its first code, and shows the recovery codes before signing in", async () => {
  const SignIn = await signIn();
  const { root, asked, refreshed } = await withRefresh(
    () => SignIn({}),
    (path, init) =>
      path === "/api/session" && init.method === "POST"
        ? Response.json({ next: "enrol", pending: "p" }, { status: 202 })
        : path === "/api/session/enrolment"
          ? Response.json({ uri: "otpauth://totp/Box:admin?secret=JBSWY3DPEHPK3PXP", secret: "JBSWY3DPEHPK3PXP" })
          : path === "/api/session/enrolment/confirm"
            ? Response.json({ user: admin, recovery_codes: { codes: ["AAAA-BBBB-CCCC-DDDD"] } })
            : undefined,
  );
  await submit(root);
  assert.deepEqual(asked.find((a) => a.path === "/api/session/enrolment")?.body, { pending: "p" });
  assert.match(textOf(root), /JBSW Y3DP EHPK 3PXP/);
  assert.ok(find(root, (n) => n.tag === "svg" && n.props.role === "img"));
  await type(root, byAutocomplete("one-time-code"), "654321");
  await submit(root);
  const confirmed = asked.find((a) => a.path === "/api/session/enrolment/confirm")?.body as Record<string, unknown>;
  assert.equal(confirmed.pending, "p");
  assert.equal(confirmed.code, "654321");
  assert.match(textOf(root), /AAAA-BBBB-CCCC-DDDD/);
  assert.doesNotMatch(textOf(root), /JBSW/, "the key is not kept on screen");
  assert.equal(refreshed.count, 0, "the codes are read first");
  await click(root, "I have kept them");
  assert.equal(refreshed.count, 1);
});

test("With TOTP on, the proof offered is a code or a recovery code, never the password, and a code carries the time", async () => {
  const { createFactorProof } = await load<typeof import("../src/parts/FactorProof.tsx")>("/src/parts/FactorProof.tsx");
  const { createRoot } = await load<typeof import("solid-js")>("solid-js");
  for (const [on, ways] of [
    [true, ["code", "recovery"]],
    [false, ["password"]],
  ] as const) {
    await createRoot(async (dispose) => {
      const proof = createFactorProof(() => on);
      assert.deepEqual(proof.ways(), ways);
      proof.setTyped(" 123456 ");
      const taken = await proof.take();
      if (on) {
        assert.equal(taken.code, "123456");
        assert.equal(typeof taken.browser_time, "number");
        proof.setWay("recovery");
        assert.equal(proof.ready(), false, "a new way starts empty");
      } else {
        assert.deepEqual(taken, { password: " 123456 " });
      }
      dispose();
    });
  }
});

test("Turning TOTP on proves the password, shows the key, and shows the codes its first code returns", async () => {
  const { TotpSettings } = await load<typeof import("../src/screens/SecondFactors.tsx")>(
    "/src/screens/SecondFactors.tsx",
  );
  let on = false;
  const { root, asked } = await mount(
    () => TotpSettings(),
    (path, init) => {
      if (path === "/api/session/totp" && init.method !== "POST") return Response.json({ on, recovery_codes_left: on ? 10 : 0 });
      if (path === "/api/session/totp") return Response.json({ uri: "otpauth://totp/x", secret: "JBSWY3DPEHPK3PXP" });
      if (path === "/api/session/totp/confirm") {
        on = true;
        return Response.json({ codes: ["AAAA-BBBB-CCCC-DDDD"] });
      }
      return undefined;
    },
  );
  assert.match(textOf(root), /Off/);
  await type(root, byAutocomplete("current-password"), "correct horse battery");
  await submit(root);
  assert.deepEqual(asked.find((a) => a.path === "/api/session/totp" && a.method === "POST")?.body, {
    password: "correct horse battery",
  });
  await type(root, byAutocomplete("one-time-code"), "123456");
  await submit(root);
  assert.match(textOf(root), /AAAA-BBBB-CCCC-DDDD/);
  await click(root, "I have kept them");
  assert.match(textOf(root), /On, with 10 recovery codes left/);
  assert.doesNotMatch(textOf(root), /Your password/, "with TOTP on the password is not offered");
});

test("An administrator requires another account to enrol with their own proof, told the password stays", async () => {
  const { AccountSettings } = await load<typeof import("../src/screens/AccountSettings.tsx")>(
    "/src/screens/AccountSettings.tsx",
  );
  const member = { ...admin, id: "2", username: "member" };
  const { root, asked } = await mount(
    () => AccountSettings({ me: admin }),
    (path, init) =>
      path === "/api/users"
        ? Response.json([admin, member])
        : init.method === "POST"
          ? new Response(null, { status: 204 })
          : undefined,
  );
  await chooseFromMenu(root, "Actions for member", "Require TOTP enrolment…");
  const dialog = find(root, (n) => n.tag === "dialog");
  assert.match(textOf(dialog), /Their password and passkeys stay.*reset its password instead/);
  await type(dialog, byAutocomplete("current-password"), "the administrator's own");
  await click(dialog, "Require enrolment");
  assert.deepEqual(
    asked.filter((a) => a.method === "POST").map((a) => [a.path, a.body]),
    [["/api/users/2/require-totp", { password: "the administrator's own" }]],
  );
});

test("The rename warning names the hosts passkeys stop working on, and nothing when the name stays", async () => {
  const { PasskeyRenameWarning } = await load<typeof import("../src/parts/factorNotes.tsx")>("/src/parts/factorNotes.tsx");
  const hosts: Answer = (path) =>
    path === "/api/session/passkey/hosts" ? Response.json(["box.local", "old.local"]) : undefined;
  const renamed = await mount(() => PasskeyRenameWarning({ to: "box.local" }), hosts);
  assert.match(textOf(renamed.root), /Passkeys made on old\.local sign in only at that name/);
  const kept = await mount(
    () => PasskeyRenameWarning({ to: "box.local" }),
    (path) => (path === "/api/session/passkey/hosts" ? Response.json(["box.local"]) : undefined),
  );
  assert.equal(textOf(kept.root), "");
});

test("Given the one name that goes, the rename warning names it alone with the caller's passkeys on it", async () => {
  const { PasskeyRenameWarning } = await load<typeof import("../src/parts/factorNotes.tsx")>("/src/parts/factorNotes.tsx");
  const answer =
    (box: string[]): Answer =>
    (path) => {
      if (path === "/api/session/passkey/hosts") return Response.json(box);
      if (path === "/api/session/passkeys/hosts") return Response.json([{ host: "box.tail.ts.net", passkeys: 2 }]);
      return undefined;
    };
  const lost = await mount(() => PasskeyRenameWarning({ lost: "box.tail.ts.net" }), answer(["box.local", "box.tail.ts.net"]));
  assert.equal(
    textOf(lost.root),
    "Passkeys made on box.tail.ts.net, 2 of them yours, sign in only at that name. Once the box is no longer reached by it, each person signs in with their password and adds a passkey again.",
  );
  const none = await mount(() => PasskeyRenameWarning({ lost: "box.tail.ts.net" }), answer(["box.local"]));
  assert.equal(textOf(none.root), "", "nobody made one there");
  const unread = await mount(
    () => PasskeyRenameWarning({ lost: "box.tail.ts.net" }),
    (path) => (path === "/api/session/passkey/hosts" ? Response.json(["box.tail.ts.net"]) : new Response(null, { status: 500 })),
  );
  assert.match(textOf(unread.root), /^Passkeys made on box\.tail\.ts\.net sign in only/, "no count it could not read");
});

test("PasswordAgain offers a passkey only where one can run, and its body is the password when none is chosen", async () => {
  const { PasswordAgain, reauthentication } = await load<typeof import("../src/parts/PasswordAgain.tsx")>(
    "/src/parts/PasswordAgain.tsx",
  );
  const { root } = await mount(() => PasswordAgain({ value: "", onValue: () => {}, onPasskey: () => {} }), () => undefined);
  assert.match(textOf(root), /Your password/);
  assert.doesNotMatch(textOf(root), /Use a passkey instead/, "node offers no passkeys");
  assert.deepEqual(await reauthentication("correct horse battery", false), { password: "correct horse battery" });
});

test("PasswordAgain offers a passkey only where the caller has one made on the page's name", async () => {
  const { PasswordAgain } = await load<typeof import("../src/parts/PasswordAgain.tsx")>("/src/parts/PasswordAgain.tsx");
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { credentials: {} } });
  try {
    for (const [mine, offered] of [
      [[{ host: "old.local", passkeys: 1 }], false],
      [[{ host: "box.local", passkeys: 1 }], true],
    ] as const) {
      const { root, asked } = await mount(
        () => PasswordAgain({ value: "", onValue: () => {}, onPasskey: () => {} }),
        (path) =>
          path === "/api/session/passkey/availability"
            ? Response.json({ state: "ready", via: "box.local" })
            : path === "/api/session/passkeys/hosts"
              ? Response.json(mine)
              : undefined,
      );
      assert.ok(asked.some((a) => a.path === "/api/session/passkeys/hosts"));
      assert.equal(/Use a passkey instead/.test(textOf(root)), offered, mine[0].host);
    }
    const { asked } = await mount(() => PasswordAgain({ value: "", onValue: () => {} }), () => undefined);
    assert.deepEqual(asked, [], "without onPasskey nothing is asked");
    const chosen = await mount(
      () => PasswordAgain({ value: "", onValue: () => {}, passkey: true, onPasskey: () => {} }),
      () => undefined,
    );
    assert.match(textOf(chosen.root), /Use your password instead/, "a passkey chosen can always be unchosen");
  } finally {
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("A proof's code field takes six digits, and a recovery code is not held to them", async () => {
  const { FactorProofField, createFactorProof } = await load<typeof import("../src/parts/FactorProof.tsx")>(
    "/src/parts/FactorProof.tsx",
  );
  const proof = createFactorProof(() => true);
  const { root } = await mount(() => FactorProofField({ of: proof }), () => undefined);
  const field = () => find(root, byAutocomplete("one-time-code"));
  assert.equal(field().props.maxLength, 6);
  assert.equal(field().props.pattern, "[0-9]*");
  proof.setWay("recovery");
  await settled();
  assert.equal(field().props.maxLength, undefined);
  assert.equal(field().props.pattern, undefined);
});

test("A proof offers no way until the TOTP state is known, and what was typed for one way never carries to another", async () => {
  const { createFactorProof } = await load<typeof import("../src/parts/FactorProof.tsx")>("/src/parts/FactorProof.tsx");
  const { createRoot, createSignal } = await load<typeof import("solid-js")>("solid-js");
  createRoot((dispose) => {
    const [on, setOn] = createSignal<boolean | undefined>(undefined);
    const proof = createFactorProof(on);
    assert.deepEqual(proof.ways(), []);
    assert.equal(proof.ready(), false);
    setOn(false);
    proof.setTyped("correct horse battery");
    assert.equal(proof.ready(), true);
    setOn(true);
    assert.equal(proof.way(), "code");
    assert.equal(proof.typed(), "", "the password is not shown or sent as a code");
    dispose();
  });
});

test("A proof offers a passkey only where the caller has one made on the page's name, and asks again when one is added", async () => {
  const { FactorProofField, createFactorProof, passkeysChanged } = await load<typeof import("../src/parts/FactorProof.tsx")>(
    "/src/parts/FactorProof.tsx",
  );
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { credentials: {} } });
  try {
    let mine = [{ host: "old.local", passkeys: 1 }];
    const { root, asked } = await mount(
      () => FactorProofField({ of: createFactorProof(() => false) }),
      (path) =>
        path === "/api/session/passkey/availability"
          ? Response.json({ state: "ready", via: "box.local" })
          : path === "/api/session/passkeys/hosts"
            ? Response.json(mine)
            : undefined,
    );
    const offered = () => [...within(root)].filter((n) => n.tag === "option").map(textOf);
    const hostsAsked = () => asked.filter((a) => a.path === "/api/session/passkeys/hosts").length;
    assert.equal(hostsAsked(), 1);
    assert.deepEqual(offered(), [], "the password alone, with no passkey made here");
    assert.match(textOf(root), /Your password/);

    mine = [...mine, { host: "box.local", passkeys: 1 }];
    passkeysChanged();
    await settled();
    assert.deepEqual(offered(), ["Your password", "A passkey"]);
    assert.equal(hostsAsked(), 2);

    for (const [availability, hosts] of [
      [{ state: "unsupported", because: "an IP address" }, [{ host: "box.local", passkeys: 1 }]],
      [{ state: "ready", via: "box.local" }, undefined],
    ] as const) {
      const elsewhere = await mount(
        () => FactorProofField({ of: createFactorProof(() => false) }),
        (path) =>
          path === "/api/session/passkey/availability"
            ? Response.json(availability)
            : path === "/api/session/passkeys/hosts" && hosts
              ? Response.json(hosts)
              : undefined,
      );
      const options = [...within(elsewhere.root)].filter((n) => n.tag === "option");
      assert.deepEqual(options, [], availability.state);
      assert.match(textOf(elsewhere.root), /Your password/);
      assert.doesNotMatch(textOf(elsewhere.root), new RegExp(BOUNDARY));
      const paths = elsewhere.asked.map((a) => a.path);
      assert.ok(paths.includes("/api/session/passkey/availability") && paths.includes("/api/session/passkeys/hosts"));
    }
  } finally {
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }
});

test("Turning TOTP on makes the password change ask for a code as well", async () => {
  const { PasswordSettings } = await load<typeof import("../src/screens/PasswordSettings.tsx")>(
    "/src/screens/PasswordSettings.tsx",
  );
  const { totpChanged } = await load<typeof import("../src/parts/FactorProof.tsx")>("/src/parts/FactorProof.tsx");
  let on = false;
  const { root, asked } = await mount(
    () => PasswordSettings({}),
    (path, init) =>
      path === "/api/session/totp"
        ? Response.json({ on, recovery_codes_left: 10 })
        : path === "/api/session/password" && init.method === "PUT"
          ? new Response(null, { status: 204 })
          : undefined,
  );
  assert.doesNotMatch(textOf(root), /authenticator app/);
  on = true;
  totpChanged();
  await settled();
  await type(root, byAutocomplete("current-password"), "correct horse battery");
  for (const input of [...within(root)].filter((n) => n.tag === "input" && n.props.autocomplete === "new-password")) {
    await type(input.parent!, (n) => n === input, "a much longer passphrase");
  }
  await type(root, byAutocomplete("one-time-code"), "123456");
  await submit(root);
  const body = asked.find((a) => a.method === "PUT")?.body as Record<string, unknown>;
  assert.equal(body.current_password, "correct horse battery");
  assert.equal(body.new_password, "a much longer passphrase");
  assert.equal(body.code, "123456");
  assert.equal(typeof body.browser_time, "number");
});

test("Adding a passkey proves the account, makes it for the host the page is on, and lists it", async () => {
  const { PasskeySettings } = await load<typeof import("../src/screens/SecondFactors.tsx")>(
    "/src/screens/SecondFactors.tsx",
  );
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const bytes = (...b: number[]) => new Uint8Array(b).buffer;
  Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      credentials: {
        create: async () => ({
          id: "AQI",
          rawId: bytes(1, 2),
          type: "public-key",
          response: { clientDataJSON: bytes(3), attestationObject: bytes(4) },
        }),
      },
    },
  });
  const made = { id: "k1", name: "Laptop", host: "box.local", created_at: "2026-10-16T00:00:00Z", last_used_at: null };
  try {
    const { root, asked } = await mount(
      () => PasskeySettings(),
      (path, init) =>
        path === "/api/session/passkeys" && init.method === "POST"
          ? Response.json(made, { status: 201 })
          : path === "/api/session/passkeys"
            ? Response.json([])
            : path === "/api/session/passkey/availability"
              ? Response.json({ state: "ready", via: "box.local" })
              : path === "/api/session/totp"
                ? Response.json({ on: false, recovery_codes_left: 0 })
                : path === "/api/session/passkeys/options"
                  ? Response.json({
                      challenge: "CQk",
                      rp: { id: "box.local", name: "Box" },
                      user: { id: "dXNlcg", name: "admin", displayName: "admin" },
                      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                      timeout: 300000,
                      excludeCredentials: [],
                      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
                      attestation: "none",
                    })
                  : undefined,
    );
    assert.doesNotMatch(textOf(root), /It is made for/, "the form waits behind its button");
    await click(root, "Add a passkey…");
    const dialog = find(root, (n) => n.tag === "dialog");
    assert.match(textOf(dialog), /It is made for box\.local/);
    await type(dialog, (n) => n.props.maxLength === 64, " Laptop ");
    await type(dialog, byAutocomplete("current-password"), "correct horse battery");
    await submit(dialog);
    assert.ok(![...within(root)].some((n) => n.tag === "dialog"), "the dialog closed");
    const posts = asked.filter((a) => a.method === "POST").map((a) => [a.path, a.body]);
    assert.deepEqual(posts, [
      ["/api/session/passkeys/options", { password: "correct horse battery" }],
      [
        "/api/session/passkeys",
        {
          name: "Laptop",
          credential: { id: "AQI", rawId: "AQI", type: "public-key", response: { clientDataJSON: "Aw", attestationObject: "BA" } },
        },
      ],
    ]);
    assert.match(textOf(root), /Laptop.*box\.local/);
  } finally {
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }
});

/**
 * `PasskeySettings` over a browser whose ceremonies fail while `browser.fail`,
 * a clock moved by `browser.wait`, and `register` answered by `registered`.
 * Each ceremony's challenge bytes and timeout are kept in `ceremonies`.
 */
async function addingPasskeys(registered: () => Response, run: (on: Awaited<ReturnType<typeof begin>>) => Promise<void>) {
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const realNow = Date.now;
  try {
    await run(await begin());
  } finally {
    Date.now = realNow;
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }

  async function begin() {
    const { PasskeySettings } = await load<typeof import("../src/screens/SecondFactors.tsx")>(
      "/src/screens/SecondFactors.tsx",
    );
    let clock = realNow();
    const bytes = (...b: number[]) => new Uint8Array(b).buffer;
    const ceremonies: { challenge: number[]; timeout: number | undefined }[] = [];
    const browser = { fail: true, wait: (ms: number) => (clock += ms) };
    Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        credentials: {
          create: async ({ publicKey }: CredentialCreationOptions) => {
            ceremonies.push({
              challenge: [...new Uint8Array(publicKey!.challenge as ArrayBuffer)],
              timeout: publicKey!.timeout,
            });
            if (browser.fail) throw Object.assign(new Error("no"), { name: "NotAllowedError" });
            return {
              id: "AQI",
              rawId: bytes(1, 2),
              type: "public-key",
              response: { clientDataJSON: bytes(3), attestationObject: bytes(4) },
            };
          },
        },
      },
    });
    Date.now = () => clock;
    let issued = 0;
    const { root, asked } = await mount(
      () => PasskeySettings(),
      (path, init) =>
        path === "/api/session/passkeys" && init.method === "POST"
          ? registered()
          : path === "/api/session/passkeys"
            ? Response.json([])
            : path === "/api/session/passkey/availability"
              ? Response.json({ state: "ready", via: "box.local" })
              : path === "/api/session/totp"
                ? Response.json({ on: true, recovery_codes_left: 10 })
                : path === "/api/session/passkeys/options"
                  ? Response.json({
                      challenge: issued++ === 0 ? "AQ" : "Ag",
                      rp: { id: "box.local", name: "Box" },
                      user: { id: "dXNlcg", name: "admin", displayName: "admin" },
                      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                      timeout: 290000,
                      excludeCredentials: [],
                      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
                      attestation: "none",
                    })
                  : undefined,
    );
    const proofs = () =>
      asked.filter((a) => a.path === "/api/session/passkeys/options").map((a) => (a.body as { code: string }).code);
    const registrations = () => asked.filter((a) => a.path === "/api/session/passkeys" && a.method === "POST").length;
    const dialog = () => find(root, (n) => n.tag === "dialog");
    await click(root, "Add a passkey…");
    await type(dialog(), (n) => n.props.maxLength === 64, "Laptop");
    return { root, dialog, browser, ceremonies, proofs, registrations };
  }
}

test("A passkey ceremony that fails retries with the options it holds until they time out, then asks for proof again", async () => {
  const made = { id: "k1", name: "Laptop", host: "box.local", created_at: "2026-10-16T00:00:00Z", last_used_at: null };
  await addingPasskeys(
    () => Response.json(made, { status: 201 }),
    async ({ root, dialog, browser, ceremonies, proofs, registrations }) => {
      await type(dialog(), byAutocomplete("one-time-code"), "123456");
      await submit(dialog());
      assert.match(textOf(dialog()), /no passkey was used/);
      assert.match(textOf(dialog()), /Your proof still stands/);

      browser.wait(289_000);
      await submit(dialog());
      assert.deepEqual(proofs(), ["123456"], "the retry asked for no proof");
      assert.deepEqual(
        ceremonies,
        [
          { challenge: [1], timeout: 290_000 },
          { challenge: [1], timeout: 1_000 },
        ],
        "and ran with the options it held, for what is left of their timeout",
      );

      browser.wait(1_000);
      await submit(dialog());
      assert.match(textOf(dialog()), /the earlier attempt expired; prove it is you again/);
      assert.equal(ceremonies.length, 2, "no ceremony on expired options");
      const field = find(dialog(), (n) => n.tag === "input" && n.props.autocomplete === "one-time-code");
      assert.equal(field.props.value, "", "the spent code is not offered again");

      browser.fail = false;
      await type(dialog(), byAutocomplete("one-time-code"), "654321");
      await submit(dialog());
      assert.ok(![...within(root)].some((n) => n.tag === "dialog"), "the dialog closed");
      assert.deepEqual(proofs(), ["123456", "654321"]);
      assert.deepEqual(ceremonies.at(-1)?.challenge, [2]);
      assert.equal(registrations(), 1);
    },
  );
});

test("A passkey the box refuses drops the options it was made with, so the next attempt asks for proof", async () => {
  await addingPasskeys(
    () => Response.json({ error: "the passkey was refused" }, { status: 403 }),
    async ({ dialog, browser, ceremonies, proofs, registrations }) => {
      browser.fail = false;
      await type(dialog(), byAutocomplete("one-time-code"), "123456");
      await submit(dialog());
      assert.match(textOf(dialog()), /the passkey was refused/);
      assert.equal(registrations(), 1);
      assert.doesNotMatch(textOf(dialog()), /Your proof still stands/);

      await submit(dialog());
      assert.deepEqual(proofs(), ["123456"], "no options asked for without proof");
      assert.equal(ceremonies.length, 1, "and no ceremony run");

      await type(dialog(), byAutocomplete("one-time-code"), "654321");
      await submit(dialog());
      assert.deepEqual(proofs(), ["123456", "654321"]);
      assert.deepEqual(
        ceremonies.map((c) => c.challenge),
        [[1], [2]],
      );
    },
  );
});

test("Adding or removing a passkey has every proof on the page ask again whether one can prove it here", async () => {
  const { PasskeySettings } = await load<typeof import("../src/screens/SecondFactors.tsx")>(
    "/src/screens/SecondFactors.tsx",
  );
  const { FactorProofField, createFactorProof } = await load<typeof import("../src/parts/FactorProof.tsx")>(
    "/src/parts/FactorProof.tsx",
  );
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const bytes = (...b: number[]) => new Uint8Array(b).buffer;
  Object.assign(globalThis, { PublicKeyCredential: function PublicKeyCredential() {} });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      credentials: {
        create: async () => ({
          id: "AQI",
          rawId: bytes(1, 2),
          type: "public-key",
          response: { clientDataJSON: bytes(3), attestationObject: bytes(4) },
        }),
      },
    },
  });
  const made = { id: "k1", name: "Laptop", host: "box.local", created_at: "2026-10-16T00:00:00Z", last_used_at: null };
  let mine: { host: string; passkeys: number }[] = [];
  try {
    const { root } = await mount(
      () => [PasskeySettings(), FactorProofField({ of: createFactorProof(() => false) })],
      (path, init) =>
        init.method === "DELETE"
          ? new Response(null, { status: 204 })
          : path === "/api/session/passkeys" && init.method === "POST"
            ? Response.json(made, { status: 201 })
            : path === "/api/session/passkeys"
              ? Response.json([])
              : path === "/api/session/passkeys/hosts"
                ? Response.json(mine)
                : path === "/api/session/passkey/availability"
                  ? Response.json({ state: "ready", via: "box.local" })
                  : path === "/api/session/passkeys/options"
                    ? Response.json({
                        challenge: "CQk",
                        rp: { id: "box.local", name: "Box" },
                        user: { id: "dXNlcg", name: "admin", displayName: "admin" },
                        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                        timeout: 300000,
                        excludeCredentials: [],
                        authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
                        attestation: "none",
                      })
                    : undefined,
    );
    const offered = () => [...within(root)].filter((n) => n.tag === "option").map(textOf);
    assert.deepEqual(offered(), []);
    await click(root, "Add a passkey…");
    const dialog = find(root, (n) => n.tag === "dialog");
    await type(dialog, (n) => n.props.maxLength === 64, "Laptop");
    await type(dialog, byAutocomplete("current-password"), "correct horse battery");
    mine = [{ host: "box.local", passkeys: 1 }];
    await submit(dialog);
    assert.ok(![...within(root)].some((n) => n.tag === "dialog"));
    assert.deepEqual(offered(), ["Your password", "A passkey"], "offered once added");

    mine = [];
    await chooseFromMenu(root, "Actions for Laptop", "Remove…");
    await click(find(root, (n) => n.tag === "dialog"), "Remove");
    assert.deepEqual(offered(), [], "and withdrawn once removed");
  } finally {
    Reflect.deleteProperty(globalThis, "PublicKeyCredential");
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }
});

test("An administrator removes another account's passkey by its id, with their own proof", async () => {
  const { AccountSettings } = await load<typeof import("../src/screens/AccountSettings.tsx")>(
    "/src/screens/AccountSettings.tsx",
  );
  const member = { ...admin, id: "2", username: "member" };
  const { root, asked } = await mount(
    () => AccountSettings({ me: admin }),
    (path, init) =>
      path === "/api/users"
        ? Response.json([admin, member])
        : path === "/api/users/2/passkeys"
          ? Response.json([
              { id: "k/1", name: "Phone", host: "box.local", created_at: "2026-10-16T00:00:00Z", last_used_at: null },
            ])
          : init.method === "POST"
            ? new Response(null, { status: 204 })
            : undefined,
  );
  await chooseFromMenu(root, "Actions for member", "Passkeys…");
  const dialog = find(root, (n) => n.tag === "dialog");
  assert.match(textOf(dialog), /Phone — made on box\.local, last used never/);
  await type(dialog, byAutocomplete("current-password"), "the administrator's own");
  await click(dialog, "Remove passkey");
  assert.deepEqual(
    asked.filter((a) => a.method === "POST").map((a) => [a.path, a.body]),
    [["/api/users/2/passkeys/k%2F1/remove", { password: "the administrator's own" }]],
  );
});
