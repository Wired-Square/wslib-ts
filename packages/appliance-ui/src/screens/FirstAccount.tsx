/**
 * The first account, on a box that has none.
 *
 * `Shell` shows it instead of sign-in when `GET /api/onboarding` says `needed`;
 * it takes the app's name as a prop rather than reading `useSession()`, so a
 * product mounting its own gate can use it. The daemon answers
 * `POST /api/onboarding` with the new administrator
 * signed in, so `onDone` is where the caller refetches who it is and carries on
 * into the app; there is no second sign-in.
 *
 * The daemon refuses the second attempt with a 409, and rendering that message
 * is the whole handling: a box that grew an account between this screen
 * loading and Save being pressed says so in words.
 *
 * `actions` is what else a box with no accounts offers: `RestoreOnboarding` for
 * the replacement box. It calls a route the product has to have mounted.
 */
import { MIN_PASSWORD_LEN } from "@wired-square/appliance-types";
import type { FirstAccountBody, User } from "@wired-square/appliance-types";
import { Field, Form, Section } from "@wired-square/kit";
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";

import { api } from "../api";
import { NewPassword, createNewPassword } from "../parts/NewPassword";

export function FirstAccount(props: {
  appName: string;
  onDone: (user: User) => void;
  actions?: JSX.Element;
}) {
  const [username, setUsername] = createSignal("");
  const password = createNewPassword();

  const submit = async () => {
    const user = await api<User>("/api/onboarding", {
      method: "POST",
      body: { username: username(), password: password.value() } satisfies FirstAccountBody,
    });
    props.onDone(user);
  };

  return (
    <Section
      title={`Set up ${props.appName}`}
      blurb="This appliance has no accounts yet. The first one you make is its administrator."
    >
      <Form act={submit} verb="Create administrator" disabled={!password.ready()}>
        <Field
          label="Username"
          autocomplete="username"
          required
          value={username()}
          onValue={setUsername}
        />
        <NewPassword
          of={password}
          label="Password"
          hint={`At least ${MIN_PASSWORD_LEN} characters. Length is what matters; there is no character-class rule to satisfy.`}
        />
      </Form>
      {props.actions}
    </Section>
  );
}
