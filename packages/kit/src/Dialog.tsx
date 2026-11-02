import { Show, createUniqueId, onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";
import { cx } from "@wired-square/kit/core";

import { Button, IconButton } from "./Button";
import { useIcons } from "./icons";

interface DialogBase {
  /** Absent when the content brings its own heading. */
  title?: string;
  "aria-label"?: string;
  class?: string;
  wide?: boolean;
  /** A labelled close button in the corner, for a dialog with no Cancel; it is disabled while `pending`. */
  closeButton?: boolean;
  /** Escape does nothing while true, so an act in flight keeps its refusal. */
  pending?: boolean;
  children: JSX.Element;
}

export type DialogProps = DialogBase &
  (
    | {
        /** Nothing but the caller closes it: Escape does nothing, and no close button shows. */
        undismissible: true;
        onClose?: () => void;
      }
    | {
        undismissible?: false;
        /** Called once, whichever way out was taken. */
        onClose: () => void;
      }
  );

/**
 * A modal on the native `<dialog>`. Mounted means open: the caller renders it
 * inside the `<Show>` that supplies its content, and drops it on `onClose`.
 */
export function Dialog(props: DialogProps) {
  const icons = useIcons();
  const titleId = createUniqueId();
  let dialog: HTMLDialogElement | undefined;
  let told = false;

  const held = () => props.pending || props.undismissible;
  const showsClose = () => props.closeButton && !props.undismissible;
  const tell = () => {
    if (told || held()) return;
    told = true;
    props.onClose?.();
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
  // element outright: reopened while held, otherwise one more way out.
  const closedByPlatform = () => {
    if (told || dialog?.open) return;
    if (held()) dialog?.showModal();
    else tell();
  };

  return (
    <dialog
      ref={dialog}
      class={cx("app-dialog", props.wide && "app-dialog--wide", showsClose() && "app-dialog--closable", props.class)}
      aria-labelledby={props.title ? titleId : undefined}
      aria-label={props["aria-label"]}
      onCancel={(event) => {
        event.preventDefault();
        tell();
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
      {/* Last, so `showModal` never lands focus on it ahead of the content. */}
      <Show when={showsClose()}>
        <IconButton label="Close" class="app-dialog__close" disabled={props.pending} onClick={tell}>
          {icons.clear()}
        </IconButton>
      </Show>
    </dialog>
  );
}

export interface DialogActionsProps {
  onCancel: () => void;
  /** Absent for a dialog with nothing to confirm: the one button then reads Close, in the default tone. */
  confirm?: JSX.Element;
  /** Cancel is disabled while the confirm is in flight. */
  pending?: boolean;
  /** A secondary delete, far left; Cancel then takes `autofocus`, so the dialog never opens on it. */
  destructive?: JSX.Element;
  /** A polite live region, left of the buttons: "1 of 2 selected", "Saving…". */
  status?: JSX.Element;
}

export function DialogActions(props: DialogActionsProps) {
  return (
    <div class="app-dialog__actions">
      <div>
        {props.destructive}
        <Show when={"status" in props}>
          <span class="app-dialog__status" role="status">
            {props.status}
          </span>
        </Show>
      </div>
      <div class="app-actions">
        <Button
          tone={"confirm" in props ? "plain" : "default"}
          disabled={props.pending}
          autofocus={"destructive" in props}
          onClick={props.onCancel}
        >
          {"confirm" in props ? "Cancel" : "Close"}
        </Button>
        {props.confirm}
      </div>
    </div>
  );
}
