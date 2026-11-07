/**
 * Backup: take one, restore one, and the schedule that takes them unattended,
 * as the views Take, Restore and Schedule, which a host routes through `Routed`.
 *
 * The backend serves the routes, the file and the schedule, and this screen
 * holds the tickbox rows for the standard sections; a product contributes a
 * row per section of its own through `sections`, matched by name to what the
 * bundle's header says it carries. A section the file does not hold is not offered, and one
 * whose `optional` answers yes can be left out of a take.
 *
 * # A restore is read before it is applied
 *
 * `BundlePicker` reads the plaintext header in the browser; **Check** then asks
 * the daemon to open the file, which proves the passphrase and returns what this
 * build would say about the rows, before anybody is asked to agree to something
 * destructive. The tickboxes appear only then, a section the product says
 * cannot be restored now unticked beside its reason.
 *
 * # Restoring the accounts signs you out, and the screen says so first
 *
 * `replace_accounts` stamps a fresh session cutoff and deletes every session on
 * the way in, so a restore that carries accounts ends the one that asked for it
 * too.
 * A screen that did not warn would look broken: the request succeeds, and the
 * next thing the operator touches is a 401. Leaving accounts unticked is what
 * keeps the session, and the warning follows the tickbox.
 *
 * # A take, a restore and a schedule passphrase ask for proof again
 *
 * An appliance session gives `FactorProofField`'s: while its TOTP is on, a
 * code, a recovery code or a passkey, never the password alone.
 *
 * # A local session is offered the application half, and asked no password
 *
 * A backend with no accounts authorises by who connected, so there is no
 * password to ask again, and it restores only the outbound trust and the
 * product's own sections whatever else the file carries. The screen offers
 * that much and no more, rather than tickboxes the daemon would ignore, and
 * takes every section.
 *
 * # Behind a console, Take and Restore of the application half
 *
 * A caller the console asserts is offered what a local session is, less the
 * schedule. The console proves the password, so a take or restore refused for a
 * stale proof says to re-authenticate in the console rather than asking here.
 */
import {
  MAX_EVERY_HOURS,
  MAX_KEEP,
  MIN_EVERY_HOURS,
  MIN_KEEP,
  MIN_PASSPHRASE_LEN,
  STALE_PROOF,
} from "@wired-square/appliance-types";
import type {
  AboutView,
  BackupFile,
  BackupSchedule,
  Chosen,
  FactorProof,
  Inspection,
  OpenBundle,
  RestoreBundle,
  RestoreReport,
  ScheduleUpdate,
  ScheduleView,
  TakeBackup,
} from "@wired-square/appliance-types";
import {
  Button,
  Confirm,
  Field,
  Form,
  Loaded,
  NothingYet,
  Notice,
  Refusal,
  Section,
  Table,
  Td,
  Th,
  Tick,
  Tr,
  Views,
  Warnings,
  createAction,
  routed,
  size,
  when,
} from "@wired-square/kit";
import type { Routed } from "@wired-square/kit";
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";

import { ApiError, api, download, slowAnswer } from "../api";
import { BundlePicker, Provenance } from "../parts/BundlePicker";
import type { ChosenBundle } from "../parts/BundlePicker";
import { FactorProofField, createFactorProof } from "../parts/FactorProof";
import { RestoredFactorsNote } from "../parts/factorNotes";
import { isStoreAccount, useSession } from "../shell/session";
import { PLATFORM, chooseSections } from "./sections";
import type { PlatformKey, SectionRow } from "./sections";

/** The standard rows a session offered the application half restores. */
const APPLICATION_HALF: readonly PlatformKey[] = ["trusted_certs", "trusted_cas"];

const offered = (applicationHalf: boolean, key: PlatformKey) =>
  !applicationHalf || APPLICATION_HALF.includes(key);

/**
 * The requests, apart from the form so the kit's tests can read them: a
 * session offered the application half sends no proof and leaves nothing
 * out, and a row it is not offered starts unticked.
 */
