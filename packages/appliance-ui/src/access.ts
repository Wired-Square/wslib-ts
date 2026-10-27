/**
 * What a screen offers whom: the role ladder's comparison, and the session's
 * caller read through it.
 */
import { ROLE_LADDER } from "@wired-square/appliance-types";
import type { Role, User } from "@wired-square/appliance-types";
import type { Accessor } from "solid-js";

import { isStoreAccount, useSession } from "./shell/session";

/**
 * Whether `held` satisfies a requirement for `needed`. Mirrors `Role::allows`.
 *
 * Rank is position in `ROLE_LADDER`, generated from the Rust `LADDER`, so
 * inserting a tier in the middle moves both ends at once. A hand-written rank
 * table type-checks and is silently wrong about the order.
 *
 * **This is cosmetic**: it decides which tabs somebody is shown, so they are not
 * offered a screen that would 403. It is not permission — the daemon gates every
 * route with an extractor, and nothing here is trusted by anything there.
 */
export function allows(held: Role, needed: Role): boolean {
  return ROLE_LADDER.indexOf(held) >= ROLE_LADDER.indexOf(needed);
}

/** `allows` for the signed-in account or else the local caller; nobody is allowed nothing. */
export function useAllows(): (needed: Role) => boolean {
  const { me, local } = useSession();
  return (needed) => {
    const who = me() ?? local();
    return who !== undefined && allows(who.role, needed);
  };
}

/** The signed-in account where the host's own store holds it; a console's caller and a local one have none. */
export function useOwnAccount(): Accessor<User | undefined> {
  const { me } = useSession();
  return () => {
    const who = me();
    return who && isStoreAccount(who) ? who : undefined;
  };
}
