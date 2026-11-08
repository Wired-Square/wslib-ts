import type { FactorProof } from "@wired-square/appliance-types";
import { Button, Dialog, DialogActions, Notice, createAction } from "@wired-square/kit";
import type { JSX } from "solid-js";

import { withProof } from "./withProof";

export interface ProvedProps {
  title: string;
  verb: string;
  act: (proof: FactorProof) => Promise<void>;
  /** Default `primary`. */
  tone?: "danger" | "primary";
  disabled?: boolean;
  onClose: () => void;
  children: JSX.Element;
}

/**
 * A confirm dialog whose button asks the signed-in account's proof over it and
 * hands it to `act`: a cancelled proof leaves it open, a refusal shows in it.
 */
export function Proved(props: ProvedProps) {
  const action = createAction();
  const tone = () => props.tone ?? "primary";
  const confirm = () =>
    void action.run(
      () => withProof({ for: props.title, verb: props.verb, tone: tone() }, (proof) => props.act(proof).then(() => ({}))),
      (done) => {
        if (done) props.onClose();
      },
    );
  return (
    <Dialog title={props.title} class="app-confirm" pending={action.pending()} onClose={props.onClose}>
      <Notice tone="bad">{action.failed()}</Notice>
      <div class="app-dialog__body">{props.children}</div>
      <DialogActions
        onCancel={props.onClose}
        pending={action.pending()}
        confirm={
          <Button tone={tone()} pending={action.pending()} disabled={props.disabled} onClick={confirm}>
            {props.verb}
          </Button>
        }
      />
    </Dialog>
  );
}
