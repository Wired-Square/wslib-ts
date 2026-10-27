/**
 * Signing in, for a product that serves its own HTTPS: it passes this as
 * `Shell`'s `signIn`.
 *
 * An unknown username, a wrong password and a disabled account are one answer
 * from the daemon: "the username or password is incorrect". That is
 * the backend's design, and it is why this form makes no attempt to be
 * more helpful — telling somebody which half they got wrong is an enumeration
 * oracle with a friendly face.
 *
 * A right password is a session, or, while the account's TOTP is on or an
 * administrator requires it, a 202 naming the next step: `CodeStep` or
 * `EnrolStep`, which a console's own sign-in mounts too, as it does
 * `PasskeySignIn`.
 *
 * `help` is the product's line beneath the form: what to do when locked out,
 * which names something of the product's on the host — its socket — and is
 * therefore not this package's to write.
 */
import type { SecondStep, SignInBody, User } from "@wired-square/appliance-types";
import { Button, Field, Form, Notice, Section } from "@wired-square/kit";
import { Match, Switch, createSignal } from "solid-js";
import type { JSX } from "solid-js";

import { api } from "../api";
import { CodeStep, EnrolStep, PasskeySignIn } from "./SecondStep";
import { useSession } from "./session";

export function SignIn(props: { help?: JSX.Element }) {
  const { refresh } = useSession();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [next, setNext] = createSignal<SecondStep>();
  const [expired, setExpired] = createSignal(false);

  const steps = {
    onSignedIn: refresh,
    onExpired: () => {
      setNext(undefined);
      setExpired(true);
    },
  };
  const back = () => (
    <Button tone="plain" type="button" onClick={() => setNext(undefined)}>
      Start again
    </Button>
  );

  return (
    <Section title="Sign in">
      <Switch>
        <Match when={next()?.next === "code" && next()}>
          {(step) => (
            <>
              <CodeStep pending={step().pending} {...steps} />
              {back()}
            </>
          )}
        </Match>
        <Match when={next()?.next === "enrol" && next()}>
          {(step) => (
            <>
              <EnrolStep pending={step().pending} {...steps} />
              {back()}
            </>
          )}
        </Match>
        <Match when={!next()}>
          <Notice tone="warn">{expired() && "That sign-in waited too long. Sign in again."}</Notice>
          <Form
            verb="Sign in"
            act={async () => {
              const answer = await api<User | SecondStep>("/api/session", {
                method: "POST",
                body: { username: username(), password: password() } satisfies SignInBody,
              });
              setPassword("");
              setExpired(false);
              if ("next" in answer) setNext(answer);
              else refresh();
            }}
          >
            <Field
              label="Username"
              autocomplete="username"
              autofocus
              required
              value={username()}
              onValue={setUsername}
            />
            <Field
              label="Password"
              type="password"
              autocomplete="current-password"
              required
              value={password()}
              onValue={setPassword}
            />
          </Form>
          <PasskeySignIn onSignedIn={refresh} />
        </Match>
      </Switch>
      {props.help}
    </Section>
  );
}
