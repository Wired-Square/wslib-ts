import assert from "node:assert/strict";
import { test } from "node:test";
import type { LocalIdentity } from "@wired-square/appliance-types";

import type { SettingsProps } from "../src/screens/Settings.tsx";
import type { Me } from "../src/shell/session.ts";
import { behindConsole } from "../src/testing/sessions.ts";
import { BOUNDARY, admin, click, find, load, localAdmin, mount, settled, textOf, within } from "./mount.ts";

const consoleAdmin: Me = behindConsole.me();

type Asked = Partial<Omit<SettingsProps, "navigate">>;

/**
 * `Settings` as `me`, or `local`, routed at `asked`, whose getters it tracks:
 * its section strip, what it shows, and where it navigated.
 */
async function settings(asked: Asked, me: Me | null = admin, local: () => LocalIdentity | undefined = () => undefined) {
  const { Settings } = await load<typeof import("../src/screens/Settings.tsx")>("/src/screens/Settings.tsx");
  const { mergeProps } = await load<typeof import("solid-js")>("solid-js");
  const went: [string, boolean][] = [];
  const { root } = await mount(
    () =>
      Settings(
        mergeProps({ section: undefined, view: undefined }, asked, {
          navigate: (to: string, options?: { replace?: boolean }) => went.push([to, options?.replace ?? false]),
        }),
      ),
    () => undefined,
    local,
    me,
  );
  const strip = [...within(root)].filter((n) => String(n.props.id).startsWith("tab-settings-")).map(textOf);
  return { root, strip, went };
}

const monitoring = {
  id: "monitoring",
  label: "Monitoring",
  role: "viewer" as const,
  panel: () => "the product's monitoring",
};

test("The sections are alphabetical with the product's among them, and a bare Settings lands on the first", async () => {
  const { strip, went } = await settings({ section: "monitoring", sections: [monitoring] });
  assert.deepEqual(strip, ["About", "Backup", "Certificates", "Monitoring", "Users"]);
  assert.deepEqual(went, []);
  assert.deepEqual((await settings({ sections: [monitoring] })).went, [["about", true]]);
});

test("Behind a console there is no About or Users, Backup is first, and it names the product as its only backup", async () => {
  const { root, strip, went } = await settings({ section: "backup", appName: "Widget Monitor" }, consoleAdmin);
  assert.deepEqual(strip, ["Backup", "Certificates"]);
  assert.deepEqual(went, []);
  assert.match(textOf(root), /The console does not back up Widget Monitor's data, so this is its only backup\./);
  assert.deepEqual((await settings({}, consoleAdmin)).went, [["backup", true]]);
});

test("Below Admin only what the role reaches is offered, and a section it does not reach lands on the first", async () => {
  const { strip, went } = await settings({ section: "backup", sections: [monitoring] }, { ...admin, role: "viewer" });
  assert.deepEqual(strip, ["Monitoring", "Users"]);
  assert.deepEqual(went, [["monitoring", true]]);
  assert.deepEqual((await settings({ section: "users" }, { ...admin, role: "viewer" })).strip, ["Users"]);
});

test("A local caller is offered what its role reaches of what the store does not hold, About among it", async () => {
  const { strip } = await settings({ section: "backup" }, admin, () => localAdmin);
  assert.deepEqual(strip, ["About", "Backup", "Certificates"]);
});

test("A moved bookmark is replaced by where it went, with its view, if that is offered", async () => {
  const moved = { trust: (view: string | undefined) => (view ? `certificates/${view}` : "certificates") };
  assert.deepEqual((await settings({ section: "trust", view: "pinning", moved })).went, [["certificates/pinning", true]]);
  assert.deepEqual((await settings({ section: "constructor", moved })).went, [["about", true]]);
  assert.deepEqual(
    (await settings({ section: "trust", view: "pinning", moved, certificates: false })).went,
    [["about", true]],
    "a move to a section not offered lands",
  );
});

test("A redirect shows where it goes, view and all, before the navigation lands", async () => {
  const landing = await settings({ section: "nowhere", sections: [monitoring] }, { ...admin, role: "viewer" });
  assert.deepEqual(landing.went, [["monitoring", true]]);
  assert.match(textOf(find(landing.root, (n) => n.props.role === "tabpanel")), /the product's monitoring/);

  const moved = { trust: (view: string | undefined) => (view ? `certificates/${view}` : "certificates") };
  const { root } = await settings({ section: "trust", view: "pinning", moved });
  const selected = [...within(root)].filter((n) => n.props["aria-selected"] === true).map(textOf);
  assert.deepEqual(selected, ["Certificates", "Pinning"]);
});

test("Certificates can be left out, and a product's own section can take its id", async () => {
  assert.deepEqual((await settings({ section: "about", certificates: false })).strip, ["About", "Backup", "Users"]);
  const own = { ...monitoring, id: "certificates", label: "Certificates", panel: () => "the product's certificates" };
  const { root, strip } = await settings({ section: "certificates", certificates: false, sections: [own] });
  assert.deepEqual(strip, ["About", "Backup", "Certificates", "Users"]);
  assert.match(textOf(find(root, (n) => n.props.role === "tabpanel")), /the product's certificates/);
});

test("A product's section repeating a standard id is refused by name, behind a console too", async () => {
  for (const id of ["users", "certificates"]) {
    const { root } = await settings({ section: "about", sections: [{ ...monitoring, id }] });
    assert.match(textOf(root), new RegExp(`${BOUNDARY}.*the product's section "${id}" repeats a standard one`));
  }
  const { root } = await settings({ section: "backup", sections: [{ ...monitoring, id: "about" }] }, consoleAdmin);
  assert.match(textOf(root), new RegExp(`${BOUNDARY}.*the product's section "about" repeats a standard one`));
});

test("A product's Certificates is refused once the standard one is shown after all", async () => {
  const { createSignal } = await load<typeof import("solid-js")>("solid-js");
  const [certificates, setCertificates] = createSignal(false);
  const own = { ...monitoring, id: "certificates", label: "Certificates" };
  const { root } = await settings({
    section: "about",
    sections: [own],
    get certificates() {
      return certificates();
    },
  });
  assert.doesNotMatch(textOf(root), new RegExp(BOUNDARY));
  setCertificates(true);
  await settled();
  assert.match(textOf(root), new RegExp(`${BOUNDARY}.*the product's section "certificates" repeats a standard one`));
});

test("With nothing offered it says so rather than showing nothing", async () => {
  const { root, went } = await settings({}, { ...consoleAdmin, role: "viewer" });
  assert.match(textOf(root), /There are no settings this account can change here\./);
  assert.deepEqual(went, []);
});

test("Until a control endpoint's caller arrives, nothing is said, and then it lands", async () => {
  const { createSignal } = await load<typeof import("solid-js")>("solid-js");
  const [local, setLocal] = createSignal<LocalIdentity>();
  const { root, went } = await settings({}, null, local);
  assert.deepEqual([textOf(root), went], ["", []]);
  setLocal(localAdmin);
  await settled();
  assert.deepEqual(went, [["about", true]]);
});

test("A section chosen navigates to it, and a view chosen within one to both", async () => {
  const { root, went } = await settings({ section: "certificates" });
  assert.match(textOf(find(root, (n) => n.props.role === "tabpanel")), /authorit/i);
  await click(root, "Pinning");
  await click(root, "Users");
  assert.deepEqual(went, [
    ["certificates/pinning", false],
    ["users", false],
  ]);
});
