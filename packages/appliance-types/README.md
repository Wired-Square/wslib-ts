# @wired-square/appliance-types

The appliance's wire types and limits, as the TypeScript that ts-rs writes for wslib-rs's `wslib-appliance-types`.
Every type is exported from the root, with the crate's limits as constants. The generated files are never edited by
hand; each version is regenerated from a tag of the crate.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/appliance-types
```

## Entry points

| Subpath | What |
|---|---|
| `.` | Every wire type and the limits, compiled JavaScript with types |

```ts
import { ROLE_LADDER, type Role } from "@wired-square/appliance-types";
```

## Peers

None, and no dependencies.

## Moved names

From `@wired-square/appliance-ui` (the 0.17.x installed from git) to here, in its 0.1.0, which does not re-export
them:

- The wire types: `AboutView`, `AddressConfig`, `ApiErrorBody`, `AppArch`, `AppCapability`, `AppHealth`, `AppImage`,
  `AppListener`, `AppManifest`, `AppNetwork`, `AppRole`, `AppSockets`, `AppVolume`, `AssertionCredential`,
  `AssertionResponse`, `AttestationResponse`, `AuditRecord`, `AuthenticatorSelection`, `Availability`, `BackupFile`,
  `BackupSchedule`, `BackupState`, `Branding`, `BrandingView`, `BundleHeader`, `CaCertificate`, `Caller`,
  `CertificateReport`, `CertificateView`, `Chosen`, `ClockSkew`, `ClockView`, `Contains`, `CreationOptions`,
  `CredentialDescriptor`, `CredentialParameters`, `EnabledChange`, `Enrolled`, `EnrolmentConfirm`, `Fact`,
  `FactorProof`, `FirstAccountBody`, `Inspection`, `InspectPeer`, `JsonValue`, `ListedUser`, `ListenerProtocol`,
  `LocalIdentity`, `LogLevel`, `LogRecord`, `LogSnapshot`, `NewUser`, `Ntp`, `Onboarding`, `OpenBundle`, `Page`,
  `PasskeyHost`, `PasskeyRegistration`, `PasskeyRename`, `PasskeyView`, `PasswordChange`, `PasswordReset`, `Peer`,
  `Pending`, `PendingEnrolment`, `PendingState`, `PinPeer`, `Reauthentication`, `RecoveryCodes`,
  `RegistrationCredential`, `RelyingPartyEntity`, `RequestOptions`, `ResetReport`, `RestoreBundle`, `RestoreReport`,
  `RestoreUnclaimed`, `Role`, `RoleChange`, `Rollback`, `ScheduleUpdate`, `ScheduleView`, `SecondStep`, `SectionItem`,
  `SettledBy`, `SignInBody`, `SignInCode`, `SignInMethod`, `Subsystem`, `TakeBackup`, `ThemeTokens`, `TotpConfirm`,
  `TotpEnrolment`, `TotpView`, `TrustedCa`, `TrustedCert`, `User`, `UserEntity`, `Warning` and `WarningScope`.
- The constants: `TOKEN_PREFIX`, `MAX_TOKENS`, `MAX_VALUE_LEN`, `ROLE_LADDER`, `MIN_PASSWORD_LEN`,
  `MAX_PASSWORD_BYTES`, `MAX_USERNAME_LEN`, `MAX_PASSKEY_NAME_LEN`, `STALE_PROOF`, `MAX_AUDIT_PAGE`, `MAX_PEM_LEN`,
  `MAX_BUNDLE_LEN`, `MIN_PASSPHRASE_LEN`, `MIN_EVERY_HOURS`, `MAX_EVERY_HOURS`, `MIN_KEEP`, `MAX_KEEP`, `LOG_RING`,
  `LOG_LEVELS` and `FEED_HEARTBEAT_S`.

`@wired-square/kit` keeps its own `Pending`, `Rollback`, `SettledBy`, `Warning` and `WarningScope`, of the same
shape, for its components; an appliance imports them from here.
