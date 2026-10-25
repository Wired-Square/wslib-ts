import { splitProps } from "solid-js";
import type { JSX } from "solid-js";

import { cx } from "./cx";

/** `danger` is an irreversible act, read from `--app-alert` rather than `--app-bad`. */
export type ButtonTone = "default" | "primary" | "danger" | "plain";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  /** Disables the button and announces why; the label stays the caller's. */
  pending?: boolean;
}

/** `type` defaults to `"button"`: HTML's submit default makes a Cancel inside a form submit it. */
export function Button(props: ButtonProps) {
  const [own, rest] = splitProps(props, ["tone", "pending", "class", "type"]);

  return (
    <button
      {...rest}
      type={own.type ?? "button"}
      class={cx("app-btn", own.tone && own.tone !== "default" && `app-btn--${own.tone}`, own.class)}
      disabled={rest.disabled || own.pending}
      aria-busy={own.pending ? "true" : "false"}
    />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, "tone" | "aria-label" | "title"> {
  /** The glyph's words: its accessible name and its tooltip. */
  label: string;
  /** An inline `<svg>`, drawn in `currentColor`. */
  children: JSX.Element;
}

export function IconButton(props: IconButtonProps) {
  const [own, rest] = splitProps(props, ["label", "class"]);
  return (
    <Button {...rest} tone="plain" class={cx("app-btn--icon", own.class)} aria-label={own.label} title={own.label} />
  );
}
