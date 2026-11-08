/**
 * The signed-in account's proof, asked in a dialog of its own once the change
 * it confirms is sent, so a password manager meets one field. `ProofHost`
 * renders the dialog, and `Shell` mounts one.
 */
import { STALE_PROOF } from "@wired-square/appliance-types";
import type { FactorProof, Reauthentication } from "@wired-square/appliance-types";
import { Button, Dialog, DialogActions, Refusal, refusalMessage } from "@wired-square/kit";
import { Show, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";

import { ApiError } from "../api";
import { FactorProofField, createFactorProof } from "./FactorProof";
import { PasswordAgain, reauthentication } from "./PasswordAgain";
import { ClockSkewNotice, clockSkewOf } from "./factorNotes";

export interface ProofAsk {
  /** The dialog's title, naming the change: "Delete alice?", "Take a backup". */
  for: string;
  /** What going ahead does, above the proof. */
  about?: string;
  /** Default "Continue". */
  verb?: string;
  /** Default `primary`. */
  tone?: "danger" | "primary";
}

// Interim, until the daemon marks every refused proof: its reauth refusals in core 0.1.4 and auth 0.1.3.
const REFUSED_PROOF = new Set([
  "the code is incorrect",
  "that code has just been used; wait for the next one",
  "the password is incorrect",
  "the passkey was not accepted",
  "while TOTP is on, this needs a code from the authenticator app, a recovery code or a passkey",
]);

/** Whether `error` refused the proof, which is asked again, rather than the change it came with. */
export function refusedProof(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  if (error.body?.proof === "refused" || error.clockSkew) return true;
  if (error.status === 429) return error.body?.retry_after !== undefined;
  return error.status === 403 && (REFUSED_PROOF.has(error.message) || error.message.startsWith(STALE_PROOF));
}

interface Proving<P> {
  field: (refused: () => string | undefined) => JSX.Element;
  ready: () => boolean;
  /** Runs a passkey's ceremony, if one was chosen. */
  take: () => Promise<P>;
  clear: () => void;
}

interface Asking {
  ask: ProofAsk;
  proving: () => Proving<unknown>;
  send: (proof: unknown) => Promise<unknown>;
  settle: (outcome: { value: unknown } | { error: unknown }) => void;
}

const [asking, setAsking] = createSignal<Asking>();
export { asking };
const [hosts, setHosts] = createSignal<symbol[]>([]);

type Sent = NonNullable<unknown> | null;

/**
 * Asks while no other proof is: the dialog is modal, so a second ask comes
 * from code rather than the operator, and queued it would open after the
 * first out of the context that asked.
 */
function request<P, T extends Sent>(
  ask: ProofAsk,
  proving: () => Proving<P>,
  send: (proof: P) => Promise<T>,
): Promise<T | undefined> {
  if (hosts().length === 0) {
    throw new Error("a proof was asked for with no ProofHost mounted: mount Shell, or ProofHost inside a SessionProvider");
  }
  if (asking()) return Promise.reject(new Refusal("another proof is being asked for; finish that one first"));
  return new Promise((resolve, reject) =>
    setAsking({
      ask,
      proving,
      send: send as (proof: unknown) => Promise<unknown>,
      settle: (outcome) => {
        setAsking(undefined);
        if ("error" in outcome) reject(outcome.error);
        else resolve(outcome.value as T | undefined);
      },
    }),
  );
}

/**
 * The signed-in account's `FactorProof`, by the daemon's rule, handed to
 * `send`; resolves to what `send` does, or `undefined` if cancelled. A refused
 * proof keeps the dialog open to try again; any other refusal closes it and
 * rejects.
 */
export function withProof<T extends Sent>(ask: ProofAsk, send: (proof: FactorProof) => Promise<T>) {
  return request(ask, factorProving, send);
}

/** As `withProof`, for a route that proves the caller through `reauthenticate`: the password, or a passkey. */
export function withPassword<T extends Sent>(ask: ProofAsk, send: (proof: Reauthentication) => Promise<T>) {
  return request(ask, passwordProving, send);
}

function factorProving(): Proving<FactorProof> {
  const proof = createFactorProof();
  return {
    field: (refused) => <FactorProofField of={proof} refused={refused()} />,
    ready: proof.ready,
    take: proof.take,
    clear: proof.clear,
  };
}

function passwordProving(): Proving<Reauthentication> {
  const [password, setPassword] = createSignal("");
  const [passkey, setPasskey] = createSignal(false);
  return {
    field: (refused) => (
      <PasswordAgain
        value={password()}
        onValue={setPassword}
        passkey={passkey()}
        onPasskey={setPasskey}
        refused={refused()}
      />
    ),
    ready: () => passkey() || password() !== "",
    take: () => reauthentication(password(), passkey()),
    clear: () => setPassword(""),
  };
}

/**
 * Where a proof's dialog renders; the latest mounted renders it, so a second is
 * harmless. The last one unmounted cancels a proof still open.
 */
export function ProofHost() {
  const me = Symbol();
  setHosts((have) => [...have, me]);
  onCleanup(() => {
    setHosts((have) => have.filter((host) => host !== me));
    if (hosts().length === 0) asking()?.settle({ value: undefined });
  });
  return (
    <Show when={hosts().at(-1) === me && asking()} keyed>
      {(open) => <ProofDialog asking={open} />}
    </Show>
  );
}

/** Sends `proof`, settling the ask with what came of it, unless the proof was refused, which throws. */
export async function answer(open: Asking, proof: unknown) {
  let value: unknown;
  try {
    value = await open.send(proof);
  } catch (error) {
    if (refusedProof(error)) throw error;
    return open.settle({ error });
  }
  open.settle({ value });
}

function ProofDialog(props: { asking: Asking }) {
  const { ask, settle } = props.asking;
  const proving = props.asking.proving();
  const [pending, setPending] = createSignal(false);
  const [refused, setRefused] = createSignal<unknown>();

  const field = proving.field(() => (refused() === undefined ? undefined : refusalMessage(refused())));

  const confirm = async (event: SubmitEvent) => {
    event.preventDefault();
    if (pending() || !proving.ready()) return;
    setPending(true);
    try {
      await answer(props.asking, await proving.take());
    } catch (error) {
      setRefused(error);
      proving.clear();
      setPending(false);
    }
  };

  return (
    <Dialog title={ask.for} pending={pending()} onClose={() => settle({ value: undefined })}>
      <form class="app-form" novalidate onSubmit={(event) => void confirm(event)}>
        <Show when={ask.about}>{(said) => <p class="app-dialog__body">{said()}</p>}</Show>
        {field}
        <ClockSkewNotice skew={clockSkewOf(refused())} />
        <DialogActions
          onCancel={() => settle({ value: undefined })}
          pending={pending()}
          confirm={
            <Button type="submit" tone={ask.tone ?? "primary"} pending={pending()} disabled={!proving.ready()}>
              {ask.verb ?? "Continue"}
            </Button>
          }
        />
      </form>
    </Dialog>
  );
}
