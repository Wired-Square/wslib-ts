import { Show, createContext, createEffect, createSignal, createUniqueId, onCleanup, useContext } from "solid-js";
import type { JSX } from "solid-js";

import { useIcons } from "./icons";
import { arrowTo } from "./keys";

const MenuClose = createContext<() => void>(() => {});

export interface MenuProps {
  /** "Actions for admin". */
  "aria-label": string;
  /**
   * Opens nothing while true. Said with `aria-disabled`, not `disabled`: a
   * focused button that becomes disabled loses its focus for good.
   */
  pending?: boolean;
  /** The button's face; `aria-label` must still contain its words. */
  trigger?: JSX.Element;
  children: JSX.Element;
}

/**
 * Actions behind one button, on the `popover` attribute: light dismiss, Escape
 * and the top layer come from the platform. The trigger is the panel's
 * `popovertarget`, so the platform knows not to light-dismiss on its own press.
 * Items are built when the menu opens, not at mount.
 */
export function Menu(props: MenuProps) {
  const icons = useIcons();
  const id = createUniqueId();
  let trigger!: HTMLButtonElement;
  let panel!: HTMLDivElement;
  const [open, setOpen] = createSignal(false);

  const items = () => [...panel.querySelectorAll<HTMLElement>("[role=menuitem]")];
  const dismiss = () => panel.hidePopover();

  // Measured at the origin, where no label wraps against the viewport's edge,
  // and hidden since `beforetoggle` so nothing paints at the last open's place.
  // CSS anchor positioning would do this and is not portable yet.
  const place = () => {
    panel.style.top = panel.style.left = "0px";
    const at = trigger.getBoundingClientRect();
    const { offsetHeight: height, offsetWidth: width } = panel;
    const below = window.innerHeight - at.bottom;
    panel.style.top = below < height + 8 ? `${at.top - height - 4}px` : `${at.bottom + 4}px`;
    panel.style.left = `${Math.max(8, at.right - width)}px`;
    panel.style.visibility = "";
    panel.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
  };

  // A fixed panel does not follow the row it was read from.
  createEffect(() => {
    if (!open()) return;
    window.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    onCleanup(() => {
      window.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
    });
  });

  // Not `focusout`: Safari does not focus a button on mousedown, so focus
  // leaves for nowhere before the click on an item lands.
  const navigate = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      dismiss();
      return;
    }
    const all = items();
    const to = arrowTo(e.key, all.indexOf(document.activeElement as HTMLElement), all.length, "ArrowDown");
    if (to === undefined) return;
    e.preventDefault();
    all[to]?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class="app-btn app-btn--plain app-menu__trigger"
        popovertarget={id}
        aria-label={props["aria-label"]}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-disabled={props.pending || undefined}
      >
        {props.trigger ?? icons.more()}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="menu"
        aria-label={props["aria-label"]}
        class="app-menu"
        onKeyDown={navigate}
        onBeforeToggle={(e) => {
          if (e.newState !== "open") return;
          if (props.pending) {
            e.preventDefault();
            return;
          }
          panel.style.visibility = "hidden";
        }}
        onToggle={(e) => {
          setOpen(e.newState === "open");
          if (open()) place();
        }}
      >
        <MenuClose.Provider value={dismiss}>
          <Show when={open()}>{props.children}</Show>
        </MenuClose.Provider>
      </div>
    </>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  children: JSX.Element;
}

export function MenuItem(props: MenuItemProps) {
  const close = useContext(MenuClose);
  return (
    <button
      type="button"
      role="menuitem"
      class="app-menu__item"
      onClick={() => {
        // Closed first, so a dialog opened from an item is not fighting a popover for the top layer.
        close();
        props.onSelect();
      }}
    >
      {props.children}
    </button>
  );
}

export interface MenuItemUnavailableProps {
  /** Shown after the label; without one the item is only greyed. */
  why?: string;
  children: JSX.Element;
}

/** Focusable, so a keyboard user reaches its reason; choosing it does nothing. */
export function MenuItemUnavailable(props: MenuItemUnavailableProps) {
  return (
    <button type="button" role="menuitem" class="app-menu__item" aria-disabled="true">
      {props.children}
      <Show when={props.why}>{(why) => <> <small>— {why()}</small></>}</Show>
    </button>
  );
}
