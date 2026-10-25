import { createContext, createEffect, createSignal, onCleanup, useContext } from "solid-js";
import type { JSX } from "solid-js";

import { Button } from "./Button";
import { formatWhen } from "@wired-square/kit/core";
import type { DateMode, RelativeWording } from "./format";

export interface DateModesProps {
  /** The mode shown first; default `local`. */
  initial?: DateMode;
  /** Default the viewer's. */
  locale?: string;
  /** Replaces the platform's relative wording. */
  relative?: RelativeWording;
  children: JSX.Element;
}

const NEXT: Record<DateMode, DateMode> = { utc: "local", local: "relative", relative: "utc" };
const LABEL: Record<DateMode, string> = { utc: "UTC", local: "Local", relative: "Relative" };

interface Modes {
  mode: () => DateMode;
  now: () => number;
  locale: string | undefined;
  relative: RelativeWording | undefined;
  cycle: () => void;
}

const Modes = createContext<Modes>({
  mode: (): DateMode => "local",
  now: () => Date.now(),
  locale: undefined,
  relative: undefined,
  cycle: () => {},
});

/** What `When` reads, so a time formatted elsewhere, for a search filter say, matches it. */
export function useDateModes(): Omit<Modes, "cycle"> {
  return useContext(Modes);
}

/** How every `When` below shows its time, with one clock ticking each second only while that is relative. */
export function DateModes(props: DateModesProps) {
  const [mode, setMode] = createSignal<DateMode>(props.initial ?? "local");
  const [now, setNow] = createSignal(Date.now());

  createEffect(() => {
    if (mode() !== "relative") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <Modes.Provider
      value={{
        mode,
        now,
        get locale() {
          return props.locale;
        },
        get relative() {
          return props.relative;
        },
        cycle: () => setMode(NEXT[mode()]),
      }}
    >
      {props.children}
    </Modes.Provider>
  );
}

/** Names the mode, and moves to the next on a press. */
export function DateModeToggle() {
  const modes = useContext(Modes);
  return (
    <Button tone="plain" class="app-date-mode" title="Change how times are shown" onClick={modes.cycle}>
      {LABEL[modes.mode()]}
    </Button>
  );
}

export interface WhenProps {
  at: Date;
}

export function When(props: WhenProps) {
  const modes = useDateModes();
  return (
    <time datetime={props.at.toISOString()}>
      {formatWhen(props.at, modes.mode(), { now: modes.now(), locale: modes.locale, relative: modes.relative })}
    </time>
  );
}
