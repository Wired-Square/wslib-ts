/**
 * The steps of a sign-in after the password, and signing in with a passkey in
 * its place, as pieces a console's own sign-in mounts as well as `SignIn`.
 *
 * `pending` is the sign-in the password step answered; it is held by the
 * caller in memory only, never in storage or a URL, and each step spends it
 * once. A step whose `pending` the box no longer holds calls `onExpired`.
 */
import type {
  ClockSkew,
  Enrolled,
  EnrolmentConfirm,
  PendingEnrolment,
  RequestOptions,
  SignInCode,
  TotpEnrolment,
  User,
} from "@wired-square/appliance-types";
import { Button, Field, Form, Notice, createAction } from "@wired-square/kit";
import { Show, createResource, createSignal, onMount } from "solid-js";

import { ApiError, api } from "../api";
import { RecoveryCodesShown, TotpKey } from "../parts/TotpKey";
import {
  ClockSkewNotice,
  PasskeyHosts,
  PasskeyUnavailable,
  clockSkewOf,
  createPasskeyAvailability,
} from "../parts/factorNotes";
import { answerPasskey } from "../parts/webauthn";

export interface StepProps {
  pending: string;
  /** Signed in: the shell asks again who is. */
  onSignedIn: () => void;
  onExpired: () => void;
}

/**
 * Run `act`, keeping the clock skew a refused code carried, and ending the
 * step when the box no longer holds its sign-in.
 */
function codeAct(setSkew: (skew: ClockSkew | undefined) => void, onExpired: () => void) {
  return async (act: () => Promise<void>) => {
    try {
      await act();
      setSkew(undefined);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return onExpired();
      setSkew(clockSkewOf(error));
      throw error;
    }
  };
}

/** A TOTP code, or a recovery code in its place. */
export function CodeStep(props: StepProps) {
  const [code, setCode] = createSignal("");
  const [recovery, setRecovery] = createSignal(false);
  const [skew, setSkew] = createSignal<ClockSkew>();
  const [done, setDone] = createSignal(false);
  const guarded = codeAct(setSkew, props.onExpired);

  return (
    <>
      <Form
        verb="Sign in"
        disabled={done() || code().trim() === ""}
        act={() =>
          guarded(async () => {
            const typed = code().trim();
            await api<User>("/api/session/code", {
              method: "POST",
              body: (recovery()
                ? { pending: props.pending, code: typed, recovery: true }
                : { pending: props.pending, code: typed, browser_time: Date.now() }) satisfies SignInCode,
            });
            setDone(true);
            props.onSignedIn();
          })
        }
        actions={
          <Button
            tone="plain"
            type="button"
            onClick={() => {
              setRecovery(!recovery());
              setCode("");
            }}
          >
            {recovery() ? "Use a code from the app instead" : "Use a recovery code instead"}
          </Button>
        }
      >
        <Field
          label={recovery() ? "Recovery code" : "Code from your authenticator app"}
          autocomplete="one-time-code"
          inputmode={recovery() ? "text" : "numeric"}
          spellcheck={false}
          autofocus
          required
          value={code()}
          onValue={setCode}
        />
      </Form>
      <ClockSkewNotice skew={skew()} />
    </>
  );
}

/**
 * An administrator requires this account to enrol TOTP before it signs in: the
 * key, its first code, then the recovery codes, after which it is signed in.
 */
export function EnrolStep(props: StepProps) {
  const [enrolment, setEnrolment] = createSignal<TotpEnrolment>();
  const [codes, setCodes] = createSignal<string[]>();
  const [code, setCode] = createSignal("");
  const [skew, setSkew] = createSignal<ClockSkew>();
  const guarded = codeAct(setSkew, props.onExpired);
  const beginning = createAction();

  onMount(() =>
    beginning.run(() =>
      guarded(async () => {
        const body: PendingEnrolment = { pending: props.pending };
        setEnrolment(await api<TotpEnrolment>("/api/session/enrolment", { method: "POST", body }));
      }),
    ),
  );

  return (
    <Show
      when={codes()}
      fallback={
        <>
          <p>An administrator asks this account to sign in with a code from an authenticator app as well.</p>
          <Notice tone="bad">{beginning.failed()}</Notice>
          <Show when={enrolment()}>
            {(key) => (
              <>
                <TotpKey enrolment={key()} />
                <Form
                  verb="Turn on and sign in"
                  disabled={codes() !== undefined || code().trim() === ""}
                  act={() =>
                    guarded(async () => {
                      const body: EnrolmentConfirm = {
                        pending: props.pending,
                        code: code().trim(),
                        browser_time: Date.now(),
                      };
                      const enrolled = await api<Enrolled>("/api/session/enrolment/confirm", { method: "POST", body });
                      setEnrolment(undefined);
                      setCodes(enrolled.recovery_codes.codes);
                    })
                  }
                >
                  <Field
                    label="Its first code"
                    autocomplete="one-time-code"
                    inputmode="numeric"
                    required
                    value={code()}
                    onValue={setCode}
                  />
                </Form>
                <ClockSkewNotice skew={skew()} />
              </>
            )}
          </Show>
        </>
      }
    >
      {(shown) => <RecoveryCodesShown codes={shown()} onDone={props.onSignedIn} />}
    </Show>
  );
}

/**
 * "Sign in with a passkey", asking for no username: the passkey names its
 * account. Shown once the box holds a passkey; where one cannot run, it says
 * why instead, and it names the hosts the box's passkeys were made on when
 * this page is another.
 */
export function PasskeySignIn(props: { onSignedIn: () => void }) {
  const { answered, here, because } = createPasskeyAvailability();
  const [hosts] = createResource(() => api<string[]>("/api/session/passkey/hosts").catch(() => []));
  const signing = createAction();

  const signIn = () =>
    signing.run(async () => {
      const options = await api<RequestOptions>("/api/session/passkey/options", { method: "POST" });
      await api<User>("/api/session/passkey", { method: "POST", body: await answerPasskey(options) });
      props.onSignedIn();
    });

  return (
    <Show when={answered() && (hosts() ?? []).length > 0}>
      <Show
        when={!because()}
        fallback={<PasskeyUnavailable because={because()!} />}
      >
        <Notice tone="bad">{signing.failed()}</Notice>
        <div class="app-actions">
          <Button type="button" pending={signing.pending()} onClick={() => void signIn()}>
            Sign in with a passkey
          </Button>
        </div>
        <PasskeyHosts hosts={hosts() ?? []} here={here()} />
      </Show>
    </Show>
  );
}
