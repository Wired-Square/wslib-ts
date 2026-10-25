import { Show, children } from "solid-js";
import type { JSX } from "solid-js";

import { cx } from "./cx";

export interface SectionProps {
  title: string;
  /** One line on what this is for, or what it will cost. */
  blurb?: string;
  /** Controls beside the title. */
  actions?: JSX.Element;
  /** Tints the whole block: everything in here is dangerous. */
  tone?: "danger";
  children: JSX.Element;
  /** `h2` by default: a screen owns the `h1`. */
  level?: 2 | 3;
}

export function Section(props: SectionProps) {
  const actions = children(() => props.actions);
  return (
    <section class={cx("app-section", props.tone === "danger" && "app-section--danger")}>
      <header class="app-section__head">
        <div>
          <Show when={props.level === 3} fallback={<h2 class="app-section__title">{props.title}</h2>}>
            <h3 class="app-section__title">{props.title}</h3>
          </Show>
          <Show when={props.blurb}>{(blurb) => <p class="app-section__blurb">{blurb()}</p>}</Show>
        </div>
        <Show when={actions()}>
          <div class="app-actions">{actions()}</div>
        </Show>
      </header>
      {props.children}
    </section>
  );
}
