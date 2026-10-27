/**
 * The components the daemon's own wire types demand, on top of
 * `@wired-square/kit`: capabilities, bundles, passwords, second factors and
 * roles. **A component that names a colour does not belong here**, and CI
 * greps for one.
 */
export { BundlePicker, Provenance } from "./BundlePicker";
export type { BundlePickerProps, ChosenBundle, ProvenanceProps } from "./BundlePicker";

export { Capability } from "./Capability";
export type { Capable, CapabilityProps, Ready } from "./Capability";

export { NewPassword, createNewPassword } from "./NewPassword";
export type { NewPasswordProps, NewPasswordState } from "./NewPassword";

export { PasswordAgain, reauthentication } from "./PasswordAgain";
export type { PasswordAgainProps } from "./PasswordAgain";

export { FactorProofField, createFactorProof } from "./FactorProof";
export type { FactorProofState, ProofWay } from "./FactorProof";

export {
  ClockSkewNotice,
  PasskeyHosts,
  PasskeyRenameWarning,
  PasskeyUnavailable,
  RestoredFactorsNote,
  clockSkewOf,
} from "./factorNotes";

export { RecoveryCodesShown, TotpKey } from "./TotpKey";

export { answerPasskey, makePasskey, passkeysUnusable, reauthenticationPasskey } from "./webauthn";

export { RoleBadge } from "./RoleBadge";
export type { RoleBadgeProps } from "./RoleBadge";
