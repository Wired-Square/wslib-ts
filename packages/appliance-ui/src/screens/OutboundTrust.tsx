/**
 * Outbound trust: what this appliance believes about the hosts it
 * connects to.
 *
 * **Superseded by the box OS that runs products as containers: frozen, fixes
 * only, and removed in a later release, which its migration note will list.**
 * So are its halves, `TrustedAuthorities` and `PinnedCertificates`.
 *
 * Two lists, additive to the operating system's own authorities. An
 * **authority** installed here vouches for every host it signed — the shape a
 * site with its own PKI wants, installed once the way a browser would. A
 * **pin** trusts one host for one certificate, by fingerprint — the shape for
 * equipment whose certificate nobody signed and nobody will reissue.
 *
 * A host is looked at first and pinned second, and the pin request is built
 * from what the dialog shows — the URL it looked at and the certificate it
 * saw — never re-read from the box.
 */
import type { CaCertificate, InspectPeer, Peer, PinPeer, TrustedCa, TrustedCert } from "@wired-square/appliance-types";
import {
  Badge,
  Button,
  Confirm,
  Field,
  Form,
  Loaded,
  NothingYet,
  Notice,
  Section,
  Table,
  Td,
  Th,
  Tr,
  count,
  day,
} from "@wired-square/kit";
import { For, Show, createResource, createSignal } from "solid-js";

import { api } from "../api";
import { CertificateDetails, Fingerprint } from "./certificate";
import { PastedCertificate } from "./pem";

export function OutboundTrust() {
  return (
    <>
      <TrustedAuthorities />
      <PinnedCertificates />
    </>
  );
}

const WARN_DAYS = 30;
const CA_LAPSE =
  "What it signed is still trusted after it expires, but its hosts will probably move to certificates from its successor, which this appliance refuses unless the successor is installed here, the operating system trusts it, or the host is pinned.";
const PIN_LAPSE =
  "An authority issued it, so the host will probably move to a renewed certificate around its expiry, and the pin refuses any certificate but its own.";
const PIN_UNCHECKED = "Its date is not checked: the pin is the whole check.";

/** Whole days until `notAfter`: zero or less once it has passed. */
function daysLeft(notAfter: string): number {
  return Math.ceil((new Date(notAfter).getTime() - Date.now()) / 86_400_000);
}

const nearing = (row: { not_after: string }) => daysLeft(row.not_after) <= WARN_DAYS;

// A device's self-signed certificate is seldom renewed, and often expired long ago.
const renewsOnSchedule = (pin: TrustedCert) => pin.subject !== pin.issuer;

function Expires(props: { at: string; warns: boolean; title: string }) {
  const left = () => daysLeft(props.at);
  return (
    <>
      {day(props.at)}{" "}
      <Show when={left() <= WARN_DAYS}>
        <Badge tone={props.warns ? "warn" : "neutral"} title={props.title}>
          {left() > 0 ? `in ${count(left(), "day")}` : "expired"}
        </Badge>
      </Show>
    </>
  );
}

/** Who added a row, and when. */
function AddedBy(props: { by: string; at: string }) {
  return (
    <>
      {props.by}
      <span class="app-table__note"> {day(props.at)}</span>
    </>
  );
}

