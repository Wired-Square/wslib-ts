/**
 * Choose a bundle file, and read what it says about itself before asking for a
 * passphrase.
 *
 * The plaintext header is what lets an operator holding four files tell them
 * apart without trying passphrases, and it is the half easiest to skip. Reading
 * it here also means a file that is not a bundle at all is refused without a
 * round trip. It discloses shape and never names — counts, a source hostname and
 * an opaque box id — so nothing shown is anything the file was not already
 * prepared to publish.
 *
 * Shared by the Backup screen and the first-run restore, which is the reason it
 * is a component: two copies of a file reader are two places for the size cap to
 * be spelled differently.
 */
import { MAX_BUNDLE_LEN } from "@wired-square/appliance-types";
import type { BundleHeader, Contains } from "@wired-square/appliance-types";
import { Notice, PickFile, when } from "@wired-square/kit";
import { Show, createSignal } from "solid-js";

/** A bundle the operator chose, with the header the screen reads off it. */
export interface ChosenBundle {
  text: string;
  header: BundleHeader;
}

export interface BundlePickerProps {
  /** The file read, or `undefined` once a choice is dropped or refused. */
  onChosen: (chosen: ChosenBundle | undefined) => void;
}

export function BundlePicker(props: BundlePickerProps) {
  const [rejected, setRejected] = createSignal<string | undefined>();

  /** Read what the file says about itself, or say why it is not a backup. */
  const read = (text: string) => {
    props.onChosen(undefined);
    setRejected(undefined);
    try {
      // A read rather than a decryption: the header is plaintext by design,
      // under the envelope's `header` key beside the sealed body. A file that
      // is not JSON, or is JSON and not a bundle, is refused here with a
      // message about the file rather than about the request.
      const envelope = JSON.parse(text) as { header?: Partial<BundleHeader> };
      const parsed = envelope.header;
      if (typeof parsed?.format !== "string" || typeof parsed.source_host !== "string") {
        setRejected("That file is not a backup.");
        return;
      }
      // The header's fields, picked off rather than kept whole: `envelope` is
      // the *entire* bundle, ciphertext included, so holding it would pin a
      // second copy of a file that may be eight mebibytes for as long as the
      // screen is mounted. `contains` is a hint every field of which the daemon
      // defaults, so a file from an older build is filled in the same way here.
      const { format, version, created_at, source_host, app_version, app_schema_version } =
        parsed as BundleHeader;
      const hint = (parsed.contains ?? {}) as Partial<Contains>;
      const contains: Contains = {
        accounts: hint.accounts ?? 0,
        settings: hint.settings ?? 0,
        trusted_certs: hint.trusted_certs ?? 0,
        trusted_cas: hint.trusted_cas ?? 0,
        serving_certificate: hint.serving_certificate ?? false,
        ssh_keys: hint.ssh_keys ?? 0,
        host: hint.host ?? false,
        app: hint.app ?? {},
      };
      props.onChosen({
        text,
        header: {
          format,
          version,
          created_at,
          source_host,
          box_id: typeof parsed.box_id === "string" ? parsed.box_id : null,
          app_version,
          app_schema_version,
          contains,
        },
      });
    } catch {
      setRejected("That file is not a backup.");
    }
  };

  return (
    <>
      <div class="app-actions">
        <PickFile
          label="Choose backup file"
          accept="application/json,.json"
          // Refused on size **before** it is read, against the one number the
          // whole workspace shares: the parser's ceiling, the daemon's body
          // limit and this are `MAX_BUNDLE_LEN`. Three spellings is how
          // the transport ceiling and the parse ceiling come apart and the
          // smaller one starts refusing files the larger one advertises.
          reject={(file) =>
            file.size > MAX_BUNDLE_LEN
              ? `A backup may be at most ${MAX_BUNDLE_LEN} bytes, and this is ${file.size}.`
              : undefined
          }
          // A refused or unreadable file also drops the one chosen before it:
          // otherwise the red notice sits beside a restore form that is still
          // live for the previous file.
          onProblem={(why) => {
            props.onChosen(undefined);
            setRejected(why);
          }}
          onText={read}
        />
      </div>
      <Notice tone="bad">{rejected()}</Notice>
    </>
  );
}

export interface ProvenanceProps {
  header: BundleHeader;
  /**
   * This box's id, passed only once the daemon has verified `header`: a file
   * whose `box_id` matches was taken here and its certificate raises no warning.
   */
  boxId?: string | null | undefined;
  /** A session with no accounts, which never restores the certificate. */
  local?: boolean;
  /** With `local`, behind a console, where the box is still "this box". */
  console?: boolean;
}

/**
 * What a chosen bundle says about itself, and the one section that changes what
 * the box is. A file with no `box_id` is never this box's.
 */
export function Provenance(props: ProvenanceProps) {
  const thisBox = () => props.header.box_id != null && props.header.box_id === props.boxId;
  return (
    <>
      <Notice tone="neutral">
        From <strong>{props.header.source_host}</strong>
        {thisBox() ? (props.local && !props.console ? " (this computer)" : " (this box)") : ""}, taken{" "}
        {when(props.header.created_at)} by {props.header.app_version}.
      </Notice>
      {/* The one section whose presence changes what the box *is* rather than
          what it holds: restoring it gives this appliance the other one's
          identity, which is right for a replacement card and wrong for a second
          box built from the same file. */}
      <Show when={props.header.contains.serving_certificate && !thisBox() && !props.local}>
        <Notice tone="warn">
          This backup carries the serving certificate of the box it was taken
          on. Restoring that section makes this appliance present it — right for
          a replacement card, wrong for a second box that will run beside the
          first.
        </Notice>
      </Show>
    </>
  );
}
