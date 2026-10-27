/**
 * One certificate, rendered — the pieces the Outbound trust screen shows,
 * exported so a product showing a peer's certificate renders it the same way.
 * Two renderings of one shape drift.
 *
 * **Superseded by the box OS that runs products as containers: frozen, fixes
 * only, and removed in a later release, which its migration note will list.**
 */
import type { CertificateView } from "@wired-square/appliance-types";
import { day } from "@wired-square/kit";
import { Show } from "solid-js";

export function CertificateDetails(props: { certificate: CertificateView }) {
  return (
    <dl class="app-details">
      <dt>Subject</dt>
      <dd>{props.certificate.subject}</dd>

      <dt>Issued by</dt>
      <dd>
        {props.certificate.self_signed ? "itself (self-signed)" : props.certificate.issuer}
      </dd>

      <dt>Covers</dt>
      <dd>
        <Show when={props.certificate.sans.length} fallback={<em>no names</em>}>
          {props.certificate.sans.join(", ")}
        </Show>
      </dd>

      <dt>Key</dt>
      <dd>{props.certificate.key}</dd>

      <dt>Valid</dt>
      <dd>
        <Expiry certificate={props.certificate} />
      </dd>

      <dt>SHA-256</dt>
      <dd>
        <Fingerprint of={props.certificate.sha256} />
      </dd>
    </dl>
  );
}

/** The validity window. */
export function Expiry(props: { certificate: CertificateView }) {
  return (
    <>
      {day(props.certificate.not_before)} to {day(props.certificate.not_after)}
    </>
  );
}

/**
 * A fingerprint, in pairs.
 *
 * **Grouped because it is read aloud and compared by eye** against what a
 * browser's certificate viewer shows, which groups it the same way.
 */
export function Fingerprint(props: { of: string }) {
  const grouped = () => (props.of.match(/../g) ?? []).join(":");
  return <code class="app-fingerprint">{grouped()}</code>;
}
