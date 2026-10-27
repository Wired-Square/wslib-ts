/**
 * What a screen says about second factors that it cannot fix itself: two
 * clocks apart, a page where a passkey cannot run, the names passkeys were
 * made on, and what a restore does to them. A console mounts these beside its
 * own screens.
 */
import type { Availability, ClockSkew, PasskeyHost } from "@wired-square/appliance-types";
import { Notice } from "@wired-square/kit";
import { Show, createResource } from "solid-js";

import { ApiError, api } from "../api";
import { passkeysUnusable } from "./webauthn";

/** The skew a refused code carried, if it was refused for one. */
export const clockSkewOf = (error: unknown): ClockSkew | undefined =>
  error instanceof ApiError ? error.clockSkew : undefined;

const A_YEAR_OF_MINUTES = 366 * 24 * 60;

export function ClockSkewNotice(props: { skew: ClockSkew | undefined }) {
  const said = (skew: ClockSkew) => {
    const n = Math.abs(skew.minutes);
    if (n > A_YEAR_OF_MINUTES) return "This device's clock and this box's are far apart";
    const way = skew.minutes > 0 ? "ahead of" : "behind";
    return `This box's clock is ${n} minute${n === 1 ? "" : "s"} ${way} this device's`;
  };
  return (
    <Notice tone="warn">
      {props.skew &&
        `${said(props.skew)}, so codes from the authenticator app will not match. Set the right time on whichever is wrong; on the box, check its time sync.`}
    </Notice>
  );
}

/**
 * Whether a passkey can run on this page, as the browser and the box say:
 * `here` is the name one binds to, `because` why none can run. Internal.
 */
export function createPasskeyAvailability() {
  const [availability] = createResource(() =>
    api<Availability>("/api/session/passkey/availability").catch(() => undefined),
  );
  const browser = passkeysUnusable();
  return {
    answered: () => availability.state === "ready",
    here: () => {
      const known = availability();
      return known?.state === "ready" ? known.via : undefined;
    },
    because: () => {
      const known = availability();
      return browser ?? (known?.state === "unsupported" ? known.because : undefined);
    },
  };
}

/** Why a passkey cannot be used on this page, from the browser or the box. */
export function PasskeyUnavailable(props: { because: string }) {
  return <p class="app-muted">Passkeys can't be used here: {props.because}.</p>;
}

/**
 * The names passkeys were made on, when any is other than `here`: each signs
 * in only at its own.
 */
export function PasskeyHosts(props: { hosts: string[]; here?: string | undefined }) {
  const elsewhere = () => props.hosts.some((host) => host !== props.here);
  return (
    <Show when={elsewhere()}>
      <p class="app-muted">
        Passkeys here were made on {props.hosts.join(", ")}, and each signs in only at the name it was made on
        {props.here ? `; this page is ${props.here}` : ""}.
      </p>
    </Show>
  );
}

/**
 * For a screen that renames the box: the names its passkeys were made on stop
 * working under `to`, so each person adds one again there. Given `lost`, it
 * warns about that one name alone, with how many of the caller's own passkeys
 * were made on it.
 */
export function PasskeyRenameWarning(props: { to?: string; lost?: string }) {
  const [hosts] = createResource(() => api<string[]>("/api/session/passkey/hosts").catch(() => []));
  const [own] = createResource(
    () => props.lost,
    (lost) =>
      api<PasskeyHost[]>("/api/session/passkeys/hosts").then(
        (mine) => mine.find((host) => host.host === lost)?.passkeys ?? 0,
        () => 0,
      ),
  );
  const gone = () => (hosts() ?? []).filter((host) => (props.lost ? host === props.lost : host !== props.to));
  const yours = () => (own() ? `, ${own()} of them yours,` : "");
  const after = () => (props.lost ? "no longer reached by it" : "reached by another");
  return (
    <Notice tone="warn">
      {gone().length > 0 &&
        `Passkeys made on ${gone().join(", ")}${yours()} sign in only at that name. Once the box is ${after()}, each person signs in with their password and adds a passkey again.`}
    </Notice>
  );
}

/** What restoring a backup's accounts does to everybody's second factors. */
export function RestoredFactorsNote() {
  return (
    <p class="app-muted">
      The accounts' TOTP keys, recovery codes and passkeys come back as the file holds them: one removed since it
      was taken returns, and a file from before version 0.11 holds none, so everybody's are removed. A passkey made
      under another name than this box's signs in only there.
    </p>
  );
}
