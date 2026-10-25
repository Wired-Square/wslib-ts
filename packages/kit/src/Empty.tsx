import { Show } from "solid-js";

import { useIcons } from "./icons";

export interface NothingYetProps {
  /** "No keys yet". */
  label: string;
  note?: string | undefined;
}

export function NothingYet(props: NothingYetProps) {
  const icons = useIcons();
  return (
    <div class="app-nothing-yet">
      {icons.empty()}
      <p class="app-nothing-yet__label">{props.label}</p>
      <Show when={props.note}>{(note) => <p class="app-nothing-yet__note">{note()}</p>}</Show>
    </div>
  );
}
