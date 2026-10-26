import { createContext, useContext } from "solid-js";
import type { JSX } from "solid-js";

export interface KitIcons {
  schemeSystem: () => JSX.Element;
  schemeLight: () => JSX.Element;
  schemeDark: () => JSX.Element;
  /** `NothingYet`'s picture. */
  empty: () => JSX.Element;
  /** `Menu`'s trigger, when it is given none. */
  more: () => JSX.Element;
  /** `CopyButton`'s glyph. */
  copy: () => JSX.Element;
  /** `SearchInput`'s clear button. */
  clear: () => JSX.Element;
}

const defaults: KitIcons = {
  schemeSystem: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  ),
  schemeLight: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  schemeDark: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  ),
  empty: () => (
    <svg
      aria-hidden="true"
      viewBox="0 0 96 96"
      width="96"
      height="96"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14 52 26 26h44l12 26" />
      <path d="M14 52v18a4 4 0 0 0 4 4h60a4 4 0 0 0 4-4V52H62a14 14 0 0 1-28 0Z" />
      <path d="M36 40h24" opacity="0.5" />
    </svg>
  ),
  more: () => "⋮",
  copy: () => (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
    </svg>
  ),
  clear: () => (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    >
      <path d="m4 4 8 8m0-8-8 8" />
    </svg>
  ),
};

const Icons = createContext(defaults);

export const useIcons = () => useContext(Icons);

/** The glyphs the kit draws below it: `icons` over the nearest outer set. */
export function IconSet(props: { icons: Partial<KitIcons>; children: JSX.Element }) {
  return <Icons.Provider value={{ ...useIcons(), ...props.icons }}>{props.children}</Icons.Provider>;
}
