/**
 * Settings → Users: the caller's own Passkeys, Password and 2FA
 * (`SecuritySettings`' views) for every role, and Accounts (`accounts`), who
 * can sign in and as what, for an admin only, in one strip a host routes
 * through `Routed`. An admin opens on Accounts, as does any view id not among
 * the three; anybody else opens on Passkeys. Add account is a dialog over
 * Accounts.
 *
 * # Your own row has no menu, and that is the contract
 *
 * `PUT /api/users/{id}/password` refuses the caller's own account. It asks
 * for no knowledge of the password it replaces — that is what makes it a
 * reset, and a forgotten password is the case it exists for — and it clears
 * the account's second factors. Your own password goes through
 * `PUT /api/session/password`, which asks for the current one. Your own role,
 * enabled flag, factors and account are another administrator's to change,
 * and a host may refuse them outright. Your own role in each app stays yours
 * to set.
 *
 * So the signed-in row has no menu, and the screen points at that route's form
 * instead. **Offering Reset would 403**, and a control that always fails is
 * worse than an absent one — the same argument `Capability` exists for,
 * arriving from policy instead of from hardware.
 *
 * # A change that grants or strips access asks for your own proof again
 *
 * Creating, disabling, enabling or deleting an account, a role change here or
 * in an app, a reset, requiring TOTP enrolment and removing a passkey carry
 * `withProof`'s proof of the acting administrator, asked once the change is
 * confirmed: while their TOTP is on, a code, a recovery code or a passkey.
 *
 * # The last-administrator rule is the daemon's, and is rendered rather than
 * predicted
 *
 * Over HTTPS the last enabled administrator cannot be demoted, disabled or
 * deleted; over the control socket it can. This screen does not try to work out
 * which row that is. It could — the list is right here — and it would be a
 * second copy of a policy that has the *listener* in it, which a browser cannot
 * see. So the refusal is rendered when it arrives, and its message says where
 * the operation can be done.
 *
 * # A caller grants only the roles up to their own
 *
 * The roles offered, and the rows with a menu, are those at or below the
 * caller's own role: only a host admin may make or change a host admin, and
 * the daemon refuses anybody else.
 *
 * # A row's second factors are glyphs
 *
 * TOTP on, passkeys held and TOTP enrolment required, from `GET /api/users`,
 * read again on choosing Accounts and after any action here changes them, and
 * none while `me` is not one of the store's own accounts.
 *
 * # `apps` is a host's
 *
 * A column per app, for a host that serves `GET /api/app-roles` and
 * `PUT /api/users/{id}/apps/{app}`; a single product's backend serves neither.
 * A host admin is Admin in every app.
 */
import { MAX_USERNAME_LEN, MIN_PASSWORD_LEN, ROLE_LADDER } from "@wired-square/appliance-types";
import type {
  AppRole,
  AppRoleChange,
  EnabledChange,
  FactorProof,
  ListedUser,
  NewUser,
  PasskeyView,
  PasswordReset,
  Role,
  RoleChange,
  User,
} from "@wired-square/appliance-types";
import {
  Badge,
  Button,
  Dialog,
  Field,
  Form,
  Loaded,
  Menu,
  MenuItem,
  Notice,
  Section,
  Select,
  Table,
  Td,
  Th,
  Tr,
  Views,
  count,
  createAction,
  cx,
  keyedRows,
  routed,
  when,
} from "@wired-square/kit";
import type { Routed, View } from "@wired-square/kit";
import { For, Show, createEffect, createResource, createSignal, on } from "solid-js";
import type { JSX } from "solid-js";

import { api } from "../api";
import { NewPassword, createNewPassword } from "../parts/NewPassword";
import { Proved } from "../parts/Proved";
import { ROLE_LABELS, RoleBadge } from "../parts/RoleBadge";
import { withProof } from "../parts/withProof";
import type { ProofAsk } from "../parts/withProof";
import { isStoreAccount } from "../shell/session";
import type { Me } from "../shell/session";
import { securityViews } from "./SecuritySettings";
import type { SecurityView } from "./SecuritySettings";