export const takeBody = (
  applicationHalf: boolean,
  passphrase: string,
  proof: FactorProof,
  leaveOut: string[] = [],
): TakeBackup =>
  applicationHalf
    ? { passphrase }
    : { passphrase, ...proof, ...(leaveOut.length > 0 ? { leave_out: leaveOut } : {}) };

/** The rows a take offers to leave out, in their order. */
const leavable = async (rows: SectionRow[]) => {
  const said = await Promise.all(
    rows.map(async (row) => {
      try {
        return (await row.optional?.()) ?? false;
      } catch {
        return false;
      }
    }),
  );
  return rows.filter((_, at) => said[at]);
};

export const restoreBody = (
  applicationHalf: boolean,
  open: OpenBundle,
  sections: Chosen,
  proof: FactorProof,
): RestoreBundle => ({ ...open, sections, ...(applicationHalf ? {} : proof) });

/** Whether a schedule edit asks for proof: only one that sets a passphrase, and never a local session's. */
const scheduleAsks = (applicationHalf: boolean, passphrase: string) => passphrase !== "" && !applicationHalf;

/** Blank leaves the stored passphrase alone, and asks no proof. */
export const scheduleBody = (
  applicationHalf: boolean,
  schedule: BackupSchedule,
  passphrase: string,
  proof: FactorProof,
): ScheduleUpdate => ({
  schedule,
  passphrase: passphrase === "" ? null : passphrase,
  ...(scheduleAsks(applicationHalf, passphrase) ? proof : {}),
});

export const initialPlatform = (applicationHalf: boolean) =>
  Object.fromEntries(PLATFORM.map((row) => [row.key, offered(applicationHalf, row.key)])) as Record<PlatformKey, boolean>;

/** Where the files and the configuration are, in the words each kind of session reads. */
interface Here {
  /** Offered the application half alone, and asked no password. */
  applicationHalf: boolean;
  /** Behind a console, which proves the password. */
  console: boolean;
  /** "the box", or "this computer". */
  box: string;
  /** What does or does not run the schedule. */
  runner: string;
}

const sentence = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

const APPLIANCE: Here = { applicationHalf: false, console: false, box: "the box", runner: "this appliance" };
const LOCAL: Here = { applicationHalf: true, console: false, box: "this computer", runner: "this service" };
const CONSOLE: Here = { ...LOCAL, console: true };

/** Where this session is; tracked, since a local caller can arrive after mount. */
function where(): () => Here {
  const { local, me } = useSession();
  return () => {
    if (local()) return LOCAL;
    const who = me();
    return who && !isStoreAccount(who) ? CONSOLE : APPLIANCE;
  };
}

/** `ask`, its refusal for a stale proof saying where to renew one behind a console. */
async function provedBy<T>(here: Here, ask: () => Promise<T>): Promise<T> {
  try {
    return await ask();
  } catch (e) {
    if (here.console && e instanceof ApiError && e.status === 403 && e.message.startsWith(STALE_PROOF)) {
      throw new Refusal(`${e.message}. Re-authenticate in the console, then try again.`);
    }
    throw e;
  }
}

export function BackupSettings(props: Routed & { sections?: SectionRow[]; onRestored?: () => void }) {
  const here = where();
  const sections = () => props.sections ?? [];
  const take = { id: "take", label: "Take", panel: () => <Take sections={sections()} /> };
  const restore = {
    id: "restore",
    label: "Restore",
    panel: () => <Restore sections={sections()} onRestored={props.onRestored} />,
  };
  const schedule = { id: "schedule", label: "Schedule", panel: () => <Schedule /> };
  return (
    <Views
      aria-label="Backup"
      group="backup"
      views={here().console ? [take, restore] : [take, restore, schedule]}
      {...routed(props)}
    />
  );
}

