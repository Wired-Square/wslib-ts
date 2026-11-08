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
 * in view. Where the origin lists apps the caller may open, the brand is a menu
 * of them, asked again on each open.
 */
import { Button, Dialog, IconButton, Menu, MenuItem, Notice, createAction } from "@wired-square/kit";
import type { AppLink } from "@wired-square/appliance-types";
import { For, Show, children, createSignal, onCleanup, onMount, useContext } from "solid-js";
import type { JSX } from "solid-js";

import { api, fetchWithSession, fromBase } from "../api";
import { ROLE_LABELS, RoleBadge } from "../parts/RoleBadge";
import { AppName, Brand, Hostname, WordmarkContext } from "./Shell";
import type { Wordmark } from "./Shell";
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

  /** Draws the app's name in the masthead in place of plain text; `Shell`'s, unless given. */
  wordmark?: Wordmark;

  /** The change-password dialog's content, handed what closes it; without it there is no "Change password…". */
  changePassword?: (close: () => void) => JSX.Element;

  children: JSX.Element;
}

const SELECTED_TAB = '.app-tablist :is([aria-selected="true"], [aria-current="page"])';

type Span = Pick<DOMRect, "left" | "right">;

/** How far `inner` sticks out past `outer`'s left edge (negative) or its right (positive). */
export const overhang = (inner: Span, outer: Span): number =>
  inner.left < outer.left ? inner.left - outer.left : Math.max(0, inner.right - outer.right);

// At the origin root, not the app's base, and not through `api`: a 401 here
// only hides the switcher, and must not sign the caller out.
async function switcherLinks(): Promise<AppLink[]> {
  try {
    const response = await fetchWithSession(new URL("/api/switcher", location.origin), { credentials: "same-origin" });
    const links: unknown = response.ok ? await response.json() : [];
    return Array.isArray(links) ? links : [];
  } catch {
    return [];
  }
}

// A router may render an app's root without the trailing slash its href has.
const longestPrefixOf = (path: string, links: AppLink[]): AppLink | undefined =>
  links.filter((link) => `${path.replace(/\/$/, "")}/`.startsWith(link.href)).sort((a, b) => b.href.length - a.href.length)[0];

// The same objects for unchanged links, so a refetch while the menu is open
// keeps its items, and the focus the menu put on the first.
const keepingUnchanged = (was: AppLink[], now: AppLink[]) =>
  now.map((link) => was.find((old) => old.href === link.href && old.name === link.name) ?? link);

function BrandSwitcher() {
  const { branding } = useSession();
  const [links, setLinks] = createSignal<AppLink[]>([]);
  const refresh = () => void switcherLinks().then((now) => setLinks((was) => keepingUnchanged(was, now)));
  onMount(refresh);
  const current = () => longestPrefixOf(location.pathname, links());
  // The menu builds its items on each open, so this asks again then.
  const Items = () => {
    onMount(refresh);
    return (
      <For each={links()}>
        {(link) => (
          <MenuItem current={link === current()} onSelect={() => link !== current() && location.assign(link.href)}>
            <img
              class="app-switcher__icon"
              src={`${link.href}api/branding/logo`}
              alt=""
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
            {link.name}
          </MenuItem>
        )}
      </For>
    );
  };
  return (
    <Show when={links().length > 0} fallback={<Brand class="app-masthead__brand" />}>
      <div class="app-masthead__brand app-switcher">
        <Menu
          aria-label={[branding()?.app_name, branding()?.manufacturer, "switch app"].filter(Boolean).join(", ")}
          chevron
          trigger={
            <>
              <img src={fromBase("/api/branding/logo")} alt="" onError={(e) => (e.currentTarget.hidden = true)} />
              <span class="app-switcher__words">
                <span class="app-switcher__name">
                  <AppName />
                </span>
                <Show when={branding()?.manufacturer}>{(who) => <span class="app-muted">{who()}</span>}</Show>
              </span>
            </>
          }
        >
          <Items />
        </Menu>
      </div>
    </Show>
  );
}

export function Chrome(props: ChromeProps) {
  const { me, refresh } = useSession();
  const inherited = useContext(WordmarkContext);
  const [changingPassword, setChangingPassword] = createSignal(false);
  const signingOut = createAction();
  const close = () => setChangingPassword(false);
  const controls = children(() => props.controls);
  // With no controls the hostname joins the tools, so the account never has a row to itself.
  const bare = () => controls.toArray().length === 0;
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
          <WordmarkContext.Provider value={(name) => (props.wordmark ? props.wordmark(name) : inherited(name))}>
            <BrandSwitcher />
          </WordmarkContext.Provider>
          <Show when={!bare()}>
            <Hostname />
          </Show>
          <div class="app-masthead__tools">
            <Show when={bare()}>
              <Hostname />
            </Show>
            {controls()}
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
                        chevron
                        trigger={<span class="app-masthead__username">{who().username}</span>}
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
