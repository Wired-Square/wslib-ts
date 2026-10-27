/**
 * The tickboxes a restore offers for what a bundle holds, and the `Chosen`
 * they make: the signed-in restore's and the first-run restore's.
 *
 * Internal to the package but for `SectionRow`, which the screens' index exports.
 */
import type { Chosen, Contains, Inspection } from "@wired-square/appliance-types";
import { Notice, Tick } from "@wired-square/kit";
import { For, Show, createSignal } from "solid-js";

/** One of a product's own sections, as the take and restore forms should name it. */
export interface SectionRow {
  /** The section name the product's `Sections` puts it under. */
  name: string;
  label: string;
  hint?: string;
  /** Carried or not, rather than a count: a section that is all or nothing. */
  flag?: boolean;
  /**
   * A tick at take, cleared to leave the section out, when this answers yes; an
   * answer that fails is no, and a local session is never asked.
   */
  optional?: () => boolean | Promise<boolean>;
}

export type PlatformKey = Exclude<keyof Chosen, "app">;

interface PlatformRow {
  key: PlatformKey;
  label: string;
  hint: string;
  held: (c: Contains) => string | undefined;
  /** Cannot be changed from its `initial` value. */
  locked?: boolean;
}

const count = (n: number) => (n > 0 ? `${n} in the backup` : undefined);

const held = (row: SectionRow, n: number) => (row.flag ? (n > 0 ? "carried" : undefined) : count(n));

/** The standard rows, in the order the form shows them. */
export const PLATFORM: PlatformRow[] = [
  { key: "accounts", label: "Accounts", hint: "every password, sign-in included", held: (c) => count(c.accounts) },
  { key: "settings", label: "Settings", hint: "this box's saved settings", held: (c) => count(c.settings) },
  { key: "trusted_certs", label: "Pinned certificates", hint: "hosts trusted by fingerprint", held: (c) => count(c.trusted_certs) },
  { key: "trusted_cas", label: "Trusted authorities", hint: "authorities trusted for outbound connections", held: (c) => count(c.trusted_cas) },
  {
    key: "serving_certificate",
    label: "Serving certificate",
    hint: "untick for a second box built from this file",
    held: (c) => (c.serving_certificate ? "carried" : undefined),
  },
  {
    key: "ssh_keys",
    label: "Authorised SSH keys",
    hint: "the keys the box authorised when the file was taken, in place of this box's",
    held: (c) => (c.ssh_keys > 0 ? "carried" : undefined),
  },
  {
    key: "host",
    label: "Hostname",
    hint: "this box takes the name the file records; a fixed address it had is reported, not set",
    held: (c) => (c.host ? "carried" : undefined),
  },
];

/**
 * A tick per row `contains` holds, the product's own all on but those
 * `blocked` names, and what they ask for: a tick on a section the file does
 * not hold is not sent. A blocked section is off, cannot be ticked, and says why.
 */
export function chooseSections(props: {
  contains: () => Contains;
  rows: readonly PlatformRow[];
  initial: Record<PlatformKey, boolean>;
  sections: SectionRow[];
  blocked?: Inspection["blocked"];
}) {
  const contains = props.contains;
  const blocked = (name: string) => props.blocked?.[name];
  const [platform, setPlatform] = createSignal(props.initial);
  const [app, setApp] = createSignal<Record<string, boolean>>(
    Object.fromEntries(Object.keys(contains().app).map((name) => [name, !blocked(name)])),
  );

  /** The label a product gave a section, or the name it travels under. */
  const rowFor = (name: string) => props.sections.find((s) => s.name === name) ?? { name, label: name };

  const asked = (): Chosen => ({
    accounts: platform().accounts && contains().accounts > 0,
    settings: platform().settings && contains().settings > 0,
    trusted_certs: platform().trusted_certs && contains().trusted_certs > 0,
    trusted_cas: platform().trusted_cas && contains().trusted_cas > 0,
    serving_certificate: platform().serving_certificate && contains().serving_certificate,
    ssh_keys: platform().ssh_keys && contains().ssh_keys > 0,
    host: platform().host && contains().host,
    app: Object.keys(contains().app).filter((name) => app()[name]),
  });
  const anything = () => {
    const c = asked();
    return (
      c.accounts ||
      c.settings ||
      c.trusted_certs ||
      c.trusted_cas ||
      c.serving_certificate ||
      c.ssh_keys ||
      c.host ||
      c.app.length > 0
    );
  };

  const Ticks = () => (
    <>
      <For each={props.rows}>
        {(row) => (
          <Show when={row.held(contains())}>
            {(held) => (
              <Tick
                label={`${row.label} (${held()})`}
                hint={row.hint}
                checked={platform()[row.key]}
                disabled={row.locked ?? false}
                onChange={(on) => setPlatform({ ...platform(), [row.key]: on })}
              />
            )}
          </Show>
        )}
      </For>
      <For each={Object.entries(contains().app)}>
        {([name, n]) => (
          <Show when={held(rowFor(name), n ?? 0)}>
            {(carried) => (
              <>
                <Tick
                  label={`${rowFor(name).label} (${carried()})`}
                  hint={rowFor(name).hint}
                  checked={app()[name] ?? false}
                  disabled={blocked(name) !== undefined}
                  onChange={(on) => setApp({ ...app(), [name]: on })}
                />
                <Show when={blocked(name)}>{(why) => <Notice tone="warn">{why()}</Notice>}</Show>
              </>
            )}
          </Show>
        )}
      </For>
    </>
  );

  return { asked, anything, rowFor, Ticks };
}
