/**
 * "…or restore a backup", beside the first-account form.
 *
 * A replacement card has no accounts, and the person setting it up may be
 * holding the old card's bundle. **Check** sends it to
 * `POST /api/onboarding/inspect`, which proves the passphrase and says what the
 * restore would refuse, writing nothing; the ticks appear only then, all on,
 * because a fresh box has nothing worth keeping. `POST /api/onboarding/restore`
 * puts the sections ticked onto the box, gated on the box still being
 * unclaimed, so the write succeeds once. The accounts cannot be unticked: they
 * are what claims the box. The bundle's own administrator signs in afterwards,
 * so `onDone` is where the shell asks again whether the first-account screen is
 * still needed.
 *
 * The daemon opens the file under a lower KDF ceiling than a signed-in restore
 * gets, and says so in words when a bundle is priced above it; rendering that
 * message is the whole handling. A host puts it in `FirstAccount`'s `actions`.
 */
import type { Inspection, OpenBundle, RestoreReport, RestoreUnclaimed } from "@wired-square/appliance-types";
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
 * The form for one chosen file, mounted per file so a new file starts afresh.
 * Exported for the kit's tests, not from the package.
 */
export function Unclaimed(props: { file: ChosenBundle; sections: SectionRow[]; onDone: () => void }) {
  const [passphrase, setPassphrase] = createSignal("");
  const [seen, setSeen] = createSignal<Inspection | undefined>();

  return (
    <>
      <Provenance header={seen()?.header ?? props.file.header} />
      <Show
        when={seen()}
        fallback={
          <Form
            verb="Check"
            act={async () => {
              setSeen(
                await api<Inspection>("/api/onboarding/inspect", {
                  method: "POST",
                  body: { passphrase: passphrase(), bundle: props.file.text } satisfies OpenBundle,
                  signal: slowAnswer(),
                }),
              );
            }}
          >
            <Field
              label="Passphrase"
              type="password"
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
          <Opened
            file={props.file}
            inspection={inspection()}
            passphrase={passphrase()}
            sections={props.sections}
            onRestored={() => setPassphrase("")}
            onDone={props.onDone}
          />
        )}
      </Show>
    </>
  );
}

/**
 * The ticks and the restore once the daemon has opened the file.
 * Exported for the kit's tests, not from the package.
 */
export function Opened(props: {
  file: ChosenBundle;
  inspection: Inspection;
  passphrase: string;
  sections: SectionRow[];
  onRestored: () => void;
  onDone: () => void;
}) {
  const [report, setReport] = createSignal<RestoreReport | undefined>();
  const { asked, Ticks } = chooseSections({
    contains: () => props.inspection.header.contains,
    rows: ROWS,
    initial: ALL_ON,
    sections: props.sections,
    blocked: props.inspection.blocked,
    items: props.inspection.items,
  });

  return (
    <>
      <Warnings of={props.inspection.warnings} />
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
                    passphrase: props.passphrase,
                    bundle: props.file.text,
                    sections: asked(),
                  } satisfies RestoreUnclaimed,
                  signal: slowAnswer(),
                }),
              );
              props.onRestored();
            }}
          >
            <Ticks />
          </Form>
        }
      >
        {/* What was not applied — a pair this box could not take, say —
            is read here, before the shell moves on to sign-in. */}
        {(done) => (
          <>
            <Notice tone="good">Restored. Sign in with an account from the backup.</Notice>
            <Warnings of={done().warnings.filter((w) => !props.inspection.warnings.includes(w))} />
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
