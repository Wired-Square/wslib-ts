import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrustedCa, TrustedCert } from "@wired-square/appliance-types";
import type { JSX } from "solid-js";

import { load, mount, textOf, within } from "./mount.ts";
import type { Element } from "./universal.ts";

const SHA = "ab".repeat(32);
const LATER = "2099-01-01T00:00:00Z";
const ADDED = { not_before: "2026-01-01T00:00:00Z", not_after: LATER, added_at: "2026-10-01T00:00:00Z", added_by: "admin" };
const CA: TrustedCa = { sha256: SHA, subject: "CN=Site Root", pem: "", ...ADDED };
const PIN: TrustedCert = { host: "10.0.50.198", sha256: SHA, subject: "CN=meter", issuer: "CN=meter", ...ADDED };

const screens = () => load<typeof import("../src/screens/index.ts")>("/src/screens/index.ts");

/** `screen` with the authorities and pins answered as `cas` and `pins`, and the paths it read. */
async function trust(screen: () => JSX.Element, cas: TrustedCa[] = [], pins: TrustedCert[] = []) {
  const { root, asked } = await mount(screen, (path) =>
    path === "/api/tls/cas" ? Response.json(cas) : path === "/api/tls/pins" ? Response.json(pins) : undefined,
  );
  return { root, read: asked.map((a) => a.path) };
}

const nothingYetLabels = (root: Element) =>
  [...within(root)].filter((n) => n.props.class === "app-nothing-yet__label").map(textOf);

test("TrustedAuthorities is the authorities alone, an empty list a NothingYet under its blurb", async () => {
  const { TrustedAuthorities } = await screens();
  const { root, read } = await trust(() => TrustedAuthorities());
  assert.deepEqual(read, ["/api/tls/cas"]);
  assert.deepEqual(nothingYetLabels(root), ["No authorities yet"]);
  assert.match(textOf(root), /Install your site's authority once/);
  assert.doesNotMatch(textOf(root), /No authority is installed|Pinned certificates/);
});

test("PinnedCertificates is the pins alone, an empty list a NothingYet under its blurb", async () => {
  const { PinnedCertificates } = await screens();
  const { root, read } = await trust(() => PinnedCertificates());
  assert.deepEqual(read, ["/api/tls/pins"]);
  assert.deepEqual(nothingYetLabels(root), ["Nothing pinned yet"]);
  assert.match(textOf(root), /for equipment whose certificate nobody signed/);
  assert.doesNotMatch(textOf(root), /Nothing is pinned|Trusted authorities/);
});

test("OutboundTrust is both lists, and a list with rows shows them in place of its picture", async () => {
  const { OutboundTrust } = await screens();
  const { root, read } = await trust(() => OutboundTrust(), [CA]);
  assert.deepEqual(read.sort(), ["/api/tls/cas", "/api/tls/pins"]);
  assert.deepEqual(nothingYetLabels(root), ["Nothing pinned yet"]);
  assert.match(textOf(root), /Trusted authorities.*CN=Site Root.*Pinned certificates/);

  const pinned = await trust(() => OutboundTrust(), [], [PIN]);
  assert.deepEqual(nothingYetLabels(pinned.root), ["No authorities yet"]);
  assert.match(textOf(pinned.root), /10\.0\.50\.198/);
});
