import { createRenderEffect, createUniqueId } from "solid-js";
import { duration } from "@wired-square/kit/core";

export interface ProgressProps {
  label: string;
  /** Absent while there is no telling how far along it is. */
  value?: number | undefined;
  /** Default 1. */
  max?: number;
  /** Seconds left, shown as "about 3m left". */
  eta?: number | undefined;
}

/** A native `<progress>` named by a visible label, with the percent done and, given `eta`, the time left. */
export function Progress(props: ProgressProps) {
  const labelId = createUniqueId();
  const max = () => props.max ?? 1;
  const done = () =>
    [
      props.value !== undefined && `${Math.round((100 * props.value) / max())}%`,
      props.eta !== undefined && `about ${duration(Math.round(props.eta))} left`,
    ]
      .filter(Boolean)
      .join(" · ");

  const bar = (<progress class="app-progress__bar" aria-labelledby={labelId} max={max()} />) as HTMLProgressElement;
  // The `value` property can't be unset, and only an absent attribute is indeterminate.
  createRenderEffect(() => (props.value === undefined ? bar.removeAttribute("value") : (bar.value = props.value)));

  return (
    <div class="app-progress">
      <div class="app-progress__head">
        <span id={labelId}>{props.label}</span>
        <span class="app-muted">{done()}</span>
      </div>
      {bar}
    </div>
  );
}
