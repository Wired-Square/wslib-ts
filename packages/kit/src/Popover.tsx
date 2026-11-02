import { onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";

import { arrowTo } from "./keys";
import { placePopover } from "@wired-square/kit/core";
import type { PlaceOptions } from "./placePopover";

const ITEM = "[role=menuitem]:not([aria-disabled=true]), [role=option]:not([aria-disabled=true])";

/**
 * Measured at the origin, where nothing wraps against the viewport's edge. CSS
 * anchor positioning would do this and is not portable yet.
 */
export function pinTo(anchor: Element, panel: HTMLElement, options: PlaceOptions) {
  Object.assign(panel.style, { top: "0px", left: "0px", maxHeight: "", width: "" });
  const at = placePopover(
    anchor.getBoundingClientRect(),
    { width: panel.offsetWidth, height: panel.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
    options,
  );
  Object.assign(panel.style, {
    top: `${at.top}px`,
    left: `${at.left}px`,
    maxHeight: `${at.maxHeight}px`,
    width: at.width === undefined ? "" : `${at.width}px`,
  });
}

export interface PopoverProps {
  /** Any element, not necessarily what opened it; a press on it counts as inside. */
  anchor: HTMLElement;
  /** Called on a press outside, Escape, a scroll outside, or a resize. */
  onClose: () => void;
  align?: "start" | "end";
  /** As wide as the anchor. */
  matchWidth?: boolean;
  /** Otherwise focus stays where it was, on a live input say. */
  focusFirstItem?: boolean;
  role?: JSX.HTMLAttributes<HTMLDivElement>["role"];
  "aria-label"?: string;
  children: JSX.Element;
}

/**
 * A panel pinned to `anchor`, on `popover="manual"`: the platform's light
 * dismiss would close it on a press on an anchor that is not its trigger.
 * Mounted means open.
 */
export function Popover(props: PopoverProps) {
  let panel!: HTMLDivElement;
  let body!: HTMLDivElement;

  const place = () => pinTo(props.anchor, panel, { align: props.align ?? "start", matchWidth: !!props.matchWidth });
  const outside = (e: Event) =>
    !(e.target instanceof Node && (panel.contains(e.target) || props.anchor.contains(e.target)));
  const listen = <K extends keyof WindowEventMap>(type: K, handler: (e: WindowEventMap[K]) => void) => {
    window.addEventListener(type, handler, true);
    onCleanup(() => window.removeEventListener(type, handler, true));
  };

  const navigate = (e: KeyboardEvent) => {
    const all = [...panel.querySelectorAll<HTMLElement>(ITEM)];
    const to = arrowTo(e.key, all.indexOf(document.activeElement as HTMLElement), all.length, "ArrowDown");
    if (to === undefined || all.length === 0) return;
    e.preventDefault();
    all[to]?.focus();
  };

  onMount(() => {
    panel.showPopover();
    place();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(place);
      observer.observe(body);
      onCleanup(() => observer.disconnect());
    }
    if (props.focusFirstItem) panel.querySelector<HTMLElement>(ITEM)?.focus();

    listen("pointerdown", (e) => outside(e) && props.onClose());
    listen("scroll", (e) => outside(e) && props.onClose());
    listen("resize", () => props.onClose());
    // Default prevented as well: a modal dialog's cancel is Escape's default action, which stopping propagation leaves.
    listen("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    });

    onCleanup(() => {
      const focusWasInside = panel.contains(document.activeElement);
      panel.hidePopover();
      if (focusWasInside) props.anchor.focus();
    });
  });

  return (
    <div ref={panel} popover="manual" class="app-popover" role={props.role} aria-label={props["aria-label"]} onKeyDown={navigate}>
      <div ref={body}>{props.children}</div>
    </div>
  );
}

export interface PopoverOptionProps {
  selected?: boolean;
  onSelect: () => void;
  children: JSX.Element;
}

/** A row the arrow keys reach, chosen by a click, Enter or Space. */
export function PopoverOption(props: PopoverOptionProps) {
  return (
    <div
      role="option"
      tabIndex={-1}
      aria-selected={!!props.selected}
      class="app-popover__option"
      onClick={() => props.onSelect()}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        props.onSelect();
      }}
    >
      {props.children}
    </div>
  );
}
