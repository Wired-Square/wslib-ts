import { Show, createRenderEffect } from "solid-js";
import type { JSX } from "solid-js";

export interface TickProps {
  label: JSX.Element;
  hint?: JSX.Element | undefined;
  checked: boolean;
  /** Neither ticked nor not: a select-all over a partial selection. */
  mixed?: boolean;
  disabled?: boolean;
  /** Cannot be ticked, and stays focusable so the reason `describedBy` names is read. */
  unavailable?: boolean;
  describedBy?: string | undefined;
  onChange: (on: boolean) => void;
}

/** An inline tickbox with its hint on the same line; a line of its own comes from its container. */
export function Tick(props: TickProps) {
  return (
    <label class="app-tick__label">
      <input
        type="checkbox"
        class="app-tick__box"
        ref={(box) => createRenderEffect(() => (box.indeterminate = !!props.mixed))}
        checked={props.checked}
        disabled={props.disabled}
        aria-disabled={props.unavailable ? "true" : undefined}
        aria-describedby={props.describedBy}
        onClick={(e) => props.unavailable && e.preventDefault()}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span>
        {props.label}
        <Show when={props.hint}>{(hint) => <small> — {hint()}</small>}</Show>
      </span>
    </label>
  );
}
