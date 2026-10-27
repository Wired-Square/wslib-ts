/**
 * The signed-in account's own proof, asked again before a change that outlives
 * the session: while its TOTP is on, a code from the authenticator app, a
 * recovery code or a passkey, never the password alone; otherwise the password
 * or a passkey. The daemon holds the same rule; this offers only what it takes.
 *
 * A passkey is asked for when the form is sent, so its challenge is fresh.
 */
import type { Availability, FactorProof, PasskeyHost, TotpView } from "@wired-square/appliance-types";
import { Field, Refusal, Select } from "@wired-square/kit";
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";

import { api } from "../api";
import { passkeysUnusable, reauthenticationPasskey } from "./webauthn";

export type ProofWay = "code" | "recovery" | "password" | "passkey";

const WAYS: Record<ProofWay, string> = {
  code: "A code from your authenticator app",
  recovery: "A recovery code",
  password: "Your password",
  passkey: "A passkey",
};

const [totpTurned, setTotpTurned] = createSignal(0);
const [passkeysTurned, setPasskeysTurned] = createSignal(0);

/** The signed-in account's TOTP went on or off: every proof asks again what it takes. */
export const totpChanged = () => setTotpTurned((n) => n + 1);

/** The signed-in account added or removed a passkey: every proof asks again whether one can prove it here. */
export const passkeysChanged = () => setPasskeysTurned((n) => n + 1);

/**
 * Whether the caller has a passkey made on the name this page reached the box
 * by, asked while `wanted` says so and again after `passkeysChanged`; false
 * until known, and never suspends.
 */
export function createPasskeyHere(wanted: () => boolean = () => true) {
  const [here] = createResource(
    () => wanted() && !passkeysUnusable() && passkeysTurned() + 1,
    () =>
      Promise.all([
        api<Availability>("/api/session/passkey/availability"),
        api<PasskeyHost[]>("/api/session/passkeys/hosts"),
      ]).then(
        ([at, mine]) => at.state === "ready" && mine.some((host) => host.host === at.via),
        () => false,
      ),
  );
  return () => (here.state === "ready" || here.state === "refreshing") && here.latest === true;
}

/**
 * `totpOn` is the caller's own TOTP state where the screen already holds it;
 * without it the state is asked for, while `wanted` says a proof is. Until it
 * is known no way is offered; one that cannot be read offers the password. A
 * passkey is offered only where the caller has one made on this page's name.
 */
export function createFactorProof(totpOn?: () => boolean | undefined, wanted: () => boolean = () => true) {
  const [asked] = createResource(
    () => totpOn === undefined && wanted() && totpTurned() + 1,
    () => api<TotpView>("/api/session/totp").then((view) => view.on, () => false),
  );
  const passkeyHere = createPasskeyHere(wanted);
  const on = () => (totpOn ? totpOn() : asked.state === "ready" ? asked() : undefined);
  const [picked, setPicked] = createSignal<ProofWay>();
  const [entry, setEntry] = createSignal<{ way: ProofWay; value: string }>();

  const ways = (): ProofWay[] => {
    const totp = on();
    if (totp === undefined) return [];
    return [
      ...(totp ? (["code", "recovery"] as const) : (["password"] as const)),
      ...(passkeyHere() ? ["passkey" as const] : []),
    ];
  };
  const way = (): ProofWay | undefined => {
    const chosen = picked();
    return chosen && ways().includes(chosen) ? chosen : ways()[0];
  };
  /** What was typed for the way now offered; another way's never carries over. */
  const typed = () => {
    const kept = entry();
    return kept && kept.way === way() ? kept.value : "";
  };

  const take = async (): Promise<FactorProof> => {
    switch (way()) {
      case "code":
        return { code: typed().trim(), browser_time: Date.now() };
      case "recovery":
        return { code: typed().trim(), recovery: true };
      case "password":
        return { password: typed() };
      case "passkey":
        return { passkey: await reauthenticationPasskey() };
      case undefined:
        throw new Refusal("this page has not yet learnt which proof it needs; try again in a moment");
    }
  };

  return {
    totpOn: on,
    ways,
    way,
    setWay: setPicked,
    typed,
    setTyped: (value: string) => {
      const now = way();
      if (now) setEntry({ way: now, value });
    },
    ready: () => way() === "passkey" || typed().trim() !== "",
    /** The proof to send, running the passkey ceremony if that was chosen. */
    take,
    clear: () => setEntry(undefined),
  };
}

export type FactorProofState = ReturnType<typeof createFactorProof>;

export function FactorProofField(props: { of: FactorProofState }) {
  const hint = () =>
    props.of.totpOn()
      ? "Asked again because what this does outlives the session; with TOTP on, your password alone is not enough."
      : "Asked again because what this does outlives the session asking for it.";
  return (
    <>
      <Show when={props.of.ways().length > 1}>
        <Select label="Prove it is you with" value={props.of.way()} onValue={(to) => props.of.setWay(to as ProofWay)}>
          <For each={props.of.ways()}>{(way) => <option value={way}>{WAYS[way]}</option>}</For>
        </Select>
      </Show>
      <Switch>
        <Match when={props.of.ways().length === 0}>
          <p class="app-muted">Finding out which proof this needs…</p>
        </Match>
        <Match when={props.of.way() === "passkey"}>
          <p class="app-muted">Your passkey is asked for when you go ahead. {hint()}</p>
        </Match>
        <Match when={props.of.way()}>
          {(way) => (
            <Field
              label={WAYS[way()]}
              type={way() === "password" ? "password" : "text"}
              autocomplete={way() === "password" ? "current-password" : "one-time-code"}
              inputmode={way() === "code" ? "numeric" : "text"}
              spellcheck={false}
              required
              hint={hint()}
              value={props.of.typed()}
              onValue={props.of.setTyped}
            />
          )}
        </Match>
      </Switch>
    </>
  );
}