/**
 * What the screen says in place of a menu on the signed-in row.
 *
 * Deliberately not the route: naming the *endpoint* would be an API path shown
 * to an operator, and a fourth copy of a string the daemon already tracks in
 * three places.
 */
const OWN_PASSWORD_HINT = "Change your own password in the Password view.";

/** The roles an account may hold in an app, and `""` for none. */
const APP_ROLES = ["", "viewer", "operator", "admin"] as const;

export function AccountSettings(props: Routed & { me: Me; apps?: string[] }) {
  const route = routed(props);
  // `keyedRows`, so a patched row keeps its `<tr>` and the menu somebody just
  // used keeps its focus.
  const [fetched, setFetched] = createSignal<ListedUser[]>([]);
  const rows = keyedRows(fetched, "id");
  const listing = createAction({ supersede: true });
  const [appRoles, setAppRoles] = createSignal<AppRole[]>([]);
  const apps = () => props.apps ?? [];
  const grantable = () => ROLE_LADDER.slice(0, ROLE_LADDER.indexOf(props.me.role) + 1);
  const admin = () => grantable().includes("admin");

  const load = () =>
    listing.run(async () => {
      const [users, granted] = await Promise.all([
        api<ListedUser[]>("/api/users"),
        apps().length > 0 ? api<AppRole[]>("/api/app-roles") : [],
      ]);
      setFetched(users);
      setAppRoles(granted);
    });

  const [resetting, setResetting] = createSignal<User | undefined>();
  const [added, setAdded] = createSignal<string>();
  const [adding, setAdding] = createSignal(false);

  /** Set one field on one row; the reconcile leaves every other row alone. */
  const patch = <K extends keyof User>(id: string, key: K, value: User[K]) =>
    setFetched((have) => have.map((row) => (row.id === id ? { ...row, [key]: value } : row)));

  const [passkeysOf, setPasskeysOf] = createSignal<User>();
  const acting = createAction();
  /** `act`, confirmed with the acting administrator's proof; a refusal is said above the list. */
  const proved = (ask: Omit<ProofAsk, "tone">, act: (proof: FactorProof) => Promise<unknown>) =>
    void acting.run(() => withProof({ ...ask, tone: "danger" }, (proof) => act(proof).then(() => ({}))));

  const setRole = (user: User, role: Role) =>
    proved(
      {
        for: `Make ${user.username} ${ROLE_LABELS[role].toLowerCase()}?`,
        about: "What they may do changes from their next request.",
        verb: `Make ${ROLE_LABELS[role].toLowerCase()}`,
      },
      async (proof) => {
        await api<null>(`/api/users/${user.id}/role`, {
          method: "PUT",
          body: { role, proof } satisfies RoleChange,
        });
        patch(user.id, "role", role);
      },
    );

  const toggle = (user: User) => {
    const verb = user.enabled ? "Disable" : "Enable";
    proved(
      {
        for: `${verb} ${user.username}?`,
        about: user.enabled ? "They cannot sign in until enabled again." : "They can sign in again.",
        verb,
      },
      async (proof) => {
        await api<null>(`/api/users/${user.id}/enabled`, {
          method: "PUT",
          body: { enabled: !user.enabled, proof } satisfies EnabledChange,
        });
        patch(user.id, "enabled", !user.enabled);
      },
    );
  };

  const roleIn = (user: User, app: string) =>
    appRoles().find((granted) => granted.user_id === user.id && granted.app === app)?.role ?? "";

  const setAppRole = (user: User, app: string, role: Role | null) =>
    proved(
      {
        for: role
          ? `Make ${user.username} ${ROLE_LABELS[role].toLowerCase()} in ${app}?`
          : `Remove ${user.username} from ${app}?`,
        about: `What they may do in ${app} changes from their next request.`,
        verb: role ? `Make ${ROLE_LABELS[role].toLowerCase()}` : "Remove",
      },
      async (proof) => {
        await api<null>(`/api/users/${user.id}/apps/${encodeURIComponent(app)}`, {
          method: "PUT",
          body: { role, proof } satisfies AppRoleChange,
        });
        setAppRoles((have) => [
          ...have.filter((granted) => granted.user_id !== user.id || granted.app !== app),
          ...(role ? [{ user_id: user.id, app, role }] : []),
        ]);
      },
    );

  const requireTotp = (user: User) =>
    proved(
      {
        for: `Require ${user.username} to enrol TOTP?`,
        about:
          "Their TOTP key and recovery codes are cleared, and their next sign-in with a password sets up a new key " +
          "before it is let in. Their password and passkeys stay: where the account may be in someone else's hands, " +
          "reset its password instead, which clears every factor.",
        verb: "Require enrolment",
      },
      (proof) => api<null>(`/api/users/${user.id}/require-totp`, { method: "POST", body: proof }).then(() => void load()),
    );

  const remove = (user: User) =>
    proved(
      {
        for: `Delete ${user.username}?`,
        about: "The account is removed and any session it holds stops working. What it did stays in the audit log.",
        verb: "Delete",
      },
      async (proof) => {
        await api<null>(`/api/users/${user.id}`, { method: "DELETE", body: proof });
        setFetched((have) => have.filter((u) => u.id !== user.id));
      },
    );

  const list = () => (
    <Section
      title="Accounts"
      blurb="Everybody who can sign in to this appliance."
      actions={
        <Button
          onClick={() => {
            setAdded(undefined);
            setAdding(true);
          }}
        >
          Add account…
        </Button>
      }
    >
      <Notice tone="good">{added() && `The account ${added()} was created.`}</Notice>
      <Notice tone="bad">{listing.failed()}</Notice>
      <Notice tone="bad">{acting.failed()}</Notice>

      <Table
        head={
          <>
            <Th>Username</Th>
            <Th>Role</Th>
            <For each={apps()}>{(app) => <Th>{app}</Th>}</For>
            <Th>Last signed in</Th>
            <Th unseen>Actions</Th>
          </>
        }
      >
        <For each={rows()}>
          {(user) => {
            const mine = () => user.id === props.me.id;
            const mayChange = () => !mine() && grantable().includes(user.role);

            return (
              <Tr>
                <Td>
                  {user.username}
                  <Show when={mine()}>
                    {" "}
                    <Badge tone="neutral">You</Badge>
                  </Show>
                  <Show when={!user.enabled}>
                    {" "}
                    <Badge tone="neutral" title="Cannot sign in until enabled again.">
                      Disabled
                    </Badge>
                  </Show>
                  <Show when={isStoreAccount(props.me)}>
                    <FactorGlyphs user={user} />
                  </Show>
                </Td>
                <Td>
                  <RoleBadge role={user.role} />
                </Td>
                <For each={apps()}>
                  {(app) => (
                    <Td>
                      <Show when={user.role !== "hostadmin"} fallback={<RoleBadge role="admin" />}>
                        <select
                          class="app-field__input"
                          aria-label={`${user.username}'s role in ${app}`}
                          value={roleIn(user, app)}
                          onChange={(e) => {
                            const select = e.currentTarget;
                            setAppRole(user, app, (select.value || null) as Role | null);
                            select.value = roleIn(user, app);
                          }}
                        >
                          <For each={APP_ROLES}>
                            {(role) => <option value={role}>{role ? ROLE_LABELS[role] : "None"}</option>}
                          </For>
                        </select>
                      </Show>
                    </Td>
                  )}
                </For>
                <Td numeric>
                  {/*
                    `null` means never signed in, which is the answer worth
                    having — a commissioning account nobody has touched looks
                    identical to one in daily use until this distinguishes
                    them. "Never" rather than the dash used for an absent
                    date: a dash reads as "we do not know", and here we do.
                  */}
                  {user.last_login_at ? when(user.last_login_at) : "Never"}
                </Td>
                <Td controls>
                  <Show when={mayChange()}>
                    <Menu aria-label={`Actions for ${user.username}`}>
                      <For each={grantable().filter((r) => r !== user.role)}>
                        {(role) => (
                          <MenuItem onSelect={() => setRole(user, role)}>
                            Make {ROLE_LABELS[role].toLowerCase()}…
                          </MenuItem>
                        )}
                      </For>
                      <MenuItem onSelect={() => toggle(user)}>{user.enabled ? "Disable…" : "Enable…"}</MenuItem>
                      <MenuItem onSelect={() => setResetting(user)}>Reset password…</MenuItem>
                      <MenuItem onSelect={() => requireTotp(user)}>Require TOTP enrolment…</MenuItem>
                      <MenuItem onSelect={() => setPasskeysOf(user)}>Passkeys…</MenuItem>
                      <MenuItem onSelect={() => remove(user)}>Delete…</MenuItem>
                    </Menu>
                  </Show>
                </Td>
              </Tr>
            );
          }}
        </For>
      </Table>
      <p class="app-muted">{OWN_PASSWORD_HINT}</p>
    </Section>
  );
  const security = securityViews<"accounts">();
  const accounts: View<SecurityView | "accounts"> = { id: "accounts", label: "Accounts", panel: list };
  const onAccounts = () => admin() && !security.some((view) => view.id === route.selected);
  createEffect(
    on(onAccounts, (yes) => {
      if (yes) void load();
    }),
  );

  return (
    <>
      <Views
        aria-label="Users"
        group="users"
        views={[...security, ...(admin() ? [accounts] : [])]}
        selected={onAccounts() ? "accounts" : route.selected}
        onChange={(to) => {
          setAdded(undefined);
          route.onChange(to);
        }}
      />

      <Show when={adding()}>
        <Dialog title="Add an account" onClose={() => setAdding(false)}>
          <NewAccount
            roles={grantable()}
            onCancel={() => setAdding(false)}
            onAdded={(username) => {
              setAdding(false);
              setAdded(username);
              void load();
            }}
          />
        </Dialog>
      </Show>

      <Show when={resetting()}>
        {(user) => (
          <ResetPassword
            user={user()}
            onChanged={() => void load()}
            onClose={() => setResetting(undefined)}
          />
        )}
      </Show>

      <Show when={passkeysOf()}>
        {(user) => (
          <AccountPasskeys user={user()} onChanged={() => void load()} onClose={() => setPasskeysOf(undefined)} />
        )}
      </Show>
    </>
  );
}

