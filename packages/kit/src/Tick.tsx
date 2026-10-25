import { Show } from "solid-js";
import type { JSX } from "solid-js";

export interface TickProps {
  label: JSX.Element;
  hint?: JSX.Element | undefined;
  checked: boolean;
  disabled?: boolean;
  /** Cannot be ticked, and stays focusable so the reason `describedBy` names is read. */
  unavailable?: boolean;
  describedBy?: string | undefined;
  onChange: (on: boolean) => void;
}

/** A tickbox with its hint on the same line. */
export function Tick(props: TickProps) {
  return (
    <p>
      <label class="app-tick__label">
        <input
          type="checkbox"
          class="app-tick__box"
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
    </p>
  );
}
