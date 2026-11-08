import { Button } from "./Button";
import { CopyButton } from "./CopyButton";
import { Field } from "./Field";

export interface ShownOnceProps {
  label: string;
  value: string;
  /** Default "This is shown once. Copy it now: it can't be shown again." */
  note?: string | undefined;
  onDone: () => void;
}

/** A value the server shows only once, a new key or token, for an `undismissible` `Dialog`; the caller drops it on `onDone`. */
export function ShownOnce(props: ShownOnceProps) {
  return (
    <>
      <Field
        class="app-shown-once"
        label={props.label}
        value={props.value}
        hint={props.note ?? "This is shown once. Copy it now: it can't be shown again."}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <div class="app-dialog__actions">
        <div>
          <CopyButton value={props.value}>Copy</CopyButton>
        </div>
        <div class="app-actions">
          <Button tone="primary" onClick={() => props.onDone()}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
