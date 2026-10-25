import { createUniqueId } from "solid-js";
import { cx } from "@wired-square/kit/core";

import type { ButtonTone } from "./Button";

interface PickFileCommon {
  /** Name what is being chosen, not the act. */
  label: string;
  /** A hint to the file dialogue, never a check; `reject` is the check. */
  accept?: string;
  /** A sentence to refuse a file with, by name or size, before it is read; `undefined` takes it. */
  reject?: (file: File) => string | undefined;
  onProblem: (because: string) => void;
  tone?: ButtonTone;
}

export type PickFileProps = PickFileCommon &
  (
    | {
        onText: (text: string, name: string) => void;
        onFile?: never;
      }
    | {
        /** For a file that is not text: the file, unread. */
        onFile: (file: File) => void;
        onText?: never;
      }
  );

/**
 * A button that chooses a file. The input is clipped rather than hidden, so it
 * keeps its tab stop, and its `<label>` carries the button's look and
 * activates it from the keyboard.
 */
export function PickFile(props: PickFileProps) {
  const id = createUniqueId();
  let input: HTMLInputElement | undefined;

  const chose = async (file: File | undefined) => {
    // Cleared first, so choosing the same file again fires `change` again.
    if (input) input.value = "";
    if (!file) return;

    const refused = props.reject?.(file);
    if (refused) {
      props.onProblem(refused);
      return;
    }
    if (props.onFile) {
      props.onFile(file);
      return;
    }
    try {
      props.onText?.(await file.text(), file.name);
    } catch {
      props.onProblem(`${file.name} could not be read.`);
    }
  };

  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        class="app-visually-hidden"
        accept={props.accept}
        onChange={(e) => void chose(e.currentTarget.files?.[0])}
      />
      <label
        for={id}
        class={cx("app-btn", "app-pick-file__label", props.tone && props.tone !== "default" && `app-btn--${props.tone}`)}
      >
        {props.label}
      </label>
    </>
  );
}
