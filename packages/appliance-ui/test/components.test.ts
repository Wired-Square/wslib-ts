/**
 * The kit's components rendered to HTML on the server, compiled by the Solid
 * plugin a consumer builds with. Modules are loaded through one vite server,
 * and Solid only through `solid-js/web`: its `solid-js` is the copy the screens
 * get, where a load of "solid-js" itself can be another.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import type { Inspection, LocalIdentity, ScheduleView, User } from "@wired-square/appliance-types";
import type { JSX } from "solid-js";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import solidPlugin from "vite-plugin-solid";

import type { Session } from "../src/shell/session.ts";

let vite: ViteDevServer;
before(async () => {
  vite = await createServer({
    configFile: false,
    logLevel: "silent",
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [solidPlugin({ ssr: true, solid: { hydratable: false } })],
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
});
after(() => vite.close());

const load = <T>(path: string) => vite.ssrLoadModule(path) as Promise<T>;

async function rendered(component: () => JSX.Element): Promise<string> {
  const web = await load<typeof import("solid-js/web")>("solid-js/web");
  return web.renderToString(component);
}

const admin: User = {
  id: "1",
  username: "admin",
  role: "admin",
  enabled: true,
  created_at: "2026-09-27T00:00:00Z",
  last_login_at: null,
};

/** `Chrome` inside a `SessionProvider` holding `session`, and what its children read of it. */
async function chrome(session: Session, controls?: JSX.Element) {
  const { createComponent } = await load<typeof import("solid-js/web")>("solid-js/web");
  const { SessionProvider, useSession } = await load<typeof import("../src/shell/session.ts")>(
    "/src/shell/session.ts",
  );
  const { Chrome } = await load<typeof import("../src/shell/Chrome.tsx")>("/src/shell/Chrome.tsx");
  let seen: Session | undefined;
  const html = await rendered(() =>
    SessionProvider({
      value: session,
      get children() {
        return createComponent(Chrome, {
          controls,
          get children() {
            seen = useSession();
            return "the product";
          },
        });
      },
    }),
  );
  return { html, seen };
}

const session = (me: User | null, local?: LocalIdentity): Session => ({
  branding: () => undefined,
  me: () => me,
  local: () => local,
  refresh: () => {},
});

test("Chrome offers an account its host signs in a sign-out, and change-password only with a product's form", async () => {
  const { html } = await chrome(session(admin));
  assert.match(html, /admin/);
  assert.match(html, /Sign out/);
  assert.doesNotMatch(html, /Change password/);
  assert.match(html, /the product/);
});

const branded = (hostname: string | null): Session => ({
  ...session(admin),
  branding: () => ({ build: "b1", app_name: "Widget Monitor", manufacturer: "", tokens: {}, tokens_dark: {}, hostname }),
});

test("Chrome names the box in a chip beside the brand, before the controls, and shows none where the daemon sends no hostname", async () => {
  const named = await chrome(branded("widget-1234"), "the controls");
  assert.match(
    named.html,
    /<div class="app-masthead__brand">.*?<\/div><\/div><span class="app-hostname" title="widget-1234"><span class="app-visually-hidden">This box: <\/span>widget-1234<\/span><div class="app-masthead__tools">the controls/,
  );

  const unnamed = await chrome(branded(null));
  assert.match(unnamed.html, /Widget Monitor/);
  assert.doesNotMatch(unnamed.html, /app-hostname/);
});

test("With no controls the hostname joins the tools, so the account always has company", async () => {
  const { html } = await chrome(branded("widget-1234"));
  assert.match(html, /<div class="app-masthead__tools"><span class="app-hostname" title="widget-1234">.*?<\/span><div class="app-masthead__account">/);
});

test("A dotted hostname is its first label over the rest, heard whole; one with no dot, or an IP literal, is one line", async () => {
  const { hostnameLines } = await load<typeof import("../src/shell/Shell.tsx")>("/src/shell/Shell.tsx");
  assert.deepEqual(hostnameLines("station-1.gou.example.com"), ["station-1", "gou.example.com"]);
  for (const one of ["widget-1234", "192.168.1.20", "fe80::1", "[::1]"]) assert.deepEqual(hostnameLines(one), [one]);

  const { html } = await chrome(branded("station-1.gou.example.com"), "the controls");
  const chip = html.slice(html.indexOf('<span class="app-hostname'), html.indexOf('<div class="app-masthead__tools">'));
  assert.match(chip, /^<span class="app-hostname app-hostname--stacked" title="station-1\.gou\.example\.com">/);
  assert.match(chip, /<span class="app-visually-hidden">This box: (<!--!\$-->)?station-1\.gou\.example\.com<\/span>/);
  assert.match(chip, /<span aria-hidden="true">station-1<\/span><span class="app-hostname__domain" aria-hidden="true">gou\.example\.com<\/span><\/span>$/);
});

