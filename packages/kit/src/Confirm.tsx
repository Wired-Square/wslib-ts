import { Show, createSignal } from "solid-js";
import type { JSX } from "solid-js";

import { Button } from "./Button";
import { Dialog, DialogActions } from "./Dialog";
import { createAction } from "./action";
import { Field } from "./Field";
import { Notice } from "./Notice";

export interface ConfirmProps {
  title: string;
  children: JSX.Element;
  /** Name the act — "Power off", not "OK". */
  verb: string;
  /** A required reason: Confirm waits for it, and `act` gets it trimmed. */
  reason?: { label: string; placeholder?: string };
  /** Default `danger`. */
  tone?: "danger" | "primary";
  /** Resolve and the dialog closes; throw and it stays open with the refusal in it. */
  act: (reason: string) => Promise<void> | void;
  disabled?: boolean;
  onClose: () => void;
}

/** "Are you sure", for irreversible acts only: one on every Save gets clicked without reading. */
export function Confirm(props: ConfirmProps) {
  const action = createAction();
  const [reason, setReason] = createSignal("");
  const given = () => (props.reason ? reason().trim() : "");
  const confirm = () => void action.run(() => props.act(given()), props.onClose);

  return (
    <Dialog title={props.title} pending={action.pending()} onClose={props.onClose}>
      <Notice tone="bad">{action.failed()}</Notice>
      <div class="app-dialog__body">{props.children}</div>
      <Show when={props.reason}>
        {(asked) => (
          <Field
            label={asked().label}
            placeholder={asked().placeholder}
            required
            autofocus
            value={reason()}
            disabled={action.pending()}
            onValue={setReason}
          />
        )}
      </Show>
      <DialogActions
        onCancel={props.onClose}
        pending={action.pending()}
        confirm={
          <Button
            tone={props.tone ?? "danger"}
            pending={action.pending()}
            disabled={props.disabled || (!!props.reason && !given())}
            onClick={confirm}
          >
            {props.verb}
          </Button>
        }
      />
    </Dialog>
  );
}
