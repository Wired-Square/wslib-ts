import { createContext, useContext } from "solid-js";
import type { JSX } from "solid-js";

import { glyphs } from "./glyphs";

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
  /** `SearchInput`'s clear button and `Dialog`'s close button. */
  clear: () => JSX.Element;
  /** `Menu`'s, after a trigger given `chevron`. Optional, so a set written before it still type-checks. */
  chevron?: () => JSX.Element;
  /** A checked `MenuItemCheckbox`'s or `MenuItemRadio`'s mark; optional, as `chevron` is. */
  check?: () => JSX.Element;
}

const defaults: Required<KitIcons> = {
  ...glyphs,
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
};

const Icons = createContext<Required<KitIcons>>(defaults);

export const useIcons = () => useContext(Icons);

/** The glyphs the kit draws below it: `icons` over the nearest outer set. */
export function IconSet(props: { icons: Partial<KitIcons>; children: JSX.Element }) {
  return <Icons.Provider value={{ ...useIcons(), ...props.icons }}>{props.children}</Icons.Provider>;
}
