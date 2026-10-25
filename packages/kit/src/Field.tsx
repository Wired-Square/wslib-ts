import { Show, createSignal, createUniqueId, splitProps } from "solid-js";
import type { JSX } from "solid-js";

import { cx } from "./cx";

export interface FieldProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Shown instead of the hint. */
  error?: string;
  /** Called with the value on every `input`, after the caller's own `onInput`. */
  onValue?: (value: string) => void;
}

export function Field(props: FieldProps) {
  const [own, rest] = splitProps(props, ["label", "hint", "error", "class", "onValue"]);

  const id = createUniqueId();
  const noteId = `${id}-note`;

  // Truthiness rather than `??`, so `error={wrong() ? "…" : ""}` still shows the hint.
  const note = () => (own.error ? own.error : own.hint);

  // Read from events bubbling out of the input, so the caller's own handlers on
  // it are left alone. Shown only while focused: a pointer press on the hint
  // would otherwise leave it standing.
  const [capsLock, setCapsLock] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const capsId = `${id}-caps`;
  const password = () => rest.type === "password";
  const warning = () => password() && focused() && capsLock();
  const readCapsLock = (e: KeyboardEvent | PointerEvent) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <div
      class={cx("app-field", own.class)}
      onInput={(e) => own.onValue?.((e.target as HTMLInputElement).value)}
      onKeyDown={readCapsLock}
      onKeyUp={readCapsLock}
      onPointerDown={readCapsLock}
      onFocusIn={() => setFocused(true)}
      onFocusOut={() => {
        setFocused(false);
        setCapsLock(false);
      }}
    >
      <label class="app-field__label" for={id}>
        {own.label}
      </label>
      <input
        {...rest}
        id={id}
        class="app-field__input"
        aria-invalid={own.error ? "true" : "false"}
        aria-describedby={[note() && noteId, warning() && capsId].filter(Boolean).join(" ") || undefined}
      />
      <Show when={note()}>
        <small id={noteId} class={cx("app-field__note", own.error && "app-field__note--bad")}>
          {note()}
        </small>
      </Show>
      <Show when={password()}>
        <small
          id={capsId}
          role="status"
          class={cx("app-field__note app-field__note--warn", !warning() && "app-visually-hidden")}
        >
          {warning() ? "Caps Lock is on" : ""}
        </small>
      </Show>
    </div>
  );
}
