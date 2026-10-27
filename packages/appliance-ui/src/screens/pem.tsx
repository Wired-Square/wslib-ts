/**
 * A pasted certificate: the box, the file picker, the daemon's reading of the
 * paste as it lands, and the refusal of a file that is not PEM.
 *
 * **Superseded by the box OS that runs products as containers: frozen, fixes
 * only, and removed in a later release, which its migration note will list.**
 *
 * Internal to the package, like the kit's `action.ts`: the shape of the
 * Outbound trust screen's insides, not something a consumer builds on.
 */
import { MAX_PEM_LEN } from "@wired-square/appliance-types";
import type { CertificateReport } from "@wired-square/appliance-types";
import { Notice, PickFile, TextArea, Warnings, refusalMessage } from "@wired-square/kit";
import { Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { api } from "../api";
import { CertificateDetails } from "./certificate";

/** How long to wait after a keystroke before asking the daemon to read a paste. */
const INSPECT_AFTER_MS = 300;

/** What a whole certificate looks like, so a half-pasted one is not sent. */
const WHOLE_CERTIFICATE = /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;

/**
 * A certificate box with a file picker, and under it the daemon's reading of
 * what has been pasted, once it looks whole.
 *
 * The reading is debounced and gated on a complete block, so typing into the
 * box is not a request per keystroke — and so a half-pasted certificate does
 * not produce a refusal an operator has to read past while they are still
 * pasting. Once it is whole, the daemon's refusal is shown: it is the same
 * sentence the install would answer, and better read now.
 */
export function PastedCertificate(props: {
  label: string;
  hint: string;
  /** The route that reads a `{ cert_pem }` and answers a `CertificateReport`. */
  inspectAt: string;
  value: string;
  onValue: (pem: string) => void;
}) {
  const [preview, setPreview] = createSignal<CertificateReport | undefined>();
  const [problem, setProblem] = createSignal<string | undefined>();

  // Driven by the value rather than by the input events, so a parent emptying
  // the box after an install clears the reading with it. The effect's own
  // cleanup cancels a pending ask on the next change and on unmount; an answer
  // to an earlier paste is dropped by comparing it with what is in the box now.
  createEffect(
    on(
      () => props.value,
      (pem) => {
        setPreview(undefined);
        setProblem(undefined);
        if (!WHOLE_CERTIFICATE.test(pem)) return;

        const ask = setTimeout(() => {
          api<CertificateReport>(props.inspectAt, { method: "POST", body: { cert_pem: pem } })
            .then((read) => {
              if (pem === props.value) setPreview(read);
            })
            .catch((error: unknown) => {
              if (pem === props.value) setProblem(refusalMessage(error));
            });
        }, INSPECT_AFTER_MS);
        onCleanup(() => clearTimeout(ask));
      },
      { defer: true },
    ),
  );

  return (
    <>
      <TextArea
        label={props.label}
        hint={props.hint}
        value={props.value}
        onValue={props.onValue}
      />
      <div class="app-actions">
        <PickFile
          label="Choose certificate file"
          accept=".pem,.crt,application/x-pem-file"
          reject={unusableCertificateFile}
          onProblem={setProblem}
          onText={props.onValue}
        />
      </div>
      <Notice tone="bad">{problem()}</Notice>
      {/* What the daemon makes of the certificate, before anything is
          installed — the same reading the install itself will do. */}
      <Show when={preview()}>
        {(read) => (
          <>
            <CertificateDetails certificate={read().certificate} />
            <Warnings of={read().warnings} />
          </>
        )}
      </Show>
    </>
  );
}

/** Refuse a file by name or size, before it is read, with its conversion. */
const unusableCertificateFile = (file: File) => {
  if (/\.(pfx|p12)$/i.test(file.name)) {
    return `${file.name} is not PEM. Convert it first: openssl pkcs12 -in ${file.name} -nokeys -out certificate.pem`;
  }
  if (/\.der$/i.test(file.name)) {
    return `${file.name} is not PEM. Convert it first: openssl x509 -inform der -in ${file.name} -out certificate.pem`;
  }
  if (file.size > MAX_PEM_LEN) {
    return `${file.name} is larger than any certificate this appliance reads.`;
  }
  return undefined;
};
