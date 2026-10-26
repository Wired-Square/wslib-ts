import { createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";

import { useIcons } from "./icons";

export interface CopyButtonProps {
  value: string;
  /** Default `navigator.clipboard.writeText`. */
  write?: (text: string) => Promise<void>;
  /** What the button shows beside the glyph: the value itself, or words like "Copy". */
  children: JSX.Element;
}

/** Copies `value`, then says "Copied" in place of the glyph and in a status region for two seconds once the write has landed. */
export function CopyButton(props: CopyButtonProps) {
  const icons = useIcons();
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const copy = async () => {
    const write = props.write ?? ((text: string) => navigator.clipboard.writeText(text));
    try {
      await write(props.value);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <>
      <button type="button" class="app-copy" onClick={() => void copy()}>
        <span class="app-copy__value">{props.children}</span>
        <span class="app-copy__glyph" aria-hidden="true">
          {copied() ? "Copied" : icons.copy()}
        </span>
      </button>
      <span role="status" class="app-visually-hidden">
        {copied() ? "Copied" : ""}
      </span>
    </>
  );
}
