import { Show, createUniqueId, splitProps } from "solid-js";
import type { JSX } from "solid-js";
import { cx } from "@wired-square/kit/core";

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  /** Shown instead of the hint. */
  error?: string;
  /** Called with the value on every `change`, after the caller's own `onChange`. */
  onValue?: (value: string) => void;
}

/** A labelled `<select>`, its options its children. */
export function Select(props: SelectProps) {
  const [own, rest] = splitProps(props, ["label", "hint", "error", "class", "aria-describedby", "onValue"]);

  const id = createUniqueId();
  const noteId = `${id}-note`;
  const note = () => (own.error ? own.error : own.hint);

  return (
    <div class={cx("app-field", own.class)} onChange={(e) => own.onValue?.((e.target as HTMLSelectElement).value)}>
      <label class="app-field__label" for={id}>
        {own.label}
      </label>
      <select
        {...rest}
        id={id}
        class="app-field__input"
        aria-invalid={own.error ? "true" : "false"}
        aria-describedby={[note() && noteId, own["aria-describedby"]].filter(Boolean).join(" ") || undefined}
      />
      <Show when={note()}>
        <small id={noteId} class={cx("app-field__note", own.error && "app-field__note--bad")}>
          {note()}
        </small>
      </Show>
    </div>
  );
}
