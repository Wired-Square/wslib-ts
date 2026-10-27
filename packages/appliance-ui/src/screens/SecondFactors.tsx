/**
 * Your own second factors: TOTP, with its recovery codes, and passkeys, as two
 * pieces a product or a console mounts where it keeps the account's settings.
 *
 * Turning TOTP on or off, new recovery codes and a new passkey each ask
 * `FactorProofField`'s proof; renaming or removing a passkey asks none. TOTP
 * is not replaced while it is on: it is turned off and set up again.
 */
import { MAX_PASSKEY_NAME_LEN } from "@wired-square/appliance-types";
import type {
  ClockSkew,
  CreationOptions,
  PasskeyRegistration,
  PasskeyRename,
  PasskeyView,
  RecoveryCodes,
  TotpConfirm,
  TotpEnrolment,
  TotpView,
} from "@wired-square/appliance-types";
import {
  Button,
  Confirm,
  Dialog,
  Field,
  Form,
  Loaded,
  Menu,
  MenuItem,
  NothingYet,
  Refusal,
  Section,
  Table,
  Td,
  Th,
  Tr,
  count,
  when,
} from "@wired-square/kit";
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";

import { api } from "../api";
import { FactorProofField, createFactorProof, passkeysChanged, totpChanged } from "../parts/FactorProof";
import { RecoveryCodesShown, TotpKey } from "../parts/TotpKey";
import {
  ClockSkewNotice,
  PasskeyHosts,
  PasskeyUnavailable,
  clockSkewOf,
  createPasskeyAvailability,
} from "../parts/factorNotes";
import { makePasskey } from "../parts/webauthn";

export function TotpSettings() {
  const [view, { refetch }] = createResource(() => api<TotpView>("/api/session/totp"));
  const on = () => (view.error ? undefined : view.latest?.on);
  const [enrolment, setEnrolment] = createSignal<TotpEnrolment>();
  const [codes, setCodes] = createSignal<string[]>();
  const [first, setFirst] = createSignal("");
  const [skew, setSkew] = createSignal<ClockSkew>();
  const [turningOff, setTurningOff] = createSignal(false);
  const setUp = createFactorProof(on);
  const renew = createFactorProof(on);

  const turned = () => {
    totpChanged();
    void refetch();
  };

  return (
    <Section title="2FA" blurb="A code from an authenticator app, asked for after your password.">
      <Loaded of={view} refetch={refetch} reading="whether 2FA is on">
        {(state) => (
          <Switch>
            <Match when={codes()}>
              {(issued) => <RecoveryCodesShown codes={issued()} onDone={() => setCodes(undefined)} />}
            </Match>
            <Match when={enrolment()}>
              {(key) => (
                <>
                  <TotpKey enrolment={key()} />
                  <Form
                    verb="Turn on"
                    disabled={first().trim() === ""}
                    actions={
                      <Button tone="plain" type="button" onClick={() => setEnrolment(undefined)}>
                        Cancel
                      </Button>
                    }
                    act={async () => {
                      try {
                        const body: TotpConfirm = { code: first().trim(), browser_time: Date.now() };
                        const issued = await api<RecoveryCodes>("/api/session/totp/confirm", { method: "POST", body });
                        setSkew(undefined);
                        setFirst("");
                        setEnrolment(undefined);
                        setCodes(issued.codes);
                        turned();
                      } catch (error) {
                        setSkew(clockSkewOf(error));
                        throw error;
                      }
                    }}
                  >
                    <Field
                      label="The code the app shows"
                      autocomplete="one-time-code"
                      inputmode="numeric"
                      required
                      value={first()}
                      onValue={setFirst}
                    />
                  </Form>
                  <ClockSkewNotice skew={skew()} />
                </>
              )}
            </Match>
            <Match when={!state().on}>
              <p class="app-muted">Off: your password alone signs you in.</p>
              <Form
                verb="Set up"
                disabled={!setUp.ready()}
                act={async () => {
                  const body = await setUp.take();
                  setEnrolment(await api<TotpEnrolment>("/api/session/totp", { method: "POST", body }));
                  setUp.clear();
                }}
              >
                <FactorProofField of={setUp} />
              </Form>
            </Match>
            <Match when={state().on}>
              <p>
                On, with {count(state().recovery_codes_left, "recovery code")} left. To move to another
                authenticator app, turn it off and set it up again.
              </p>
              <Form
                verb="New recovery codes"
                disabled={!renew.ready()}
                actions={
                  <Button tone="danger" type="button" onClick={() => setTurningOff(true)}>
                    Turn off…
                  </Button>
                }
                act={async () => {
                  const body = await renew.take();
                  setCodes((await api<RecoveryCodes>("/api/session/recovery-codes", { method: "POST", body })).codes);
                  void refetch();
                  renew.clear();
                }}
              >
                <FactorProofField of={renew} />
              </Form>
            </Match>
          </Switch>
        )}
      </Loaded>
      <Show when={turningOff()}>
        <TurnOff on={on} onClose={() => setTurningOff(false)} onDone={turned} />
      </Show>
    </Section>
  );
}

