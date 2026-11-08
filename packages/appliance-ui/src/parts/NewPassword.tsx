/**
 * A new password, typed twice. The daemon never sees the second box, so a form
 * checks for itself that the two match and are not empty: it disables its act
 * until `ready`, and the mismatch is said on the field that is wrong. Not a
 * throw: a synthetic `ApiError(0, …)` would claim the box never answered. The
 * second field keeps a standing hint, because while it is empty the act is
 * disabled with no error to say why.
 */
import { MAX_PASSWORD_BYTES, MIN_PASSPHRASE_LEN } from "@wired-square/appliance-types";
import { Field } from "@wired-square/kit";
import { createSignal } from "solid-js";

export function createNewPassword() {
  const [value, setValue] = createSignal("");
  const [again, setAgain] = createSignal("");
  return {
    value,
    again,
    setValue,
    setAgain,
    matches: () => value() === again(),
    ready: () => value() !== "" && value() === again(),
    clear: () => {
      setValue("");
      setAgain("");
    },
  };
}

export type NewPasswordState = ReturnType<typeof createNewPassword>;

export interface NewPasswordProps {
  of: NewPasswordState;
  /** The first field's, such as "New password"; the second is it with " again". */
  label: string;
  hint: string;
  /** A backup's passphrase: at least `MIN_PASSPHRASE_LEN` characters, and kept from password managers. */
  passphrase?: boolean;
  /** Blank is allowed. */
  optional?: boolean;
}

export function NewPassword(props: NewPasswordProps) {
  const mismatched = () => props.of.again() !== "" && !props.of.matches();
  const unmanaged = () => (props.passphrase ? { "data-1p-ignore": true } : {});
  return (
    <>
      <Field
        type="password"
        label={props.label}
        autocomplete="new-password"
        required={!props.optional}
        {...(props.passphrase ? { minLength: MIN_PASSPHRASE_LEN } : { maxLength: MAX_PASSWORD_BYTES })}
        {...unmanaged()}
        hint={props.hint}
        value={props.of.value()}
        onValue={props.of.setValue}
      />
      <Field
        type="password"
        label={`${props.label} again`}
        autocomplete="new-password"
        required={!props.optional}
        {...unmanaged()}
        hint={`Retype the ${props.label.toLowerCase()} to confirm it.`}
        error={mismatched() ? `This does not match the ${props.label.toLowerCase()}.` : ""}
        value={props.of.again()}
        onValue={props.of.setAgain}
      />
    </>
  );
}
