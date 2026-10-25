import type { JSX } from "solid-js";

import { Button } from "./Button";
import { Dialog, DialogActions } from "./Dialog";
import { createAction } from "./action";
import { Notice } from "./Notice";

export interface ConfirmProps {
  title: string;
  children: JSX.Element;
  /** Name the act — "Power off", not "OK". */
  verb: string;
  /** Resolve and the dialog closes; throw and it stays open with the refusal in it. */
  act: () => Promise<void> | void;
  disabled?: boolean;
  onClose: () => void;
}

/** "Are you sure", for irreversible acts only: one on every Save gets clicked without reading. */
export function Confirm(props: ConfirmProps) {
  const action = createAction();
  const confirm = () => void action.run(props.act, props.onClose);

  return (
    <Dialog title={props.title} pending={action.pending()} onClose={props.onClose}>
      <Notice tone="bad">{action.failed()}</Notice>
      <div class="app-dialog__body">{props.children}</div>
      <DialogActions
        onCancel={props.onClose}
        pending={action.pending()}
        confirm={
          <Button tone="danger" pending={action.pending()} disabled={props.disabled} onClick={confirm}>
            {props.verb}
          </Button>
        }
      />
    </Dialog>
  );
}