function Glyph(props: { label: string; warn?: boolean; children: JSX.Element }) {
  return (
    <>
      {" "}
      <span
        class={cx("app-glyph", props.warn && "app-glyph--warn")}
        role="img"
        aria-label={props.label}
        title={props.label}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {props.children}
        </svg>
      </span>
    </>
  );
}

const totpGlyph = () => (
  <>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2M10 2h4" />
  </>
);

function FactorGlyphs(props: { user: ListedUser }) {
  return (
    <>
      <Show when={props.user.totp}>
        <Glyph label="TOTP is on">{totpGlyph()}</Glyph>
      </Show>
      <Show when={props.user.passkeys > 0}>
        <Glyph label={count(props.user.passkeys, "passkey")}>
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-1a6 6 0 0 1 9-5.2" />
          <circle cx="17" cy="14" r="2.5" />
          <path d="M17 16.5V22m0-2.5h2" />
        </Glyph>
      </Show>
      <Show when={props.user.totp_required}>
        <Glyph label="Must set up TOTP at the next sign-in with a password" warn>
          {totpGlyph()}
        </Glyph>
      </Show>
    </>
  );
}

/** Another account's passkeys, one of which may be removed. */
function AccountPasskeys(props: { user: User; onChanged: () => void; onClose: () => void }) {
  const path = `/api/users/${props.user.id}/passkeys`;
  const [passkeys, { refetch }] = createResource(() => api<PasskeyView[]>(path));
  const [chosen, setChosen] = createSignal("");
  const picked = () => chosen() || (passkeys.state === "ready" ? passkeys()[0]?.id : "") || "";
  return (
    <Proved
      tone="danger"
      title={`${props.user.username}'s passkeys`}
      verb="Remove passkey"
      disabled={picked() === ""}
      act={(proof) =>
        api<null>(`${path}/${encodeURIComponent(picked())}/remove`, { method: "POST", body: proof }).then(
          props.onChanged,
        )
      }
      onClose={props.onClose}
    >
      <Loaded of={passkeys} refetch={refetch} reading="their passkeys">
        {(list) => (
          <Show when={list().length > 0} fallback={<p class="app-muted">They have no passkeys.</p>}>
            <Select label="Passkey" value={picked()} onValue={setChosen}>
              <For each={list()}>
                {(passkey) => (
                  <option value={passkey.id}>
                    {passkey.name} — made on {passkey.host}, last used{" "}
                    {passkey.last_used_at ? when(passkey.last_used_at) : "never"}
                  </option>
                )}
              </For>
            </Select>
            <p>The one removed no longer signs them in.</p>
          </Show>
        )}
      </Loaded>
    </Proved>
  );
}

