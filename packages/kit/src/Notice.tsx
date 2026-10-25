import { Show, children, splitProps } from "solid-js";
import type { JSX } from "solid-js";

import { cx } from "./cx";

export type Tone = "good" | "warn" | "bad" | "neutral";

export interface NoticeProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone: Tone;
}

const drawsSomething = (child: unknown) => child != null && child !== false && child !== true && child !== "";

/**
 * A sentence in one of four tones, announced at once for `bad` (`alert`) and
 * at the next pause otherwise (`status`). Given nothing it draws nothing, so
 * `<Notice tone="bad">{action.failed()}</Notice>` needs no `<Show>`.
 */
export function Notice(props: NoticeProps) {
  const [own, rest] = splitProps(props, ["tone", "class", "children"]);
  const said = children(() => own.children);

  return (
    <Show when={said.toArray().some(drawsSomething)}>
      <div
        {...rest}
        class={cx("app-notice", `app-notice--${own.tone}`, own.class)}
        role={own.tone === "bad" ? "alert" : "status"}
      >
        {said()}
      </div>
    </Show>
  );
}
