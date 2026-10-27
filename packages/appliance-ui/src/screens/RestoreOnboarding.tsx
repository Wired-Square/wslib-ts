/**
 * "…or restore a backup", beside the first-account form.
 *
 * A replacement card has no accounts, and the person setting it up may be
 * holding the old card's bundle. `POST /api/onboarding/restore` puts the
 * sections ticked onto the box — a tick for each the bundle's header lists, all
 * on to start, because a fresh box has nothing worth keeping — and the daemon
 * gates it on the box still being unclaimed, so the write succeeds once. The
 * accounts cannot be unticked: they are what claims the box. The bundle's own
 * administrator signs in afterwards, so `onDone` is where the shell asks again
 * whether the first-account screen is still needed.
 *
 * The daemon opens the file under a lower KDF ceiling than a signed-in restore
 * gets, and says so in words when a bundle is priced above it; rendering that
 * message is the whole handling. A host puts it in `FirstAccount`'s `actions`.
 */
import type { RestoreReport, RestoreUnclaimed } from "@wired-square/appliance-types";
import { Button, Field, Form, Notice, Section, Warnings } from "@wired-square/kit";
import { Show, createSignal } from "solid-js";

import { api, slowAnswer } from "../api";
import { BundlePicker, Provenance } from "../parts/BundlePicker";
import type { ChosenBundle } from "../parts/BundlePicker";
import { PLATFORM, chooseSections } from "./sections";
import type { PlatformKey, SectionRow } from "./sections";

const ROWS = PLATFORM.map((row) =>
  row.key === "accounts" ? { ...row, hint: "they claim this box, so they cannot be left out", locked: true } : row,
);

const ALL_ON = Object.fromEntries(PLATFORM.map((row) => [row.key, true])) as Record<PlatformKey, boolean>;

export function RestoreOnboarding(props: { sections?: SectionRow[]; onDone: () => void }) {
  const [chosen, setChosen] = createSignal<ChosenBundle | undefined>();
  return (
    <Section
      title="…or restore a backup"
      blurb="The sections you tick become this box's. Sign in afterwards with a password from the backup."
      level={3}
    >
      <BundlePicker onChosen={setChosen} />
      <Show when={chosen()} keyed>
        {(file) => <Unclaimed file={file} sections={props.sections ?? []} onDone={props.onDone} />}
      </Show>
    </Section>
  );
}

/**
 * The form for one chosen file, mounted per file so its ticks are that file's.
 * Exported for the kit's tests, not from the package.
 */
export function Unclaimed(props: { file: ChosenBundle; sections: SectionRow[]; onDone: () => void }) {
  const [passphrase, setPassphrase] = createSignal("");
  const [report, setReport] = createSignal<RestoreReport | undefined>();
  const { asked, Ticks } = chooseSections({
    contains: () => props.file.header.contains,
    rows: ROWS,
    initial: ALL_ON,
    sections: props.sections,
  });

  return (
    <>
      <Provenance header={props.file.header} />
      <Show
        when={report()}
        fallback={
          <Form
            verb="Restore"
            act={async () => {
              setReport(
                await api<RestoreReport>("/api/onboarding/restore", {
                  method: "POST",
                  body: {
                    passphrase: passphrase(),
                    bundle: props.file.text,
                    sections: asked(),
                  } satisfies RestoreUnclaimed,
                  signal: slowAnswer(),
                }),
              );
              setPassphrase("");
            }}
          >
            <Ticks />
            <Field
              label="Passphrase"
              type="password"
              autocomplete="off"
              required
              value={passphrase()}
              onValue={setPassphrase}
            />
          </Form>
        }
      >
        {/* What was not applied — a pair this box could not take, say —
            is read here, before the shell moves on to sign-in. */}
        {(done) => (
          <>
            <Notice tone="good">Restored. Sign in with an account from the backup.</Notice>
            <Warnings of={done().warnings} />
            <div class="app-actions">
              <Button tone="primary" onClick={() => props.onDone()}>
                Sign in
              </Button>
            </div>
          </>
        )}
      </Show>
    </>
  );
}
