import type { JSX } from "solid-js";

import { cx } from "./cx";
import type { Tone } from "./Notice";

export interface BadgeProps {
  tone: Tone;
  /** What the word means, on hover; the word itself has to stand alone. */
  title?: string;
  children: JSX.Element;
}

export function Badge(props: BadgeProps) {
  return (
    <span
      class={cx("app-badge", props.tone !== "neutral" && `app-badge--${props.tone}`)}
      title={props.title}
    >
      {props.children}
    </span>
  );
}

export function Badges(props: { children: JSX.Element }) {
  return <span class="app-badges">{props.children}</span>;
}
