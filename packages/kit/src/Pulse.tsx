import { Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { cx } from "./cx";
import { ago } from "./format";

export interface PulseProps {
  /** Any value whose identity changes per event; a running total beats a timestamp, which two events can share. */
  at?: number | undefined;
}

/** A dot that flashes when `at` changes, in `currentcolor`. */
export function Pulse(props: PulseProps) {
  let dot!: HTMLSpanElement;
  let flash: Animation | undefined;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  // Deferred, so a mount does not flash for something nobody saw happen; one
  // animation, restarted, so a burst does not stack them.
  createEffect(
    on(
      () => props.at,
      () => {
        if (reducedMotion.matches) return;
        flash?.cancel();
        flash = dot.animate(
          [{ transform: "scale(1)" }, { transform: "scale(2.2)", opacity: 0.3 }, { transform: "scale(1)" }],
          { duration: 450, easing: "ease-out" },
        );
      },
      { defer: true },
    ),
  );

  return <span ref={dot} class="app-pulse" aria-hidden="true" />;
}

export interface FeedStatusProps {
  live: boolean;
  /** When the feed last carried an event, by this browser's clock. Without it only Live or Not live is shown. */
  heard?: number | undefined;
}

export function FeedStatus(props: FeedStatusProps) {
  return (
    <span class={cx("app-feed", props.live ? "app-feed--live" : "app-feed--stale")}>
      <Pulse at={props.heard} />
      {props.live ? "Live" : "Not live"}
      <Show when={props.heard}>{(at) => <Age of={at()} />}</Show>
    </span>
  );
}

function Age(props: { of: number }) {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 1_000);
  onCleanup(() => clearInterval(timer));
  // Hidden from the live region, which would otherwise announce it every second.
  return (
    <span class="app-muted" aria-hidden="true">
      {" "}
      · {ago(props.of, now())}
    </span>
  );
}