function Take(props: { sections: SectionRow[] }) {
  const here = where();
  const [passphrase, setPassphrase] = createSignal("");
  const proof = createFactorProof(undefined, () => !here().applicationHalf);
  const [optional] = createResource(() => !here().applicationHalf && props.sections, leavable);
  const [leftOut, setLeftOut] = createSignal<string[]>([]);
  return (
    <Section
      title="Take a backup"
      blurb={`${
        here().applicationHalf
          ? "The application's own data and the certificates it trusts, sealed into one file."
          : "Everything this box is, sealed into one file."
      } Keep the passphrase: there is no way to open the file without it.`}
    >
      <Form
        verb="Take a backup"
        done="Downloaded."
        disabled={!here().applicationHalf && !proof.ready()}
        act={async () => {
          const proved = here().applicationHalf ? {} : await proof.take();
          // `download` rather than `api`: the answer is a file, and the kit's
          // refusal path carries the daemon's sentence to the operator.
          await provedBy(here(), () =>
            download("/api/backup", "appliance-backup.json", {
              method: "POST",
              body: takeBody(here().applicationHalf, passphrase(), proved, leftOut()),
            }),
          );
          setPassphrase("");
          proof.clear();
        }}
      >
        <Field
          label="Passphrase"
          type="password"
          data-1p-ignore
          autocomplete="new-password"
          required
          minLength={MIN_PASSPHRASE_LEN}
          hint={`At least ${MIN_PASSPHRASE_LEN} characters. It is ground offline by anyone holding the file, so it is longer than a password.`}
          value={passphrase()}
          onValue={setPassphrase}
        />
        <Show when={!here().applicationHalf}>
          <For each={optional()}>
            {(row) => (
              <p>
                <Tick
                  label={row.label}
                  hint={row.hint}
                  checked={!leftOut().includes(row.name)}
                  onChange={(on) =>
                    setLeftOut(on ? leftOut().filter((name) => name !== row.name) : [...leftOut(), row.name])
                  }
                />
              </p>
            )}
          </For>
          <FactorProofField of={proof} />
        </Show>
      </Form>
    </Section>
  );
}

function Restore(props: { sections: SectionRow[]; onRestored?: (() => void) | undefined }) {
  const here = where();
  const [file, setFile] = createSignal<ChosenBundle | undefined>();
  const [passphrase, setPassphrase] = createSignal("");
  const [seen, setSeen] = createSignal<Inspection | undefined>();
  // Its own id, so its own file is not called another box's once Check has
  // verified the header; a daemon that will not say is `undefined` here rather
  // than a thrown resource.
  const [about] = createResource(() => api<AboutView>("/api/about").catch(() => undefined));

  return (
    <Section
      title="Restore from a backup"
      blurb="Replaces the sections you choose with the file's; the rest stay as they are."
    >
      <BundlePicker
        onChosen={(chosen) => {
          setFile(chosen);
          setSeen(undefined);
        }}
      />

      <Show when={file()}>
        {(chosen) => (
          <>
            <Provenance
              header={seen()?.header ?? chosen().header}
              boxId={seen() ? about()?.box_id : undefined}
              local={here().applicationHalf}
              console={here().console}
            />
            <Show
              when={seen()}
              fallback={
                <Form
                  verb="Check"
                  act={async () => {
                    const picked = chosen();
                    const inspection = await api<Inspection>("/api/backup/inspect", {
                      method: "POST",
                      body: { passphrase: passphrase(), bundle: picked.text } satisfies OpenBundle,
                      signal: slowAnswer(),
                    });
                    // Another file chosen meanwhile must not inherit this one's header.
                    if (file() === picked) setSeen(inspection);
                  }}
                >
                  <Field
                    label="Passphrase"
                    type="password"
                    data-1p-ignore
                    autocomplete="off"
                    required
                    hint="Opens the file to show what it holds, before anything is changed."
                    value={passphrase()}
                    onValue={setPassphrase}
                  />
                </Form>
              }
            >
              {(inspection) => (
                <Show when={here()} keyed>
                  <Inspected
                    chosen={chosen()}
                    inspection={inspection()}
                    passphrase={passphrase()}
                    sections={props.sections}
                    onRestored={props.onRestored}
                  />
                </Show>
              )}
            </Show>
          </>
        )}
      </Show>
    </Section>
  );
}