/** Create an account, with a password an administrator chooses. */
function NewAccount(props: { roles: readonly Role[]; onCancel: () => void; onAdded: (username: string) => void }) {
  const [username, setUsername] = createSignal("");
  const password = createNewPassword();
  const [role, setRole] = createSignal<Role>("viewer");

  const submit = async () => {
    const created = await withProof({ for: `Create ${username()}`, verb: "Create account" }, (proof) =>
      api<User>("/api/users", {
        method: "POST",
        body: { username: username(), password: password.value(), role: role(), proof } satisfies NewUser,
      }),
    );
    if (created) props.onAdded(created.username);
  };

  return (
    <Form
      act={submit}
      verb="Create account"
      disabled={!password.ready()}
      actions={
        <Button tone="plain" type="button" onClick={props.onCancel}>
          Cancel
        </Button>
      }
    >
      <Field
        label="Username"
        value={username()}
        onValue={setUsername}
        maxLength={MAX_USERNAME_LEN}
        autocomplete="off"
      />
      <NewPassword
        of={password}
        label="Password"
        hint={`At least ${MIN_PASSWORD_LEN} characters. They can change it themselves once they are in.`}
      />
      <Select
        label="Role"
        value={role()}
        onValue={(role) => setRole(role as Role)}
        hint="Only an admin can change settings or other people's accounts."
      >
        <For each={props.roles}>
          {(name) => <option value={name}>{ROLE_LABELS[name]}</option>}
        </For>
      </Select>
    </Form>
  );
}

/**
 * Reset somebody else's password, which also clears their second factors: the
 * way back in for somebody who lost them, and the tool for an account that may
 * be in someone else's hands. A requirement to enrol TOTP stays.
 */
function ResetPassword(props: { user: User; onChanged: () => void; onClose: () => void }) {
  const password = createNewPassword();

  // No local error state and no catch: `Proved` keeps the dialog open on a
  // throw and renders the refusal inside it, which is what keeps the typed
  // password and the reason for the refusal together.
  const reset = (proof: FactorProof) =>
    api<null>(`/api/users/${props.user.id}/password`, {
      method: "PUT",
      body: { password: password.value(), proof } satisfies PasswordReset,
    }).then(props.onChanged);

  return (
    <Proved
      tone="danger"
      title={`Reset ${props.user.username}'s password?`}
      verb="Reset password"
      act={reset}
      disabled={!password.ready()}
      onClose={props.onClose}
    >
      <p>
        They will be signed out everywhere, and will need this password to get
        back in. Tell them through something other than this appliance. Their
        TOTP key, recovery codes and passkeys are removed too.
      </p>
      <NewPassword of={password} label="New password" hint={`At least ${MIN_PASSWORD_LEN} characters.`} />
    </Proved>
  );
}
