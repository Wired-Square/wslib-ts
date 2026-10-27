/**
 * Who is signed in, and what the appliance calls itself — read by every screen
 * through `useSession`, provided by `Shell` or `SessionProvider`.
 */
import type { BrandingView, Caller, LocalIdentity, ResetReport, User } from "@wired-square/appliance-types";
import { createComponent, createContext, useContext } from "solid-js";
import type { JSX } from "solid-js";

/**
 * Who is signed in: an account the host signs in itself, or one the console
 * asserts. `isStoreAccount` tells them apart.
 */
export type Me = Exclude<Caller, LocalIdentity>;

/** Whether `who` is an account the host's own store holds, rather than one a console asserts. */
export function isStoreAccount(who: Me): who is User {
  return "enabled" in who;
}

export interface Session {
  /**
   * What the appliance calls itself; `undefined` until it answers, and if it
   * will not. Branding is decoration, so a failed fetch leaves the page up.
   */
  branding: () => BrandingView | undefined;

  /**
   * Who is signed in; `null` when nobody is. The last answer, kept while the
   * daemon is away: a screen never sees it vanish mid-outage.
   */
  me: () => Me | null;

  /**
   * A control endpoint's caller, who has no account, so `me` is `null`;
   * `undefined` for every other session, and until a late caller arrives.
   */
  local: () => LocalIdentity | undefined;

  /**
   * Ask again who is signed in and whether the box has an account: after a
   * sign-in, a sign-out, a restore, a factory reset.
   */
  refresh: () => void;
}

export const SessionContext = createContext<Session>();

/**
 * Provide a session the product builds itself, for a client with no `Shell`:
 * one over a control endpoint, which has neither sign-in nor onboarding.
 */
export function SessionProvider(props: { value: Session; children: JSX.Element }): JSX.Element {
  return createComponent(SessionContext.Provider, {
    get value() {
      return props.value;
    },
    get children() {
      return props.children;
    },
  });
}

/**
 * The session `Shell` or a `SessionProvider` provides. Throws outside both,
 * which is a bug, not a state.
 */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession() outside a Shell or SessionProvider");
  return session;
}

export type Parting = (report: ResetReport, onRead: () => void) => void;

/** `Shell`'s side of `useParting`; a product reads it only through that. */
export const PartingContext = createContext<Parting>();

/**
 * Hands `Shell` a factory reset's report to show in place of the product;
 * Continue calls `onRead`, and the report then stays until the session answers
 * that nobody is signed in. `undefined` outside a `Shell`, where the screen
 * shows the report itself.
 */
export function useParting(): Parting | undefined {
  return useContext(PartingContext);
}