/** The authorities installed beside the operating system's. */
export function TrustedAuthorities() {
  const [list, { mutate, refetch }] = createResource(() => api<TrustedCa[]>("/api/tls/cas"));
  const [pem, setPem] = createSignal("");
  const [removing, setRemoving] = createSignal<TrustedCa | undefined>();

  const install = async () => {
    const added = await api<TrustedCa>("/api/tls/cas", {
      method: "POST",
      body: { cert_pem: pem() } satisfies CaCertificate,
    });
    setPem("");
    // The same bytes install once; the daemon answers the row as it stands.
    mutate((rows) => [...(rows ?? []).filter((r) => r.sha256 !== added.sha256), added]);
  };

  const remove = async () => {
    const doomed = removing();
    if (!doomed) return;
    await api<null>(`/api/tls/cas/${doomed.sha256}`, { method: "DELETE" });
    mutate((rows) => rows?.filter((r) => r.sha256 !== doomed.sha256));
  };

  return (
    <>
      <Section
        title="Trusted authorities"
        blurb="Certificate authorities this appliance trusts for the connections it makes, beside the operating system's own. Install your site's authority once and every host it signed is trusted."
      >
        <Loaded of={list} refetch={refetch} reading="the trusted authorities">
          {(rows) => (
            <Show
              when={rows().length > 0}
              fallback={<NothingYet label="No authorities yet" />}
            >
              <Show when={rows().some(nearing)}>
                <Notice tone="warn">
                  An authority below has expired or expires within {WARN_DAYS} days.{" "}
                  {CA_LAPSE} Install its successor beside it as soon as there is one.
                </Notice>
              </Show>
              <Table
                head={
                  <>
                    <Th>Authority</Th>
                    <Th>Expires</Th>
                    <Th>SHA-256</Th>
                    <Th>Installed</Th>
                    <Th unseen>Actions</Th>
                  </>
                }
              >
                <For each={rows()}>
                  {(ca) => (
                    <Tr>
                      <Td>{ca.subject}</Td>
                      <Td>
                        <Expires at={ca.not_after} warns title={CA_LAPSE} />
                      </Td>
                      <Td>
                        <Fingerprint of={ca.sha256} />
                      </Td>
                      <Td>
                        <AddedBy by={ca.added_by} at={ca.added_at} />
                      </Td>
                      <Td controls>
                        <Button tone="plain" onClick={() => setRemoving(ca)}>
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  )}
                </For>
              </Table>
            </Show>
          )}
        </Loaded>
      </Section>

      <Section title="Install an authority" level={3}>
        <Form verb="Trust this authority" act={install} disabled={!pem()}>
          <PastedCertificate
            label="Authority's certificate"
            hint="Begins -----BEGIN CERTIFICATE-----. The authority that signed the hosts this appliance connects to, not a host's own certificate."
            inspectAt="/api/tls/cas/inspect"
            value={pem()}
            onValue={setPem}
          />
        </Form>
      </Section>

      <Show when={removing()}>
        {(doomed) => (
          <Confirm
            title="Stop trusting this authority?"
            verb="Stop trusting"
            act={remove}
            onClose={() => setRemoving(undefined)}
          >
            <p>
              Every host whose certificate <strong>{doomed().subject}</strong>{" "}
              signed will be refused from the next connection, unless it is
              pinned or the operating system trusts the authority too.
            </p>
          </Confirm>
        )}
      </Show>
    </>
  );
}

