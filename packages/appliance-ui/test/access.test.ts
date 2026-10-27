import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "@wired-square/appliance-types";

import type { Me } from "../src/shell/session.ts";
import { admin, consoleOperator, load, localAdmin, mount, textOf } from "./mount.ts";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Holds<T, K extends PropertyKey> = T extends unknown ? (K extends keyof T ? true : never) : never;

// `isStoreAccount` reads `enabled`: these fail to compile when `Caller` moves under it.
true satisfies Same<Extract<Me, { enabled: unknown }>, User>;
true satisfies [Holds<Exclude<Me, User>, "enabled">] extends [never] ? true : false;

/** What `useAllows` and `useOwnAccount` say in `me`'s session, or `local`'s. */
async function seen(me: Me, local?: typeof localAdmin) {
  const { useAllows, useOwnAccount } = await load<typeof import("../src/access.ts")>("/src/access.ts");
  const screen = () => {
    const allows = useAllows();
    const account = useOwnAccount();
    return `operator:${allows("operator")} admin:${allows("admin")} own:${account()?.username ?? "none"}`;
  };
  return textOf((await mount(screen, () => undefined, () => local, me)).root);
}

test("useAllows reads the signed-in account's role, and useOwnAccount is that account where the store holds it", async () => {
  assert.equal(await seen(admin), "operator:true admin:true own:admin");
  assert.equal(await seen({ ...admin, role: "viewer" }), "operator:false admin:false own:admin");
});

test("A console's caller has a role and no own account", async () => {
  assert.equal(await seen(consoleOperator), "operator:true admin:false own:none");
});

test("A local caller is allowed by its own role and has no own account", async () => {
  assert.equal(await seen(admin, localAdmin), "operator:true admin:true own:none");
});
