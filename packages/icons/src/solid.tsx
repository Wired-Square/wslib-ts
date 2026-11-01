// Written by scripts/icons.mjs from packages/icons/glyphs; the gates fail when it differs.
import type { JSX } from "solid-js";

export type IconProps = JSX.SvgSVGAttributes<SVGSVGElement>;

const Glyph = (props: IconProps) => <svg aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" style="stroke-width: var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round" {...props} />;

export const alert = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M12 3 21 21H3Z"/>
    <path d="M12 10v5"/>
    <path d="M12 18h.01"/>
  </Glyph>
);

export const bang = (props: IconProps = {}) => (
  <Glyph {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v5"/>
    <path d="M12 16.5h.01"/>
  </Glyph>
);

export const check = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M20 6 9 17l-5-5"/>
  </Glyph>
);

export const chevron = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="m6 9 6 6 6-6"/>
  </Glyph>
);

export const clear = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M6 6l12 12M18 6 6 18"/>
  </Glyph>
);

export const cloud = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path style="stroke: var(--icon-cloud, currentColor)" d="M7 19a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.75 4.75 0 0 1 0 9.5z"/>
  </Glyph>
);

export const copy = (props: IconProps = {}) => (
  <Glyph {...props}>
    <rect x="8" y="8" width="13" height="13" rx="2"/>
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
  </Glyph>
);

export const database = (props: IconProps = {}) => (
  <Glyph {...props}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3"/>
    <path d="M4 5.5v13c0 1.66 3.58 3 8 3s8-1.34 8-3v-13"/>
    <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>
  </Glyph>
);

export const info = (props: IconProps = {}) => (
  <Glyph {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 11v5"/>
    <path d="M12 7.5h.01"/>
  </Glyph>
);

export const lock = (props: IconProps = {}) => (
  <Glyph {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
  </Glyph>
);

export const moon = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>
  </Glyph>
);

export const more = (props: IconProps = {}) => (
  <Glyph {...props}>
    <circle cx="12" cy="5" r="1"/>
    <circle cx="12" cy="12" r="1"/>
    <circle cx="12" cy="19" r="1"/>
  </Glyph>
);

export const overcast = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path style="stroke: var(--icon-sun, currentColor)" d="M6.12 10.99A3.5 3.5 0 0 1 11.78 6.88"/>
    <path style="stroke: var(--icon-sun, currentColor)" d="M9 2v1.5M2 9h1.5M4.05 4.05l1.06 1.06M13.95 4.05l-1.06 1.06M3.75 13.65l1.06-1.06"/>
    <path style="stroke: var(--icon-cloud, currentColor)" d="M8.5 21a3.5 3.5 0 0 1-.5-6.96A4.75 4.75 0 0 1 17.2 12.5a4.25 4.25 0 0 1 .3 8.5z"/>
  </Glyph>
);

export const pencil = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
  </Glyph>
);

export const plus = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M12 5v14M5 12h14"/>
  </Glyph>
);

export const schemeSystem = (props: IconProps = {}) => (
  <Glyph {...props}>
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8m-4-4v4"/>
  </Glyph>
);

export const sun = (props: IconProps = {}) => (
  <Glyph {...props}>
    <circle style="stroke: var(--icon-sun, currentColor)" cx="12" cy="12" r="4.25"/>
    <path style="stroke: var(--icon-sun, currentColor)" d="M12 3v3.25M12 17.75V21M3 12h3.25M17.75 12H21M5.64 5.64l2.3 2.3M16.06 16.06l2.3 2.3M18.36 5.64l-2.3 2.3M7.94 16.06l-2.3 2.3"/>
  </Glyph>
);

export const timer = (props: IconProps = {}) => (
  <Glyph {...props}>
    <circle cx="12" cy="13.5" r="7.5"/>
    <path d="M10 2.5h4M12 2.5V6M12 13.5V10M18.5 6.5l-1.3 1.3"/>
  </Glyph>
);

export const trash = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M3 6h18"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </Glyph>
);

export const unlock = (props: IconProps = {}) => (
  <Glyph {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V7a4 4 0 0 1 7.75-1.4"/>
  </Glyph>
);

export const x = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </Glyph>
);