function TurnOff(props: { on: () => boolean | undefined; onClose: () => void; onDone: () => void }) {
  const proof = createFactorProof(props.on);
  return (
    <Confirm
      title="Turn off 2FA?"
      verb="Turn off"
      disabled={!proof.ready()}
      onClose={props.onClose}
      act={async () => {
        await api<null>("/api/session/totp/off", { method: "POST", body: await proof.take() });
        props.onDone();
      }}
    >
      <p>Your password alone will sign you in, and your recovery codes stop working.</p>
      <FactorProofField of={proof} />
    </Confirm>
  );
}

export function PasskeySettings() {
  const [list, { refetch, mutate }] = createResource(() => api<PasskeyView[]>("/api/session/passkeys"));
  const { answered, here, because } = createPasskeyAvailability();
  const [adding, setAdding] = createSignal(false);
  const [renaming, setRenaming] = createSignal<PasskeyView>();
  const [removing, setRemoving] = createSignal<PasskeyView>();
  const change = (to: (have: PasskeyView[]) => PasskeyView[]) => mutate((have) => to(have ?? []));
  const addable = () => (because() ? undefined : here());

  return (
    <Section
      title="Passkeys"
      blurb="Sign in with this device's screen lock or a security key in place of your password and code."
      actions={
        <Show when={addable()}>
          <Button onClick={() => setAdding(true)}>Add a passkey…</Button>
        </Show>
      }
    >
      <Loaded of={list} refetch={refetch} reading="your passkeys">
        {(passkeys) => (
          <Show when={passkeys().length > 0} fallback={<NothingYet label="No passkeys yet" />}>
            <Table
              head={
                <>
                  <Th>Name</Th>
                  <Th>Made on</Th>
                  <Th>Added</Th>
                  <Th>Last used</Th>
                  <Th unseen>Actions</Th>
                </>
              }
            >
              <For each={passkeys()}>
                {(passkey) => (
                  <Tr>
                    <Td>{passkey.name}</Td>
                    <Td>{passkey.host}</Td>
                    <Td numeric>{when(passkey.created_at)}</Td>
                    <Td numeric>{passkey.last_used_at ? when(passkey.last_used_at) : "Never"}</Td>
                    <Td controls>
                      <Menu aria-label={`Actions for ${passkey.name}`}>
                        <MenuItem onSelect={() => setRenaming(passkey)}>Rename…</MenuItem>
                        <MenuItem onSelect={() => setRemoving(passkey)}>Remove…</MenuItem>
                      </Menu>
                    </Td>
                  </Tr>
                )}
              </For>
            </Table>
            <PasskeyHosts hosts={[...new Set(passkeys().map((p) => p.host))]} here={here()} />
          </Show>
        )}
      </Loaded>

      <Show when={answered() && (because() ?? (here() ? undefined : "whether this box offers them could not be read"))}>
        {(why) => <PasskeyUnavailable because={why()} />}
      </Show>
      <Show when={adding() && addable()}>
        {(host) => (
          <AddPasskey
            host={host()}
            onClose={() => setAdding(false)}
            onAdded={(made) => {
              change((have) => [...have, made]);
              passkeysChanged();
            }}
          />
        )}
      </Show>

      <Show when={renaming()}>
        {(passkey) => (
          <Rename
            passkey={passkey()}
            onClose={() => setRenaming(undefined)}
            onRenamed={(to) =>
              change((have) => have.map((p) => (p.id === passkey().id ? { ...p, name: to } : p)))
            }
          />
        )}
      </Show>
      <Show when={removing()}>
        {(passkey) => (
          <Confirm
            title={`Remove ${passkey().name}?`}
            verb="Remove"
            onClose={() => setRemoving(undefined)}
            act={async () => {
              await api<null>(`/api/session/passkeys/${encodeURIComponent(passkey().id)}`, { method: "DELETE" });
              change((have) => have.filter((p) => p.id !== passkey().id));
              passkeysChanged();
            }}
          >
            It no longer signs you in. The device may keep it until you delete it there too.
          </Confirm>
        )}
      </Show>
    </Section>
  );
}

