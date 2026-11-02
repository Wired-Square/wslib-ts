import { Show, createUniqueId, splitProps } from "solid-js";
import type { JSX } from "solid-js";
import { cx } from "@wired-square/kit/core";

export interface TextAreaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  /** Written words in the body font; by default it is monospace and tall, for text pasted rather than typed. */
  variant?: "prose";
  hint?: string;
  /** Shown instead of the hint. */
  error?: string;
  /** Called with the value on every `input`, after the caller's own `onInput`. */
  onValue?: (value: string) => void;
}

/** `Field` for text pasted rather than typed, a certificate or a key, or with `variant="prose"` for written words. */
export function TextArea(props: TextAreaProps) {
  const [own, rest] = splitProps(props, ["label", "variant", "hint", "error", "class", "onValue"]);

  const id = createUniqueId();
  const noteId = `${id}-note`;
  const note = () => (own.error ? own.error : own.hint);

  return (
    <div class={cx("app-field", own.class)} onInput={(e) => own.onValue?.((e.target as HTMLTextAreaElement).value)}>
      <label class="app-field__label" for={id}>
        {own.label}
      </label>
      <textarea
        {...rest}
        id={id}
        class={`app-field__input app-field__input--${own.variant ?? "multiline"}`}
        aria-invalid={own.error ? "true" : "false"}
        aria-describedby={note() ? noteId : undefined}
      />
      <Show when={note()}>
        <small id={noteId} class={cx("app-field__note", own.error && "app-field__note--bad")}>
          {note()}
        </small>
      </Show>
    </div>
  );
}
