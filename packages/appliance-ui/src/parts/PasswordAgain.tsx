/**
 * The caller's own password, asked for again, for a route whose result
 * outlives the session that asked and that proves it through `reauthenticate`;
 * given `onPasskey`, a passkey may stand in where the caller has one made on
 * this page's name, asked for when the form is sent. A route that follows the
 * second-factor rule takes `FactorProofField`.
 */
import type { Reauthentication } from "@wired-square/appliance-types";
import { Button, Field, Notice } from "@wired-square/kit";
import { Show } from "solid-js";

import { createPasskeyHere } from "./FactorProof";
import { reauthenticationPasskey } from "./webauthn";

export interface PasswordAgainProps {
  value: string;
  onValue: (value: string) => void;
  /** A passkey is chosen in place of the password. */
  passkey?: boolean;
  onPasskey?: (chosen: boolean) => void;
  /** Said in place of the hint: why the last proof was not taken. */
  refused?: string | undefined;
}

const HINT = "Asked for again because what this does outlives the session asking for it.";

export function PasswordAgain(props: PasswordAgainProps) {
  const passkeyHere = createPasskeyHere(() => props.onPasskey !== undefined);
  return (
    <>
      <Show
        when={props.passkey}
        fallback={
          <Field
            label="Your password"
            type="password"
            autocomplete="current-password"
            required
            hint={HINT}
            error={props.refused ?? ""}
            value={props.value}
            onValue={props.onValue}
          />
        }
      >
        <Notice tone="bad">{props.refused}</Notice>
        <p class="app-muted">Your passkey is asked for when you go ahead. {HINT}</p>
      </Show>
      <Show when={props.onPasskey && (props.passkey || passkeyHere())}>
        <Button tone="plain" type="button" onClick={() => props.onPasskey?.(!props.passkey)}>
          {props.passkey ? "Use your password instead" : "Use a passkey instead"}
        </Button>
      </Show>
    </>
  );
}

/** The body `reauthenticate` reads: the password, or a passkey asked for now. */
export async function reauthentication(password: string, passkey: boolean): Promise<Reauthentication> {
  return passkey ? { passkey: await reauthenticationPasskey() } : { password };
}
