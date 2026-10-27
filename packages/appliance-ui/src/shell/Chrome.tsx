/**
 * The furniture around a signed-in product: the masthead, the navigation the
 * product supplies, and the main column.
 *
 * Mounted by the product, not by `Shell`, so it can sit inside a router's root
 * — a router's links need that context, and this package ships no router. It
 * shows who is signed in, and nothing for a local caller. Only an account the
 * host signs in itself has account controls: the console owns a console
 * account's sign-out and password. On a narrow screen those fold into a menu
 * under the username; the product's `controls` show for every caller and stay
 * in the bar. A tab strip in `nav` scrolls in one row with its selection kept
 * in view.
 */
import { Button, Dialog, IconButton, Menu, MenuItem, Notice, createAction } from "@wired-square/kit";
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";

import { api } from "../api";
import { ROLE_LABELS, RoleBadge } from "../parts/RoleBadge";
import { Brand, Hostname } from "./Shell";
import { isStoreAccount, useSession } from "./session";

export interface ChromeProps {
  /**
   * The product's navigation: a `Tabs`, or a `<nav class="app-tablist">` of a
   * router's links carrying `class="app-tab"` and `data-label` with their
   * text; `aria-current="page"` gets the selected look, and `data-label` keeps
   * it from widening them.
   */
  nav?: JSX.Element;

  /** The product's own masthead controls, before the account's: a `SchemePicker`, say. */
  controls?: JSX.Element;

  /** The change-password dialog's content, handed what closes it; without it there is no "Change password…". */
  changePassword?: (close: () => void) => JSX.Element;

  children: JSX.Element;
}

const SELECTED_TAB = '.app-tablist :is([aria-selected="true"], [aria-current="page"])';

type Span = Pick<DOMRect, "left" | "right">;

/** How far `inner` sticks out past `outer`'s left edge (negative) or its right (positive). */
export const overhang = (inner: Span, outer: Span): number =>
  inner.left < outer.left ? inner.left - outer.left : Math.max(0, inner.right - outer.right);

export function Chrome(props: ChromeProps) {
  const { me, refresh } = useSession();
  const [changingPassword, setChangingPassword] = createSignal(false);
  const signingOut = createAction();
  const close = () => setChangingPassword(false);
  const signOut = () => void signingOut.run(() => api<null>("/api/session", { method: "DELETE" }), refresh);

  let nav!: HTMLDivElement;
  onMount(() => {
    const showSelected = () => {
      const tab = nav.querySelector<HTMLElement>(SELECTED_TAB);
      const strip = tab?.closest<HTMLElement>(".app-tablist");
      if (tab && strip) strip.scrollLeft += overhang(tab.getBoundingClientRect(), strip.getBoundingClientRect());
    };
    showSelected();
    const watching = new MutationObserver(showSelected);
    watching.observe(nav, { subtree: true, childList: true, attributeFilter: ["aria-selected", "aria-current"] });
    onCleanup(() => watching.disconnect());
  });

  return (
    <>
      <header class="app-masthead">
        <div class="app-masthead__bar">
          <Brand class="app-masthead__brand" />
          <Hostname />
          {props.controls}
          <Show when={me()}>
            {(who) => {
              const named = () => (
                <>
                  {who().username} <RoleBadge role={who().role} />
                </>
              );
              return (
                <Show when={isStoreAccount(who())} fallback={<span class="app-muted">{named()}</span>}>
                  <div class="app-masthead__account">
                    <span class="app-muted">{named()}</span>
                    <Show when={props.changePassword}>
                      <IconButton
                        label="Change password…"
                        aria-haspopup="dialog"
                        onClick={() => setChangingPassword(true)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="8" cy="15" r="4" />
                          <path d="m10.8 12.2 9.2-9.2m-3 3 3 3m-6 0 2 2" />
                        </svg>
                      </IconButton>
                    </Show>
                    <Button pending={signingOut.pending()} onClick={signOut}>
                      Sign out
                    </Button>
                  </div>
                  <div class="app-masthead__account-menu">
                    <Menu
                      aria-label={`${who().username}, ${ROLE_LABELS[who().role]}, account`}
                      pending={signingOut.pending()}
                      trigger={named()}
                    >
                      <Show when={props.changePassword}>
                        <MenuItem onSelect={() => setChangingPassword(true)}>Change password…</MenuItem>
                      </Show>
                      <MenuItem onSelect={signOut}>Sign out</MenuItem>
                    </Menu>
                  </div>
                </Show>
              );
            }}
          </Show>
        </div>
        <div ref={nav} class="app-masthead__nav">{props.nav}</div>
      </header>
      <main class="app-main">
        <Notice tone="bad">{signingOut.failed()}</Notice>
        {props.children}
      </main>

      <Show when={changingPassword() && props.changePassword}>
        {(form) => (
          <Dialog aria-label="Change password" onClose={close}>
            {form()(close)}
          </Dialog>
        )}
      </Show>
    </>
  );
}
