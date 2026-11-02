import { Show, splitProps } from "solid-js";
import type { JSX } from "solid-js";
import { cx } from "@wired-square/kit/core";

import { useIcons } from "./icons";

export interface SearchInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  /** Its `aria-label` only; a search in a toolbar shows no label. */
  label: string;
  value: string;
  /** Called with the value on every `input`, after the caller's own `onInput`, and with `""` when cleared. */
  onValue: (value: string) => void;
}

/** A search box with a clear button while it holds a value; clearing returns focus to the box. */
export function SearchInput(props: SearchInputProps) {
  const icons = useIcons();
  const [own, rest] = splitProps(props, ["label", "value", "onValue", "class"]);
  let wrap!: HTMLDivElement;

  const input = () => wrap.querySelector("input")!;

  const clear = () => {
    own.onValue("");
    input().focus();
  };

  // WebKit keeps Escape in a search box even when it is empty, so the dialog around it never hears `cancel`.
  const escape = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.target !== input() || e.defaultPrevented || e.isComposing) return;
    if (own.value) {
      e.preventDefault();
      own.onValue("");
      return;
    }
    const dialog = wrap.closest("dialog[open], [popover]");
    if (!(dialog instanceof HTMLDialogElement)) return;
    e.preventDefault();
    if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
  };

  return (
    <div
      ref={wrap}
      class={cx("app-search", own.class)}
      onInput={(e) => own.onValue((e.target as HTMLInputElement).value)}
      onKeyDown={escape}
    >
      <input
        {...rest}
        type="search"
        class="app-field__input app-search__input"
        aria-label={own.label}
        value={own.value}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck={false}
      />
      <Show when={own.value && !rest.disabled && !rest.readOnly && !rest.readonly}>
        <button type="button" class="app-search__clear" aria-label="Clear" title="Clear" onClick={clear}>
          {icons.clear()}
        </button>
      </Show>
    </div>
  );
}