/**
 * The half of the restore form that exists once the daemon has opened the file:
 * the tickboxes for what it holds, the proof, and the outcome. Mounted per
 * inspection and per kind of session, so a new file or a late local caller
 * starts it afresh. Exported for the kit's tests, not from the package.
 */
export function Inspected(props: {
  chosen: ChosenBundle;
  inspection: Inspection;
  passphrase: string;
  sections: SectionRow[];
  onRestored?: (() => void) | undefined;
}) {
  const here = where();
  const proof = createFactorProof(undefined, () => !here().applicationHalf);
  const [report, setReport] = createSignal<RestoreReport | undefined>();
  // Everything offered on, until somebody unticks: a restore is "put the box
  // back" first and "just the pins" second.
  const { asked, anything, rowFor, Ticks } = chooseSections({
    contains: () => props.inspection.header.contains,
    rows: PLATFORM.filter((row) => offered(here().applicationHalf, row.key)),
    initial: initialPlatform(here().applicationHalf),
    sections: props.sections,
    blocked: props.inspection.blocked,
    items: props.inspection.items,
  });

  return (
    <>
      <Warnings of={props.inspection.warnings} />

      <Ticks />

      <Show when={asked().accounts}>
        <Notice tone="warn">
          Restoring the accounts signs everybody out, including you — they become
          the file's, not this box's. You will have to sign in again with a
          password from the backup.
        </Notice>
        <RestoredFactorsNote />
      </Show>

      <Show
        when={report()}
        fallback={
          <Form
            verb="Restore"
            disabled={!anything() || (!here().applicationHalf && !proof.ready())}
            act={async () => {
              const proved = here().applicationHalf ? {} : await proof.take();
              const done = await provedBy(here(), () =>
                api<RestoreReport>("/api/backup/restore", {
                  method: "POST",
                  body: restoreBody(
                    here().applicationHalf,
                    { passphrase: props.passphrase, bundle: props.chosen.text },
                    asked(),
                    proved,
                  ),
                  signal: slowAnswer(),
                }),
              );
              proof.clear();
              setReport(done);
            }}
          >
            <Show when={!here().applicationHalf}>
              <FactorProofField of={proof} />
            </Show>
          </Form>
        }
      >
        {(done) => (
          <>
            <Outcome report={done()} shown={props.inspection.warnings} rowFor={rowFor} />
            {/* The outcome is read before the shell moves on: a restore that
                carried the accounts has ended this session, and `onRestored`
                is what lets the shell find that out — after the warnings
                have been seen, not instead of them. */}
            <Show when={done().signed_out && props.onRestored}>
              {(onRestored) => (
                <div class="app-actions">
                  <Button tone="primary" onClick={() => onRestored()()}>
                    Sign in again
                  </Button>
                </div>
              )}
            </Show>
          </>
        )}
      </Show>
    </>
  );
}

/**
 * What a restore did, as sentences, less the warnings Check already showed above it.
 * Exported for the kit's tests, not from the package.
 */
export function Outcome(props: { report: RestoreReport; shown: string[]; rowFor: (name: string) => SectionRow }) {
  const applied = () => {
    const a = props.report.applied;
    return [
      ...PLATFORM.filter((row) => a[row.key]).map((row) => row.label.toLowerCase()),
      ...a.app.map((name) => props.rowFor(name).label.toLowerCase()),
    ];
  };
  return (
    <>
      <Notice tone="good">
        Restored {applied().join(", ") || "nothing"}.
        <Show when={props.report.signed_out}> You have been signed out; sign in again with a password from the backup.</Show>
      </Notice>
      <Show when={props.report.applied.accounts}>
        <RestoredFactorsNote />
      </Show>
      <Warnings of={props.report.warnings.filter((w) => !props.shown.includes(w))} />
    </>
  );
}

