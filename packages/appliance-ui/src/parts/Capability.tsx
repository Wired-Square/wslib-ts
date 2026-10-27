/**
 * Shows a control, or the reason there is no control.
 *
 * A button that always fails is worse than an absent one, because the operator
 * cannot tell whether they are holding it wrong. A box with no system bus, no
 * wireless device or no way to power itself off says so where the control would
 * have been.
 *
 * **The prop is typed structurally rather than as `Availability`.** Every
 * capability is a union tagged `state`, but the ready arm carries whatever that
 * capability needs, so demanding `Availability` would hand the control only
 * `via`, not a `ClockView`'s zone and NTP.
 */
import { Show } from "solid-js";
import type { Accessor, JSX } from "solid-js";

/**
 * Anything the daemon reports as available-or-not.
 *
 * Structural on purpose: `Availability`, `ClockView` and every capability
 * union after them satisfy it, and none of them has to know this exists.
 */
export type Capable =
  { state: "ready" } | { state: "unsupported"; because: string };

/**
 * The ready arm of a capability union, carrying whatever that capability
 * carries — `via` for an `Availability`, the zone and NTP for a `ClockView`.
 */
export type Ready<T extends Capable> = Extract<T, { state: "ready" }>;

export interface CapabilityProps<T extends Capable> {
  of: T;

  /**
   * The control, shown only when the capability is there to control.
   *
   * **Takes a function when the control needs what the ready arm carries**, the
   * way Solid's own `Show` does, and is handed the narrowed value:
   *
   *     <Capability of={clock} what="This box's time zone cannot be read">
   *       {(ready) => <Field label="Time zone" value={ready().timezone ?? "not set"} />}
   *     </Capability>
   *
   * That form is why this component is generic: handing back a plain
   * `JSX.Element` would make every caller whose capability has a payload
   * re-derive `state === "ready"` to reach it.
   */
  children: JSX.Element | ((ready: Accessor<Ready<T>>) => JSX.Element);

  /**
   * Rendered before the reason, when there is one — "This appliance cannot be
   * restarted", say, ahead of the daemon's own sentence saying why.
   *
   * The reason on its own is a fragment out of context: "there is no system
   * D-Bus here" answers a question the reader has not been asked.
   */
  what?: string;
}

export function Capability<T extends Capable>(props: CapabilityProps<T>) {
  // Both arms narrowed through a local, so each is read inside the arm that has
  // it. `children` is passed to `Show` untouched, which is what gives the
  // element-or-callback pair Solid's own semantics rather than a second set.
  const ready = () =>
    props.of.state === "ready" ? (props.of as Ready<T>) : undefined;

  // Read through the base union first. Narrowing a *generic* value on its
  // discriminant gives an intersection TypeScript will not read `because` out
  // of, so this widens to `Capable` for the one branch that does not need what
  // the caller's type adds.
  //
  // It yields the object rather than the string on purpose: `Show` tests
  // truthiness, and an empty `because` would then render neither the control
  // nor the reason — a blank where the whole point is to say something.
  const unsupported = (): { because: string } | undefined => {
    const of: Capable = props.of;
    return of.state === "unsupported" ? of : undefined;
  };

  return (
    <Show
      when={ready()}
      fallback={
        <Show when={unsupported()}>
          {(reason) => (
            <p class="app-unsupported">
              <Show when={props.what}>{(what) => <>{what()}: </>}</Show>
              {reason().because}
            </p>
          )}
        </Show>
      }
    >
      {props.children}
    </Show>
  );
}
