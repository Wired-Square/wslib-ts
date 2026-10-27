/**
 * A passkey ceremony in the browser: the daemon's options, whose byte strings
 * are unpadded base64url, handed to `navigator.credentials`, and the credential
 * that comes back written in the JSON the daemon reads. Nothing here keeps a
 * credential: each is sent once and dropped.
 */
import type {
  AssertionCredential,
  CreationOptions,
  CredentialDescriptor,
  RegistrationCredential,
  RequestOptions,
} from "@wired-square/appliance-types";
import { Refusal } from "@wired-square/kit/core";

import { api } from "../api";

export function base64url(bytes: ArrayBuffer | ArrayBufferView): string {
  const view =
    bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text: string): ArrayBuffer {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Why this page cannot use a passkey, or `undefined` when it can. */
export function passkeysUnusable(): string | undefined {
  if (globalThis.isSecureContext === false) {
    return "passkeys need this page opened over HTTPS, by the box's name, with a certificate this browser trusts";
  }
  if (typeof globalThis.PublicKeyCredential !== "function" || !globalThis.navigator?.credentials) {
    return "this browser does not offer passkeys";
  }
  return undefined;
}

const REFUSED_BY_BROWSER: Record<string, string> = {
  NotAllowedError: "no passkey was used: it was cancelled, it timed out, or none on this device is for this box",
  InvalidStateError: "this device already holds a passkey for this account",
  SecurityError: "the browser refused a passkey at this address: open the box by its name, with a certificate it trusts",
  AbortError: "the passkey request was cancelled",
};

async function ceremony(run: () => Promise<Credential | null>): Promise<PublicKeyCredential> {
  const unusable = passkeysUnusable();
  if (unusable) throw new Refusal(unusable);
  let credential: Credential | null;
  try {
    credential = await run();
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    const known = typeof name === "string" && Object.hasOwn(REFUSED_BY_BROWSER, name);
    throw new Refusal(known ? REFUSED_BY_BROWSER[name]! : "the browser did not finish the passkey request");
  }
  if (!credential) throw new Refusal(REFUSED_BY_BROWSER.NotAllowedError!);
  return credential as PublicKeyCredential;
}

const descriptor = (d: CredentialDescriptor): PublicKeyCredentialDescriptor => ({
  type: d.type as PublicKeyCredentialType,
  id: fromBase64url(d.id),
});

/** Make a passkey from `navigator.credentials.create()`. */
export async function makePasskey(options: CreationOptions): Promise<RegistrationCredential> {
  const selection = options.authenticatorSelection;
  const credential = await ceremony(() =>
    navigator.credentials.create({
      publicKey: {
        challenge: fromBase64url(options.challenge),
        rp: options.rp,
        user: { id: fromBase64url(options.user.id), name: options.user.name, displayName: options.user.displayName },
        pubKeyCredParams: options.pubKeyCredParams.map((p) => ({ type: p.type as PublicKeyCredentialType, alg: p.alg })),
        timeout: options.timeout,
        excludeCredentials: options.excludeCredentials.map(descriptor),
        authenticatorSelection: {
          residentKey: selection.residentKey as ResidentKeyRequirement,
          requireResidentKey: selection.requireResidentKey,
          userVerification: selection.userVerification as UserVerificationRequirement,
        },
        attestation: options.attestation as AttestationConveyancePreference,
      },
    }),
  );
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: base64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: base64url(response.clientDataJSON),
      attestationObject: base64url(response.attestationObject),
    },
  };
}

/** The signed-in account's passkey answering a fresh reauthentication challenge. */
export async function reauthenticationPasskey(): Promise<AssertionCredential> {
  return answerPasskey(await api<RequestOptions>("/api/session/reauthentication/options", { method: "POST" }));
}

/** A passkey's answer to `options` from `navigator.credentials.get()`. */
export async function answerPasskey(options: RequestOptions): Promise<AssertionCredential> {
  const credential = await ceremony(() =>
    navigator.credentials.get({
      publicKey: {
        challenge: fromBase64url(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        allowCredentials: options.allowCredentials.map(descriptor),
        userVerification: options.userVerification as UserVerificationRequirement,
      },
    }),
  );
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: base64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: base64url(response.clientDataJSON),
      authenticatorData: base64url(response.authenticatorData),
      signature: base64url(response.signature),
      ...(response.userHandle?.byteLength ? { userHandle: base64url(response.userHandle) } : {}),
    },
  };
}