/** The hosts trusted for one certificate each. */
export function PinnedCertificates() {
  const [list, { mutate, refetch }] = createResource(() => api<TrustedCert[]>("/api/tls/pins"));
  const [url, setUrl] = createSignal("");
  // What was looked at and where, held together: see the module doc.
  const [confirming, setConfirming] = createSignal<{ url: string; peer: Peer } | undefined>();
  const [unpinning, setUnpinning] = createSignal<TrustedCert | undefined>();

  const inspect = async () => {
    const at = url().trim();
    const peer = await api<Peer>("/api/tls/pins/inspect", {
      method: "POST",
      body: { url: at } satisfies InspectPeer,
    });
    setConfirming({ url: at, peer });
  };

  const trust = async () => {
    const seen = confirming();
    if (!seen) return;
    const pinned = await api<TrustedCert>("/api/tls/pins", {
      method: "POST",
      body: { url: seen.url, expect_sha256: seen.peer.certificate.sha256 } satisfies PinPeer,
    });
    setUrl("");
    // One pin per host: a re-pin replaces the row.
    mutate((rows) => [...(rows ?? []).filter((r) => r.host !== pinned.host), pinned]);
  };

  const forget = async () => {
    const doomed = unpinning();
    if (!doomed) return;
    await api<null>(`/api/tls/pins/${encodeURIComponent(doomed.host)}`, { method: "DELETE" });
    mutate((rows) => rows?.filter((r) => r.host !== doomed.host));
  };

  return (
    <>
      <Section
        title="Pinned certificates"
        blurb="Hosts this appliance trusts for one certificate each, by fingerprint — for equipment whose certificate nobody signed. A host with no pin is verified against the authorities."
      >
        <Loaded of={list} refetch={refetch} reading="the pinned certificates">
          {(rows) => (
            <Show
              when={rows().length > 0}
              fallback={<NothingYet label="Nothing pinned yet" />}
            >
              <Show when={rows().some((pin) => renewsOnSchedule(pin) && nearing(pin))}>
                <Notice tone="warn">
                  A pinned certificate below has expired or expires within {WARN_DAYS} days.{" "}
                  {PIN_LAPSE} Once the host has moved, look at it under Pin a host and
                  trust the new one.
                </Notice>
              </Show>
              <Table
                head={
                  <>
                    <Th>Host</Th>
                    <Th>Subject</Th>
                    <Th>Expires</Th>
                    <Th>SHA-256</Th>
                    <Th>Trusted</Th>
                    <Th unseen>Actions</Th>
                  </>
                }
              >
                <For each={rows()}>
                  {(pin) => (
                    <Tr>
                      <Td strong>{pin.host}</Td>
                      <Td>{pin.subject}</Td>
                      <Td>
                        <Expires
                          at={pin.not_after}
                          warns={renewsOnSchedule(pin)}
                          title={renewsOnSchedule(pin) ? PIN_LAPSE : PIN_UNCHECKED}
                        />
                      </Td>
                      <Td>
                        <Fingerprint of={pin.sha256} />
                      </Td>
                      <Td>
                        <AddedBy by={pin.added_by} at={pin.added_at} />
                      </Td>
                      <Td controls>
                        <Button tone="plain" onClick={() => setUnpinning(pin)}>
                          Stop trusting
                        </Button>
                      </Td>
                    </Tr>
                  )}
                </For>
              </Table>
            </Show>
          )}
        </Loaded>
        {/* Stated because it reads as an oversight otherwise. */}
        <p class="app-muted">
          A pinned certificate's dates are never checked: the pin is the whole
          check, and the date is shown so somebody can see it.
        </p>
      </Section>

      <Section title="Pin a host" level={3}>
        <Form verb="Look at it" act={inspect} disabled={!url().trim()}>
          <Field
            label="Host to look at"
            hint="The https:// address this appliance connects to, or a bare host with its port if it is not 443 — an IPv6 address with a port goes in brackets. A .local name does not resolve from the daemon; use the address. The certificate it presents is shown before anything is trusted."
            value={url()}
            onValue={setUrl}
            placeholder="https://10.0.50.198"
            autocomplete="off"
            spellcheck={false}
          />
        </Form>
      </Section>

      <Show when={confirming()}>
        {(seen) => (
          <Confirm
            title={`Trust this certificate for ${seen().peer.host}?`}
            verb="Trust it"
            act={trust}
            onClose={() => setConfirming(undefined)}
          >
            <p>
              Compare the fingerprint with what the host's owner says it should
              be. This appliance will accept exactly this certificate from{" "}
              <strong>{seen().peer.host}</strong> and nothing else, until the pin
              is changed — its name and expiry will not be checked.
            </p>
            <Show when={!seen().peer.certificate.self_signed}>
              <Notice tone="warn">
                An authority issued this certificate, so it is probably renewed
                on a schedule, and a pin stops working at the next renewal. If
                the authority is your own, install it under Trusted authorities
                instead.
              </Notice>
            </Show>
            <CertificateDetails certificate={seen().peer.certificate} />
          </Confirm>
        )}
      </Show>

      <Show when={unpinning()}>
        {(doomed) => (
          <Confirm
            title={`Stop trusting ${doomed().host}?`}
            verb="Stop trusting"
            act={forget}
            onClose={() => setUnpinning(undefined)}
          >
            <p>
              Its certificate will be verified against the authorities from the
              next connection, and refused if none signed it.
            </p>
            <Fingerprint of={doomed().sha256} />
          </Confirm>
        )}
      </Show>
    </>
  );
}