function Schedule() {
  const here = where();
  const [view, { refetch, mutate }] = createResource(() => api<ScheduleView>("/api/backup/schedule"));
  const [typed, setTyped] = createSignal<Partial<BackupSchedule>>({});
  const [passphrase, setPassphrase] = createSignal("");
  const proof = createFactorProof(undefined, () => !here().applicationHalf);
  const asks = () => scheduleAsks(here().applicationHalf, passphrase());
  const [forgetting, setForgetting] = createSignal(false);
  const [removing, setRemoving] = createSignal<BackupFile>();
  const fetching = createAction();

  const wanted = (from: ScheduleView): BackupSchedule => ({
    ...from.schedule,
    enabled: from.schedule.enabled && from.runs,
    ...typed(),
  });

  /** Every write answers the view, and the form takes it: nothing to go and ask for. */
  const settle = (saved: ScheduleView) => {
    mutate(saved);
    setTyped({});
    setPassphrase("");
    proof.clear();
  };

  /**
   * `mutate` rather than `settle`: a half-typed schedule survives a deletion.
   * A 404 is a file rotation took first, which is the outcome asked for.
   */
  const remove = async () => {
    const doomed = removing();
    if (!doomed) return;
    try {
      mutate(
        await api<ScheduleView>(`/api/backup/files/${encodeURIComponent(doomed.name)}`, {
          method: "DELETE",
        }),
      );
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
      await refetch();
    }
  };

  return (
    <Section
      title="Scheduled backups"
      blurb={`Written on ${here().box} on an interval and kept in rotation, sealed with a passphrase of their own.`}
      actions={
        <Button tone="plain" onClick={() => void refetch()}>
          Refresh
        </Button>
      }
    >
      <Loaded of={view} refetch={refetch} reading="the schedule">
        {(current) => (
          <>
            <Switch>
              <Match when={!current().runs && current().schedule.enabled}>
                <Notice tone="warn">
                  The schedule is stored as on, but {here().runner} does not run it: no backups are
                  being taken. Saving switches it off.
                </Notice>
              </Match>
              <Match when={!current().runs}>
                <Notice tone="neutral">
                  {sentence(here().runner)} does not run the schedule, so it cannot be switched on.
                </Notice>
              </Match>
            </Switch>
            <Form
              verb="Save schedule"
              done="Saved."
              disabled={asks() && !proof.ready()}
              act={async () => {
                const proved = asks() ? await proof.take() : {};
                settle(
                  await api<ScheduleView>("/api/backup/schedule", {
                    method: "PUT",
                    body: scheduleBody(here().applicationHalf, wanted(current()), passphrase(), proved),
                  }),
                );
              }}
              actions={
                <Show when={current().passphrase_set}>
                  <Button tone="danger" onClick={() => setForgetting(true)}>
                    Forget the passphrase…
                  </Button>
                </Show>
              }
            >
              <p>
                <Tick
                  label="Take backups on a schedule"
                  checked={wanted(current()).enabled}
                  disabled={!current().runs}
                  onChange={(enabled) => setTyped({ ...typed(), enabled })}
                />
              </p>
              <Field
                label="Every (hours)"
                type="number"
                min={MIN_EVERY_HOURS}
                max={MAX_EVERY_HOURS}
                value={wanted(current()).every_hours}
                onInput={(e) => setTyped({ ...typed(), every_hours: e.currentTarget.valueAsNumber })}
                hint={`Between ${MIN_EVERY_HOURS} and ${MAX_EVERY_HOURS}. An interval, not a time of day${
                  here().applicationHalf ? "." : ": a box with no clock cannot keep an appointment."
                }`}
              />
              <Field
                label="Keep"
                type="number"
                min={MIN_KEEP}
                max={MAX_KEEP}
                value={wanted(current()).keep}
                onInput={(e) => setTyped({ ...typed(), keep: e.currentTarget.valueAsNumber })}
                hint={`How many to keep on ${here().box}, ${MIN_KEEP} to ${MAX_KEEP}. The oldest goes when a new one lands.`}
              />
              <Field
                label={current().passphrase_set ? "New passphrase" : "Passphrase"}
                type="password"
                data-1p-ignore
                autocomplete="new-password"
                minLength={MIN_PASSPHRASE_LEN}
                value={passphrase()}
                onValue={setPassphrase}
                hint={
                  current().passphrase_set
                    ? "One is set. Leave this blank to keep it, or type a new one; every file written from then on opens with the new one."
                    : `Needed before the schedule can be switched on. At least ${MIN_PASSPHRASE_LEN} characters, and not one you use for manual backups.`
                }
              />
              {/* Whoever sets the passphrase can open every file the schedule
                  writes from then on, so it costs what a take costs. */}
              <Show when={asks()}>
                <FactorProofField of={proof} />
              </Show>
            </Form>

            <Show when={forgetting()}>
              <Confirm
                title="Forget the stored passphrase?"
                verb="Forget"
                act={async () =>
                  settle(await api<ScheduleView>("/api/backup/schedule/passphrase", { method: "DELETE" }))
                }
                onClose={() => setForgetting(false)}
              >
                <p>
                  Scheduled backups switch off, and cannot be switched on again until
                  a new passphrase is set. The files already on {here().box} stay, and
                  still open with the passphrase they were sealed under.
                </p>
              </Confirm>
            </Show>

            <Show when={current().state.last_run_at}>
              {(at) => (
                <Notice tone={current().state.error ? "bad" : "neutral"}>
                  Last run {when(at())}
                  <Show when={current().state.file}>{(file) => <>: wrote {file()}</>}</Show>
                  <Show when={current().state.error}>{(why) => <>: {why()}</>}</Show>
                </Notice>
              )}
            </Show>

            <Notice tone="bad">{fetching.failed()}</Notice>
            <Show when={current().files.length > 0} fallback={<NothingYet label={`No backups on ${here().box} yet`} />}>
              <Table
                head={
                  <>
                    <Th>File</Th>
                    <Th>Taken</Th>
                    <Th right>Size</Th>
                    <Th unseen>Actions</Th>
                  </>
                }
              >
                <For each={current().files}>
                  {(file) => (
                    <FileRow
                      file={file}
                      pending={fetching.pending()}
                      onDownload={() =>
                        void fetching.run(() =>
                          download(`/api/backup/files/${encodeURIComponent(file.name)}`, file.name),
                        )
                      }
                      onDelete={() => setRemoving(file)}
                    />
                  )}
                </For>
              </Table>
            </Show>

            <Show when={removing()}>
              {(doomed) => (
                <Confirm
                  title="Delete this backup?"
                  verb="Delete"
                  act={remove}
                  onClose={() => setRemoving(undefined)}
                >
                  <p>
                    <strong>{doomed().name}</strong>, taken {when(doomed().taken_at)}, is removed
                    from {here().box}. A copy already downloaded still opens.
                  </p>
                </Confirm>
              )}
            </Show>
          </>
        )}
      </Loaded>
    </Section>
  );
}

function FileRow(props: { file: BackupFile; pending: boolean; onDownload: () => void; onDelete: () => void }) {
  return (
    <Tr>
      <Td>
        <Button tone="link" pending={props.pending} onClick={props.onDownload}>
          {props.file.name}
        </Button>
      </Td>
      <Td numeric>{when(props.file.taken_at)}</Td>
      <Td right numeric>
        {size(props.file.bytes)}
      </Td>
      <Td controls>
        <Button tone="plain" onClick={props.onDelete}>
          Delete
        </Button>
      </Td>
    </Tr>
  );
}
