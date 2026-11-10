/**
 * The Settings screens every appliance shares.
 *
 * **Components, not routes.** This package ships no router, URL layout or tab bar:
 * a product has its own navigation and its own idea of where Settings lives. What
 * surrounds the navigation — the session, sign-in, the masthead — is the shell's,
 * in `../shell`.
 *
 * So a product writes, with whatever router it already has:
 *
 *     <Route path="/settings/about" component={About} />
 *     <Route path="/settings/users" component={() => <AccountSettings me={me()} />} />
 *
 * **That is `@solidjs/router`'s spelling and this package does not depend on it** —
 * nothing here imports a router, and a `peerDependency` would have npm install one
 * for every consumer to match a snippet. `solid-js`, the kit and appliance-types
 * are peers because two copies are two reactive graphs or two type homes, and
 * `vite` because `./vite` imports `mergeConfig`.
 *
 * **`Settings` is those screens as one**, sections a product routes by and adds
 * its own to, for a product that takes them whole.
 *
 * **Each screen calls its own endpoint**, since they are the only caller of those
 * routes. `AccountSettings` is the exception and takes who is signed in, `me`, as a
 * prop: it needs to know which row is yours, and the product already holds it
 * from `useSession()` to decide what navigation to show.
 *
 * **`FirstAccount` is the one screen shown before there is a session**, for a
 * host that signs its own accounts in: it passes it to `Shell` as
 * `firstAccount`, which shows it while `GET /api/onboarding` says `needed`.
 *
 * **`OutboundTrust`** is the authorities and pins the appliance's own
 * connections are verified against, on its own screen, so a product that never
 * dials out need not show it; its two halves are `TrustedAuthorities` and
 * `PinnedCertificates` for a product that shows them as separate views. A
 * product showing a peer's certificate renders it the way `OutboundTrust`
 * does, so `CertificateDetails`, `Expiry` and `Fingerprint` are exported
 * beside it.
 *
 * **`BackupSettings` is the shell and a product fills in its rows.** The backend
 * serves the take, the restore, the schedule and the files; a product passes
 * `sections` — a label per section its own `Sections` puts in a bundle,
 * whether it is carried rather than counted (`flag`), and whether a take may
 * leave it out — and the screen offers each the file carries. Behind a console
 * it is Take and Restore alone, over the backup routes a console proxies to
 * the app.
 * `RestoreOnboarding` takes the same `sections` and goes in `FirstAccount`'s
 * `actions`.
 *
 * **`SecuritySettings`** is the signed-in account's own Passkeys, Password and
 * 2FA, which `AccountSettings` already shows beside Accounts; mount it alone for
 * a product that keeps Accounts elsewhere, and `PasskeySettings`,
 * `PasswordSettings` and `TotpSettings` alone for one that keeps no views.
 *
 * **`RestoreOnboarding`, and `AccountSettings` given `apps`, call routes a
 * single product's backend does not serve**, for a host that serves them.
 * **`Logs`** administers nothing and is reached while something is already
 * wrong; a product puts it where somebody looking for trouble will find it,
 * alone or beside `AuditLog` as `LogViews`.
 * **`About`** is what the installation is — the build, the host, the product's
 * own rows — so a product ships no About of its own.
 *
 * **`OutboundTrust` with its halves, `CertificateDetails`, `Expiry`,
 * `Fingerprint` and `About` are superseded by the box OS that runs products as
 * containers: frozen, fixes only, and removed in a later release, which its
 * migration note will list.**
 */
export { About } from "./About";
export { AccountSettings, accountView } from "./AccountSettings";
export { AuditLog } from "./AuditLog";
export { Logs } from "./Logs";
export { LogViews } from "./LogViews";
export { BackupSettings } from "./BackupSettings";
export type { SectionRow } from "./sections";
export { CertificateDetails, Expiry, Fingerprint } from "./certificate";
export { FirstAccount } from "./FirstAccount";
export { OutboundTrust, PinnedCertificates, TrustedAuthorities } from "./OutboundTrust";
export { PasswordSettings } from "./PasswordSettings";
export { RestoreOnboarding } from "./RestoreOnboarding";
export { PasskeySettings, TotpSettings } from "./SecondFactors";
export { SecuritySettings } from "./SecuritySettings";
export { Settings } from "./Settings";
export type { SettingsProps, SettingsSection } from "./Settings";
