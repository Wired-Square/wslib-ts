import type { JSX } from "solid-js";

import { createFlash } from "./flash";
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
  const [copied, flashAfter] = createFlash();

  const copy = async () => {
    const write = props.write ?? ((text: string) => navigator.clipboard.writeText(text));
    try {
      await flashAfter(write(props.value));
    } catch {}
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
