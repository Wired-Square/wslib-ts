/**
 * Settings → your own password.
 *
 * **The only way to change your own password over HTTPS, at every rung.** The
 * administrator's reset at `PUT /api/users/{id}/password` refuses the caller's
 * own account, since it asks no knowledge of the password it replaces — so an
 * Accounts screen must not offer Reset on the signed-in row, and this is where
 * that row's control lives instead.
 *
 * Available to anybody signed in, which is the point: rotating a Viewer's own
 * credential used to need an administrator, and that is how passwords come to
 * be shared. While the account's TOTP is on, a code, a recovery code or a
 * passkey is asked as well.
 *
 * `actions` is rendered beside the button, for a product that mounts this in
 * a dialog and wants a Cancel there.
 */
import { MIN_PASSWORD_LEN } from "@wired-square/appliance-types";
import type { PasswordChange } from "@wired-square/appliance-types";
import { Field, Form, Section } from "@wired-square/kit";
import { Show, createSignal } from "solid-js";
import type { JSX } from "solid-js";

import { api } from "../api";
import { FactorProofField, createFactorProof } from "../parts/FactorProof";
import { NewPassword, createNewPassword } from "../parts/NewPassword";

export function PasswordSettings(props: { actions?: JSX.Element }) {
  const [current, setCurrent] = createSignal("");
  const next = createNewPassword();
  const second = createFactorProof();

  const submit = async () => {
    await api<null>("/api/session/password", {
      method: "PUT",
      body: {
        current_password: current(),
        new_password: next.value(),
        ...(second.totpOn() ? await second.take() : {}),
      } satisfies PasswordChange,
    });
    second.clear();

    // The daemon reissues the session cookie on success — the write ends every
    // session this account had, including the one that made the request — so
    // there is nothing to do here but forget what was typed.
    setCurrent("");
    next.setValue("");
    next.setAgain("");
  };

  return (
    <Section
      title="Your password"
      blurb="Changing your own password needs the current one. Everybody signed in can do this."
    >
      <Form
        act={submit}
        verb="Change password"
        done="Your password was changed."
        disabled={!next.ready() || second.totpOn() === undefined || (second.totpOn() === true && !second.ready())}
        actions={props.actions}
      >
        <Field
          label="Current password"
          type="password"
          autocomplete="current-password"
          value={current()}
          onValue={setCurrent}
        />
        <NewPassword
          of={next}
          label="New password"
          hint={`At least ${MIN_PASSWORD_LEN} characters. Length is what matters; there is no character-class rule to satisfy.`}
        />
        <Show when={second.totpOn()}>
          <FactorProofField of={second} />
        </Show>
      </Form>
    </Section>
  );
}