const localAdmin: LocalIdentity = { username: "control-socket:admin", role: "admin", local: true };

test("Chrome serves a local caller from a SessionProvider: no account, so no account controls", async () => {
  const { html, seen } = await chrome(session(null, localAdmin));
  assert.match(html, /app-masthead/);
  assert.match(html, /the product/);
  assert.doesNotMatch(html, /Change password|Sign out|control-socket/);
  assert.equal(seen?.me(), null);
  assert.deepEqual(seen?.local(), localAdmin);
});

test("Chrome renders the account twice in the tools, as controls and as a menu under the username, and shell.css shows one by width", async () => {
  const { html } = await chrome(session(admin));
  assert.match(html, /<div class="app-masthead__tools"><div class="app-masthead__account">.*Sign out.*<\/div>/);
  assert.match(
    html,
    /<div class="app-masthead__account-menu"><button[^>]*aria-label="admin, Admin, account"[^>]*aria-haspopup="menu"[^>]*><span class="app-masthead__username">admin<\/span><span class="app-menu__chevron" aria-hidden="true">/,
  );

  const css = readFileSync(new URL("../src/shell.css", import.meta.url), "utf8");
  const folded = css.slice(css.indexOf("@media (max-width: 63rem)"));
  const narrow = css.slice(css.indexOf("@media (max-width: 40rem)"));
  assert.match(css, /\.app-masthead__account-menu \{\n {2}display: none;/);
  assert.match(folded, /^[^}]*\.app-masthead__account \{\n {4}display: none;.*?\.app-masthead__account-menu \{\n {4}display: block;/s);
  assert.match(narrow, /\.app-masthead__nav \.app-tablist \{\n {4}flex-wrap: nowrap;\n {4}overflow: auto hidden;/);
});

test("shell.css stacks a dotted hostname, letting only its domain shorten, and keeps the account whole on the controls' row", () => {
  const css = readFileSync(new URL("../src/shell.css", import.meta.url), "utf8");
  assert.match(css, /\.app-hostname--stacked \{\n {2}display: inline-grid;\n {2}border-radius: var\(--app-radius\);/);
  assert.match(css, /\.app-hostname__domain \{[^}]*-webkit-line-clamp: 1;[^}]*overflow-wrap: anywhere;[^}]*opacity: 0\.8;/);
  assert.match(css, /\.app-masthead__bar \.app-hostname \{\n {2}flex: 1 1 0;\n {2}max-width: max-content;/);
  assert.match(css, /\.app-masthead__tools \{\n {2}display: flex;/);
  assert.doesNotMatch(css, /\.app-masthead__tools \{[^}]*flex-wrap/);
  assert.match(css, /\.app-masthead__username \{\n {2}overflow: hidden;\n {2}white-space: nowrap;\n {2}text-overflow: ellipsis;/);
});

test("appliance.css spaces the log's controls and the serial console from the container, not a field's margin", () => {
  const css = readFileSync(new URL("../src/appliance.css", import.meta.url), "utf8");
  assert.match(css, /\.app-log__controls \{[^}]*gap: 1rem;[^}]*margin-block-end: 1rem;/);
  assert.doesNotMatch(css, /\.app-log__controls \.app-actions/);
  assert.match(css, /\.app-serial \{[^}]*gap: 0\.75rem;/);
  assert.match(css, /\.app-serial > \.app-notice \{\n {2}margin: 0;/);
});

test("shell.css draws the switcher's button as the brand, with icons sized whether or not they load", () => {
  const css = readFileSync(new URL("../src/shell.css", import.meta.url), "utf8");
  assert.match(css, /\.app-switcher \.app-menu__trigger \{[^}]*font-weight: inherit;[^}]*color: var\(--app-text\);/);
  assert.match(css, /\.app-switcher \.app-switcher__icon \{\n {2}inline-size: 1\.25rem;\n {2}block-size: 1\.25rem;/);
  assert.doesNotMatch(css, /56rem/);
  assert.doesNotMatch(css, /app-switcher__chevron/);
});

test("overhang is how far a tab sticks out of its strip, and nothing when it is in view", async () => {
  const { overhang } = await load<typeof import("../src/shell/Chrome.tsx")>("/src/shell/Chrome.tsx");
  const strip = { left: 100, right: 400 };
  assert.equal(overhang({ left: 150, right: 250 }, strip), 0);
  assert.equal(overhang({ left: 380, right: 460 }, strip), 60);
  assert.equal(overhang({ left: 40, right: 120 }, strip), -60);
});

/** `component` inside a `SessionProvider` holding `session`. */
async function within(session: Session, component: () => JSX.Element): Promise<string> {
  const { SessionProvider } = await load<typeof import("../src/shell/session.ts")>("/src/shell/session.ts");
  return rendered(() =>
    SessionProvider({
      value: session,
      get children() {
        return component();
      },
    }),
  );
}

/** A bundle carrying every section, as Check answers it. */
const everything: Inspection = {
  header: {
    format: "appliance-backup",
    version: 2,
    created_at: "2026-09-29T00:00:00Z",
    source_host: "widget-01",
    box_id: null,
    app_version: "0.11.0",
    app_schema_version: 1,
    contains: {
      accounts: 2,
      settings: 5,
      trusted_certs: 1,
      trusted_cas: 1,
      serving_certificate: true,
      ssh_keys: 1,
      host: true,
      app: { widgets: 3 },
    },
  },
  warnings: [],
  blocked: {},
};

async function inspected(session: Session, inspection = everything): Promise<string> {
  const { Inspected } = await load<typeof import("../src/screens/BackupSettings.tsx")>(
    "/src/screens/BackupSettings.tsx",
  );
  return within(session, () =>
    Inspected({
      chosen: { text: "{}", header: everything.header },
      inspection,
      passphrase: "a passphrase long enough to be one",
      sections: [{ name: "widgets", label: "Widgets" }],
    }),
  );
}

const APPLIANCE_ROWS = /Accounts|Settings \(|Serving certificate|Authorised SSH keys|Hostname/;

test("Restore offers a local session the application half, and no proof, sign-out warning or box", async () => {
  const html = await inspected(session(null, localAdmin));
  assert.match(html, /Pinned certificates \(1 in the backup\)/);
  assert.match(html, /Trusted authorities \(1 in the backup\)/);
  assert.match(html, /Widgets \(3 in the backup\)/);
  assert.doesNotMatch(html, APPLIANCE_ROWS);
  assert.doesNotMatch(html, /which proof|signs everybody out|this box|this appliance/);
});

test("Restore offers an appliance session every section, the proof and the sign-out warning", async () => {
  const html = await inspected(session(admin));
  const rows = [
    "Accounts",
    "Settings",
    "Pinned certificates",
    "Trusted authorities",
    "Serving certificate",
    "Authorised SSH keys",
    "Hostname",
    "Widgets",
  ];
  for (const row of rows) {
    assert.ok(html.includes(`${row} (`), row);
  }
  assert.match(html, /which proof this needs/);
  assert.match(html, /signs everybody out/);
});

test("Restore leaves a blocked section unticked, untickable and saying why", async () => {
  const why = "The widgets' device is busy.";
  const html = await inspected(session(admin), { ...everything, blocked: { widgets: why } });
  assert.match(html, new RegExp(why));
  const widgets = html.slice(html.lastIndexOf("<input", html.indexOf("Widgets (")), html.indexOf("Widgets ("));
  assert.match(widgets, /disabled/);
  assert.doesNotMatch(widgets, /checked/);
});

test("A first-run restore ticks every section the header lists, and the accounts cannot be unticked", async () => {
  const { Unclaimed } = await load<typeof import("../src/screens/RestoreOnboarding.tsx")>(
    "/src/screens/RestoreOnboarding.tsx",
  );
  const header = {
    ...everything.header,
    contains: { ...everything.header.contains, ssh_keys: 0, host: false, app: { widgets: 3, dials: 0 } },
  };
  const html = await rendered(() => Unclaimed({ file: { text: "{}", header }, sections: [], onDone: () => {} }));
  const ticks = [...html.matchAll(/<input type="checkbox"([^>]*)><span>(?:<!--[^>]*-->)*([^(<]+) \(/g)].map(
    ([, attributes, label]) => [label?.trim(), attributes?.includes("checked"), attributes?.includes("disabled")],
  );
  assert.deepEqual(ticks, [
    ["Accounts", true, true],
    ["Settings", true, false],
    ["Pinned certificates", true, false],
    ["Trusted authorities", true, false],
    ["Serving certificate", true, false],
    ["widgets", true, false],
  ]);
});

test("A first-run restore names a product's section by its row, and one it was given no row for by its name", async () => {
  const { Unclaimed } = await load<typeof import("../src/screens/RestoreOnboarding.tsx")>(
    "/src/screens/RestoreOnboarding.tsx",
  );
  const header = { ...everything.header, contains: { ...everything.header.contains, app: { widgets: 3, tailnet: 1 } } };
  const html = await rendered(() =>
    Unclaimed({
      file: { text: "{}", header },
      sections: [{ name: "tailnet", label: "Tailnet", hint: "this box's node key" }],
      onDone: () => {},
    }),
  );
  assert.match(html, /Tailnet \(1 in the backup\)[^]*?<small> — this box's node key<\/small>/);
  assert.doesNotMatch(html, /tailnet \(/);
  assert.match(html, /widgets \(3 in the backup\)/);
});

test("A flagged section is carried rather than counted, in the signed-in restore and the first-run one", async () => {
  const { Unclaimed } = await load<typeof import("../src/screens/RestoreOnboarding.tsx")>(
    "/src/screens/RestoreOnboarding.tsx",
  );
  const header = { ...everything.header, contains: { ...everything.header.contains, app: { widgets: 3, node: 4 } } };
  const sections = [
    { name: "widgets", label: "Widgets" },
    { name: "node", label: "Node", flag: true },
  ];
  const { Inspected } = await screen();
  for (const html of [
    await within(session(admin), () =>
      Inspected({ chosen: { text: "{}", header }, inspection: { header, warnings: [], blocked: {} }, passphrase: "", sections }),
    ),
    await rendered(() => Unclaimed({ file: { text: "{}", header }, sections, onDone: () => {} })),
  ]) {
    assert.match(html, /Node \(carried\)/);
    assert.match(html, /Widgets \(3 in the backup\)/);
    assert.doesNotMatch(html, /Node \(4/);
  }
});

/** `BackupSettings` at `view` under `session`, with every request left unanswered. */
async function backupSettings(session: Session, view?: string): Promise<string> {
  const { BackupSettings } = await load<typeof import("../src/screens/BackupSettings.tsx")>(
    "/src/screens/BackupSettings.tsx",
  );
  const fetched = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});
  try {
    return await within(session, () => BackupSettings({ view }));
  } finally {
    globalThis.fetch = fetched;
  }
}

test("Take asks a local session for no proof, and never speaks of a box", async () => {
  const html = await backupSettings(session(null, localAdmin), "take");
  assert.match(html, /Passphrase/);
  assert.doesNotMatch(html, /which proof|this box|this appliance/);
});

test("Take asks an appliance session for its proof again", async () => {
  const html = await backupSettings(session(admin));
  assert.match(html, /which proof this needs/);
  assert.match(html, /Everything this box is/);
});

/** `BackupSettings` under `session` once the schedule has answered; nothing else does. */
async function scheduled(session: Session): Promise<string> {
  const { BackupSettings } = await screen();
  const { SessionProvider } = await load<typeof import("../src/shell/session.ts")>("/src/shell/session.ts");
  const { renderToStringAsync, Suspense } = await load<typeof import("solid-js/web")>("solid-js/web");
  const view: ScheduleView = {
    schedule: daily,
    passphrase_set: true,
    runs: true,
    state: { last_run_at: null, file: null, error: null },
    files: [],
  };
  const fetched = globalThis.fetch;
  globalThis.fetch = async (path) =>
    path === "/api/backup/schedule" ? Response.json(view) : new Response(null, { status: 404 });
  try {
    return await renderToStringAsync(() =>
      SessionProvider({
        value: session,
        get children() {
          return Suspense({
            get children() {
              return BackupSettings({ view: "schedule" });
            },
          });
        },
      }),
    );
  } finally {
    globalThis.fetch = fetched;
  }
}

test("The schedule speaks to a local session of this computer, not of a box", async () => {
  const html = await scheduled(session(null, localAdmin));
  assert.match(html, /An interval, not a time of day\./);
  assert.match(html, /on this computer on an interval/);
  assert.doesNotMatch(html, /\bbox\b|appliance/);
});

test("The schedule speaks to an appliance session of the box", async () => {
  const html = await scheduled(session(admin));
  assert.match(html, /a box with no clock/);
  assert.match(html, /on the box/);
});

const screen = () =>
  load<typeof import("../src/screens/BackupSettings.tsx")>("/src/screens/BackupSettings.tsx");

const open = { passphrase: "a passphrase long enough to be one", bundle: "{}" };
const nothing = {
  accounts: false,
  settings: false,
  trusted_certs: false,
  trusted_cas: false,
  serving_certificate: false,
  ssh_keys: false,
  host: false,
  app: [],
};
const daily = { enabled: true, every_hours: 24, keep: 7 };

test("A local session's requests carry no proof, and the rows it is not offered start unticked", async () => {
  const { takeBody, restoreBody, scheduleBody, initialPlatform } = await screen();
  const proof = { password: "hunter2" };
  assert.deepEqual(takeBody(true, open.passphrase, proof), { passphrase: open.passphrase });
  assert.deepEqual(restoreBody(true, open, nothing, proof), { ...open, sections: nothing });
  assert.deepEqual(scheduleBody(true, daily, open.passphrase, proof), { schedule: daily, passphrase: open.passphrase });
  assert.deepEqual(initialPlatform(true), {
    accounts: false,
    settings: false,
    trusted_certs: true,
    trusted_cas: true,
    serving_certificate: false,
    ssh_keys: false,
    host: false,
  });
});

test("An appliance session's requests carry its proof, and every row starts ticked", async () => {
  const { takeBody, restoreBody, scheduleBody, initialPlatform } = await screen();
  const proof = { code: "123456", browser_time: 1 };
  assert.deepEqual(takeBody(false, open.passphrase, proof), { passphrase: open.passphrase, ...proof });
  assert.deepEqual(restoreBody(false, open, nothing, proof), { ...open, sections: nothing, ...proof });
  assert.deepEqual(scheduleBody(false, daily, open.passphrase, proof), {
    schedule: daily,
    passphrase: open.passphrase,
    ...proof,
  });
  assert.deepEqual(scheduleBody(false, daily, "", proof), { schedule: daily, passphrase: null });
  assert.ok(Object.values(initialPlatform(false)).every(Boolean));
});

test("A local restore shows Check's notice that the appliance's half is left out once, and what only it found", async () => {
  const leftOut =
    "This backup also carries an appliance's own half — accounts, settings, a serving certificate, authorised keys or a hostname — which restores only onto an appliance and is left out here.";
  const checked = { ...everything, warnings: [leftOut] };
  const { Outcome } = await screen();
  const before = await inspected(session(null, localAdmin), checked);
  const after = await rendered(() =>
    Outcome({
      report: {
        applied: { ...nothing, trusted_cas: true },
        warnings: [leftOut, "The backup schedule this file carried is switched off."],
        signed_out: false,
      },
      shown: checked.warnings,
      rowFor: (name) => ({ name, label: name }),
    }),
  );
  const times = (html: string) => html.split("left out here").length - 1;
  assert.equal(times(before) + times(after), 1, after);
  assert.match(after, /The backup schedule this file carried is switched off\./);
});

async function provenance(boxId: string, local = false, console = false): Promise<string> {
  const { Provenance } = await load<typeof import("../src/parts/BundlePicker.tsx")>("/src/parts/BundlePicker.tsx");
  return rendered(() => Provenance({ header: { ...everything.header, box_id: "ours" }, boxId, local, console }));
}

test("Provenance tells a local session of this computer, and not of the serving certificate", async () => {
  assert.match(await provenance("ours", true), /\(this computer\)/);
  for (const html of [await provenance("ours", true), await provenance("theirs", true)]) {
    assert.doesNotMatch(html, /this box|this appliance|serving certificate/);
  }
});

test("Provenance tells a console's caller of this box, and not of the serving certificate", async () => {
  assert.match(await provenance("ours", true, true), /\(this box\)/);
  for (const html of [await provenance("ours", true, true), await provenance("theirs", true, true)]) {
    assert.doesNotMatch(html, /this computer|serving certificate/);
  }
});

test("Provenance tells an appliance session of this box, and warns of another's serving certificate", async () => {
  assert.match(await provenance("ours"), /\(this box\)/);
  assert.doesNotMatch(await provenance("ours"), /serving certificate/);
  const theirs = await provenance("theirs");
  assert.match(theirs, /serving certificate/);
  assert.match(theirs, /this appliance/);
});
