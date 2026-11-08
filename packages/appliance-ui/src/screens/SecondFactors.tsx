/**
 * Your own second factors: TOTP, with its recovery codes, and passkeys, as two
 * pieces a product or a console mounts where it keeps the account's settings.
 *
 * Turning TOTP on or off, new recovery codes and a new passkey each ask
 * `withProof`'s proof; renaming or removing a passkey asks none. TOTP
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
  Notice,
  Section,
  Table,
  Td,
  Th,
  Tr,
  count,
  createAction,
  when,
} from "@wired-square/kit";
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";

import { api } from "../api";
import { passkeysChanged, totpChanged } from "../parts/FactorProof";
import { RecoveryCodesShown, TotpKey } from "../parts/TotpKey";
import {
  ClockSkewNotice,
  PasskeyHosts,
  PasskeyUnavailable,
  clockSkewOf,
  createPasskeyAvailability,
} from "../parts/factorNotes";
import { makePasskey } from "../parts/webauthn";
import { withProof } from "../parts/withProof";

export function TotpSettings() {
  const [view, { refetch }] = createResource(() => api<TotpView>("/api/session/totp"));
  const [enrolment, setEnrolment] = createSignal<TotpEnrolment>();
  const [codes, setCodes] = createSignal<string[]>();
  const [first, setFirst] = createSignal("");
  const [skew, setSkew] = createSignal<ClockSkew>();
  const turningOff = createAction();

  const turned = () => {
    totpChanged();
    void refetch();
  };
  const turnOff = () =>
    void turningOff.run(
      () =>
        withProof(
          {
            for: "Turn off 2FA?",
            about: "Your password alone will sign you in, and your recovery codes stop working.",
            verb: "Turn off",
            tone: "danger",
          },
          (body) => api<null>("/api/session/totp/off", { method: "POST", body }),
        ),
      (off) => {
        if (off !== undefined) turned();
      },
    );

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
                act={async () => {
                  const enrolled = await withProof({ for: "Set up 2FA", verb: "Set up" }, (body) =>
                    api<TotpEnrolment>("/api/session/totp", { method: "POST", body }),
                  );
                  if (enrolled) setEnrolment(enrolled);
                }}
              >
                {null}
              </Form>
            </Match>
            <Match when={state().on}>
              <p>
                On, with {count(state().recovery_codes_left, "recovery code")} left. To move to another
                authenticator app, turn it off and set it up again.
              </p>
              <Form
                verb="New recovery codes"
                actions={
                  <Button
                    tone="danger"
                    type="button"
                    pending={turningOff.pending()}
                    onClick={turnOff}
                  >
                    Turn off…
                  </Button>
                }
                act={async () => {
                  const issued = await withProof({ for: "New recovery codes", verb: "Make new codes" }, (body) =>
                    api<RecoveryCodes>("/api/session/recovery-codes", { method: "POST", body }),
                  );
                  if (!issued) return;
                  setCodes(issued.codes);
                  void refetch();
                }}
              >
                <Notice tone="bad">{turningOff.failed()}</Notice>
              </Form>
            </Match>
          </Switch>
        )}
      </Loaded>
    </Section>
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
 * proof asked once the form is sent. A ceremony that fails before `register`
 * is posted keeps its options, and a retry within their timeout runs again,
 * for what is left of it, without asking for proof; one after asks again.
 */
function AddPasskey(props: { host: string; onClose: () => void; onAdded: (made: PasskeyView) => void }) {
  const [name, setName] = createSignal("");
  const [held, setHeld] = createSignal<{ options: CreationOptions; until: number }>();
  const proved = async () => {
    const options = await withProof({ for: "Add a passkey" }, (body) =>
      api<CreationOptions>("/api/session/passkeys/options", { method: "POST", body }),
    );
    if (options) setHeld({ options, until: Date.now() + options.timeout });
    return options;
  };
  return (
    <Dialog title="Add a passkey" onClose={props.onClose}>
      <p class="app-muted">It is made for {props.host}, and signs in only at that name.</p>
      <Form
        verb={held() ? "Try again" : "Add passkey"}
        disabled={name().trim() === ""}
        actions={
          <Button tone="plain" type="button" onClick={props.onClose}>
            Cancel
          </Button>
        }
        act={async () => {
          const kept = held();
          const left = kept ? kept.until - Date.now() : 0;
          const options = kept && left > 0 ? { ...kept.options, timeout: left } : await proved();
          if (!options) return;
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
        <Show when={held()}>
          <p class="app-muted">Your proof still stands: try the passkey again.</p>
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
