export interface ToggleProps {
  /** Its `aria-label` only; any visible text beside it is the app's. */
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}

export function Toggle(props: ToggleProps) {
  return (
    <input
      type="checkbox"
      role="switch"
      class="app-switch"
      aria-label={props.label}
      checked={props.checked}
      onChange={(e) => props.onChange(e.currentTarget.checked)}
    />
  );
}