/**
 * A passkey made for `host`, the name this page reached the box by, with fresh
 * proof. A ceremony that fails before `register` is posted keeps its options,
 * and a retry within their timeout runs again, for what is left of it, without
 * asking for proof.
 */
function AddPasskey(props: { host: string; onClose: () => void; onAdded: (made: PasskeyView) => void }) {
  const [name, setName] = createSignal("");
  const proof = createFactorProof();
  const [held, setHeld] = createSignal<{ options: CreationOptions; until: number }>();
  const proved = async () => {
    const body = await proof.take();
    const options = await api<CreationOptions>("/api/session/passkeys/options", { method: "POST", body });
    setHeld({ options, until: Date.now() + options.timeout });
    proof.clear();
    return options;
  };
  return (
    <Dialog title="Add a passkey" onClose={props.onClose}>
      <p class="app-muted">It is made for {props.host}, and signs in only at that name.</p>
      <Form
        verb={held() ? "Try again" : "Add passkey"}
        disabled={(!held() && !proof.ready()) || name().trim() === ""}
        actions={
          <Button tone="plain" type="button" onClick={props.onClose}>
            Cancel
          </Button>
        }
        act={async () => {
          const kept = held();
          const left = kept ? kept.until - Date.now() : 0;
          if (kept && left <= 0) {
            setHeld(undefined);
            throw new Refusal("the earlier attempt expired; prove it is you again");
          }
          const options = kept ? { ...kept.options, timeout: left } : await proved();
          const credential = await makePasskey(options);
          setHeld(undefined);
          const body: PasskeyRegistration = { name: name().trim(), credential };
          const made = await api<PasskeyView>("/api/session/passkeys", { method: "POST", body });
          props.onClose();
          props.onAdded(made);
        }}
      >
        <Field
          label="Name"
          hint="Which device or key it is, so you know which to remove."
          maxLength={MAX_PASSKEY_NAME_LEN}
          required
          value={name()}
          onValue={setName}
        />
        <Show when={!held()} fallback={<p class="app-muted">Your proof still stands: try the passkey again.</p>}>
          <FactorProofField of={proof} />
        </Show>
      </Form>
    </Dialog>
  );
}

function Rename(props: { passkey: PasskeyView; onClose: () => void; onRenamed: (to: string) => void }) {
  const [name, setName] = createSignal(props.passkey.name);
  return (
    <Dialog title={`Rename ${props.passkey.name}`} onClose={props.onClose}>
      <Form
        verb="Rename"
        disabled={name().trim() === ""}
        actions={
          <Button tone="plain" type="button" onClick={props.onClose}>
            Cancel
          </Button>
        }
        act={async () => {
          const to = name().trim();
          await api<null>(`/api/session/passkeys/${encodeURIComponent(props.passkey.id)}/name`, {
            method: "PUT",
            body: { name: to } satisfies PasskeyRename,
          });
          props.onRenamed(to);
          props.onClose();
        }}
      >
        <Field label="Name" maxLength={MAX_PASSKEY_NAME_LEN} required value={name()} onValue={setName} />
      </Form>
    </Dialog>
  );
}
