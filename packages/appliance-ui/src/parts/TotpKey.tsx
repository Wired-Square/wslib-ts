/**
 * A new TOTP key for an authenticator app, and the recovery codes that come
 * with turning it on. Both are shown once and held only by the component
 * showing them.
 */
import type { TotpEnrolment } from "@wired-square/appliance-types";
import { Button, Notice } from "@wired-square/kit";
import { For, Show } from "solid-js";
import { encode } from "uqr";

import { saveText } from "../api";

const qrPath = (modules: boolean[][]) =>
  modules
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")))
    .join("");

export function TotpKey(props: { enrolment: TotpEnrolment }) {
  const qr = () => encode(props.enrolment.uri, { ecc: "M", border: 4 });
  const grouped = () => props.enrolment.secret.match(/.{1,4}/g)?.join(" ") ?? "";
  return (
    <figure class="app-totp-key">
      <svg
        class="app-qr"
        viewBox={`0 0 ${qr().size} ${qr().size}`}
        role="img"
        aria-label="QR code of the key, for an authenticator app"
        shape-rendering="crispEdges"
      >
        <path d={qrPath(qr().data)} />
      </svg>
      <figcaption>
        <p>Scan it with an authenticator app, or type the key into one:</p>
        <p>
          <code class="app-secret">{grouped()}</code>
        </p>
        <Show when={props.enrolment.uri.startsWith("otpauth://")}>
          <p>
            <a href={props.enrolment.uri}>Open it in an authenticator app on this device</a>
          </p>
        </Show>
      </figcaption>
    </figure>
  );
}

export function RecoveryCodesShown(props: { codes: string[]; onDone: () => void }) {
  return (
    <>
      <Notice tone="warn">
        These recovery codes are shown once. Keep them apart from your authenticator: each signs in once in place of
        a code.
      </Notice>
      <ol class="app-recovery-codes">
        <For each={props.codes}>
          {(code) => (
            <li>
              <code>{code}</code>
            </li>
          )}
        </For>
      </ol>
      <div class="app-actions">
        <Button type="button" onClick={() => saveText("recovery-codes.txt", `${props.codes.join("\n")}\n`)}>
          Download
        </Button>
        <Button type="button" tone="primary" onClick={() => props.onDone()}>
          I have kept them
        </Button>
      </div>
    </>
  );
}
