/**
 * Settings → Security: the signed-in account's own Passkeys, Password and 2FA,
 * as the views `passkeys`, `password` and `two-step`, for every role, which a
 * host routes through `Routed`. Mount it only where the product's own store
 * holds the account: not behind a console, not for the control socket.
 */
import { Views, routed } from "@wired-square/kit";
import type { Routed, View } from "@wired-square/kit";

import { PasswordSettings } from "./PasswordSettings";
import { PasskeySettings, TotpSettings } from "./SecondFactors";

export type SecurityView = "passkeys" | "password" | "two-step";

/** The three views, for `AccountSettings` to show beside its own `T` in one strip. */
export const securityViews = <T extends string = never>(): View<SecurityView | T>[] => [
  { id: "passkeys", label: "Passkeys", panel: () => <PasskeySettings /> },
  { id: "password", label: "Password", panel: () => <PasswordSettings /> },
  { id: "two-step", label: "2FA", panel: () => <TotpSettings /> },
];

export function SecuritySettings(props: Routed) {
  return <Views aria-label="Security" group="security" views={securityViews()} {...routed(props)} />;
}
