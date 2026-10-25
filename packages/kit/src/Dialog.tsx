import { Show, createUniqueId, onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";

import { Button } from "./Button";
import { cx } from "./cx";

export interface DialogProps {
  /** Absent when the content brings its own heading. */
  title?: string;
  "aria-label"?: string;
  wide?: boolean;
  /** Escape does nothing while true, so an act in flight keeps its refusal. */
  pending?: boolean;
  /** Called once, whichever way out was taken. */
  onClose: () => void;
  children: JSX.Element;
}

/**
 * A modal on the native `<dialog>`. Mounted means open: the caller renders it
 * inside the `<Show>` that supplies its content, and drops it on `onClose`.
 */
export function Dialog(props: DialogProps) {
  const titleId = createUniqueId();
  let dialog: HTMLDialogElement | undefined;
  let told = false;

  const tell = () => {
    if (told) return;
    told = true;
    props.onClose();
  };

  onMount(() => dialog?.showModal());

  // `close()` rather than restoring focus by hand: Solid disposes a `Show`
  // branch before detaching its DOM, so this runs while the dialog is still
  // open, where everything outside it is inert and `.focus()` does nothing.
  onCleanup(() => {
    told = true;
    dialog?.close();
  });

  // A browser honours `preventDefault` on `cancel` only while the page holds
  // user activation, which the first Escape spends, so the second closes the
  // element outright: reopened while pending, otherwise one more way out.
  const closedByPlatform = () => {
    if (told || dialog?.open) return;
    if (props.pending) dialog?.showModal();
    else tell();
  };

  return (
    <dialog
      ref={dialog}
      class={cx("app-dialog", props.wide && "app-dialog--wide")}
      aria-labelledby={props.title ? titleId : undefined}
      aria-label={props["aria-label"]}
      onCancel={(event) => {
        event.preventDefault();
        if (!props.pending) tell();
      }}
      onClose={closedByPlatform}
      onToggle={(event) => {
        if (event.newState === "closed") closedByPlatform();
      }}
    >
      <Show when={props.title}>
        {(title) => (
          <h2 class="app-dialog__title" id={titleId}>
            {title()}
          </h2>
        )}
      </Show>
      {props.children}
    </dialog>
  );
}

export interface DialogActionsProps {
  onCancel: () => void;
  confirm: JSX.Element;
  /** Cancel is disabled while the confirm is in flight. */
  pending?: boolean;
  /** A secondary delete, far left; Cancel then takes `autofocus`, so the dialog never opens on it. */
  destructive?: JSX.Element;
}

export function DialogActions(props: DialogActionsProps) {
  return (
    <div class="app-dialog__actions">
      <div>{props.destructive}</div>
      <div class="app-actions">
        <Button tone="plain" disabled={props.pending} autofocus={"destructive" in props} onClick={props.onCancel}>
          Cancel
        </Button>
        {props.confirm}
      </div>
    </div>
  );
}
