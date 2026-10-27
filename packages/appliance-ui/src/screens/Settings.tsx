/**
 * Settings: a strip of sections, the standard sections and the product's in one
 * alphabetical order, each offered by role and the store-held ones only where
 * the host's own store holds the account. The standard ones are About (not behind a
 * console), Users (store-held), Backup and Certificates (CA and Pinning;
 * `certificates={false}` drops it). Behind a console Backup says it is the
 * product's only backup.
 *
 * Router-free, as `Routed`: the host passes the `section` and `view` it routes
 * by and a `navigate` taking `section` or `section/view`. A section not offered
 * goes, replacing the history entry, where `moved` sends it if that is offered,
 * or else to the first section offered, and shows it before the navigation
 * lands.
 */
import type { Role } from "@wired-square/appliance-types";
import { Notice, TabPanel, Tabs, Views, routed } from "@wired-square/kit";
import type { Routed } from "@wired-square/kit";
import { For, Show, createEffect, createMemo } from "solid-js";
import type { JSX } from "solid-js";

import { useAllows, useOwnAccount } from "../access";
import { useSession } from "../shell/session";
import { About } from "./About";
import { AccountSettings } from "./AccountSettings";
import { BackupSettings } from "./BackupSettings";
import { PinnedCertificates, TrustedAuthorities } from "./OutboundTrust";
import type { SectionRow } from "./sections";

export interface SettingsSection {
  id: string;
  label: string;
  /** The rung it is offered from. */
  role: Role;
  /** Offered only where the host's own store holds the signed-in account. */
  storeHeld?: boolean;
  panel: (route: Routed) => JSX.Element;
}

export interface SettingsProps {
  section: string | undefined;
  view: string | undefined;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  /** The product's own sections, sorted among the standard sections by `label`; an id repeating a standard one throws, Certificates' only where it is kept. */
  sections?: readonly SettingsSection[];
  /** Where a section that moved now is, `section` or `section/view`, given the view it was asked with. */
  moved?: Readonly<Record<string, (view: string | undefined) => string>>;
  /** `BackupSettings`' `sections`. */
  backupSections?: SectionRow[];
  /** The product named behind a console; the branding's name by default. */
  appName?: string;
  certificates?: boolean;
}

const byLabel = (a: SettingsSection, b: SettingsSection) => a.label.localeCompare(b.label);

export function Settings(props: SettingsProps) {
  const { me, local, branding, refresh } = useSession();
  const allows = useAllows();
  const account = useOwnAccount();
  const behindConsole = () => me() !== null && !account();

  const standard: SettingsSection[] = [
    { id: "about", label: "About", role: "admin", panel: () => <About /> },
    {
      id: "backup",
      label: "Backup",
      role: "admin",
      panel: (route) => (
        <>
          <Show when={behindConsole()}>
            <Notice tone="warn">
              The console does not back up {props.appName ?? branding()?.app_name ?? "this application"}'s data, so
              this is its only backup. Take one and keep it off the box.
            </Notice>
          </Show>
          <BackupSettings sections={props.backupSections ?? []} onRestored={refresh} {...route} />
        </>
      ),
    },
    {
      id: "certificates",
      label: "Certificates",
      role: "admin",
      panel: (route) => (
        <Views
          aria-label="Certificates"
          group="certificates"
          views={[
            { id: "ca", label: "CA", panel: () => <TrustedAuthorities /> },
            { id: "pinning", label: "Pinning", panel: () => <PinnedCertificates /> },
          ]}
          {...routed(route)}
        />
      ),
    },
    {
      id: "users",
      label: "Users",
      role: "viewer",
      storeHeld: true,
      panel: (route) => <Show when={account()}>{(who) => <AccountSettings me={who()} {...route} />}</Show>,
    },
  ];

  // `[]` is what a first run that throws leaves, so its readers fail no further and the boundary shows why.
  const offered = createMemo<SettingsSection[]>(() => {
    const kept = standard.filter((s) => s.id !== "certificates" || props.certificates !== false);
    const own = props.sections ?? [];
    const repeated = own.find((s) => kept.some((c) => c.id === s.id));
    if (repeated) throw new Error(`Settings: the product's section "${repeated.id}" repeats a standard one`);
    const shown = kept.filter((s) => s.id !== "about" || !behindConsole());
    return [...shown, ...own].filter((s) => (!s.storeHeld || account()) && allows(s.role)).sort(byLabel);
  }, []);
  const offers = (id: string | undefined) => offered().find((s) => s.id === id)?.id;
  const known = () => offers(props.section);
  const movedTo = (section: string | undefined) => {
    const to =
      section !== undefined && props.moved && Object.hasOwn(props.moved, section)
        ? props.moved[section]?.(props.view)
        : undefined;
    return to && offers(to.split("/")[0]) ? to : undefined;
  };

  const redirect = () => (known() ? undefined : (movedTo(props.section) ?? offered()[0]?.id));
  createEffect(() => {
    const to = redirect();
    if (to) props.navigate(to, { replace: true });
  });

  const shown = createMemo(() => {
    const to = redirect();
    if (!to) return { section: known(), view: props.view };
    const [section, view] = to.split("/");
    return { section, view };
  });

  const route: Routed = {
    get view() {
      return shown().view;
    },
    onView: (view) => props.navigate(`${shown().section}/${view}`),
  };

  return (
    <Show
      when={shown().section}
      fallback={
        <Show when={offered().length === 0 && (me() !== null || local() !== undefined)}>
          <Notice tone="neutral">There are no settings this account can change here.</Notice>
        </Show>
      }
    >
      {(selected) => (
        <>
          <Tabs
            aria-label="Settings sections"
            group="settings"
            tabs={offered()}
            selected={selected()}
            onChange={(id) => props.navigate(id)}
          />
          <For each={offered()}>
            {(section) => (
              <TabPanel group="settings" id={section.id} selected={selected()}>
                {section.panel(route)}
              </TabPanel>
            )}
          </For>
        </>
      )}
    </Show>
  );
}
