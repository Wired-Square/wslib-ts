import { createSignal } from "solid-js";
import type { JSX } from "solid-js";

import { Button } from "./Button";
import { createAction } from "./action";
import { Notice } from "./Notice";

export interface FormProps {
  /** Resolve for success; a thrown `Refusal` renders its message. */
  act: () => Promise<void>;
  children: JSX.Element;
  verb?: string;
  /** Shown when a submit succeeds, until the next attempt. */
  done?: string | undefined;
  /** Beside Save — a Cancel, a second action. */
  actions?: JSX.Element;
  disabled?: boolean;
}

export function Form(props: FormProps) {
  const action = createAction();
  const [succeeded, setSucceeded] = createSignal(false);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (props.disabled) return;
    // Cleared on the way in: a stale success above an edited form reads as though the edit was saved.
    setSucceeded(false);
    void action.run(props.act, () => setSucceeded(true));
  };

  return (
    <form class="app-form" onSubmit={onSubmit} novalidate>
      <Notice tone="bad">{action.failed()}</Notice>
      <Notice tone="good">{succeeded() && props.done}</Notice>

      {props.children}

      <div class="app-actions">
        <Button type="submit" tone="primary" pending={action.pending()} disabled={props.disabled}>
          {props.verb ?? "Save"}
        </Button>
        {props.actions}
      </div>
    </form>
  );
}
