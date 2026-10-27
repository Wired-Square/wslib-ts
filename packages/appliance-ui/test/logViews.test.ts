import assert from "node:assert/strict";
import { test } from "node:test";

import type { FeedTransport } from "../src/follow.ts";
import { click, find, load, mount, textOf, within } from "./mount.ts";

globalThis.matchMedia = (() => ({ matches: true })) as unknown as typeof matchMedia;

test("Logs' views are Since restart then Audit trail, and the ring's feed is closed while the trail is shown", async () => {
  const { LogViews } = await load<typeof import("../src/screens/LogViews.tsx")>("/src/screens/LogViews.tsx");
  const feed = { opened: 0, closed: 0 };
  const transport: FeedTransport = () => {
    feed.opened++;
    return () => feed.closed++;
  };
  const { root } = await mount(() => LogViews({ transport }), () => undefined);
  const tabs = [...within(root)].filter((n) => n.props.role === "tab").map(textOf);
  assert.deepEqual(tabs, ["Since restart", "Audit trail"]);
  assert.equal(textOf(find(root, (n) => n.tag === "h2")), "Since restart");
  assert.deepEqual(feed, { opened: 1, closed: 0 });

  await click(root, "Audit trail");
  assert.equal(textOf(find(root, (n) => n.tag === "h2")), "Audit trail");
  assert.deepEqual(feed, { opened: 1, closed: 1 });
});

test("A host's route chooses the log view", async () => {
  const { LogViews } = await load<typeof import("../src/screens/LogViews.tsx")>("/src/screens/LogViews.tsx");
  const chosen: string[] = [];
  const { root } = await mount(
    () => LogViews({ view: "audit", onView: (id) => chosen.push(id), transport: () => () => {} }),
    () => undefined,
  );
  assert.equal(textOf(find(root, (n) => n.tag === "h2")), "Audit trail");
  await click(root, "Since restart");
  assert.deepEqual(chosen, ["since-restart"]);
});
