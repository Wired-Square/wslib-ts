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

export const arrowDown = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M12 4.75 12 19.25"/>
    <path d="M17.6 14.05 12 19.25 6.4 14.05"/>
  </Glyph>
);

export const arrowLeft = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M19.25 12 4.75 12"/>
    <path d="M9.95 17.6 4.75 12 9.95 6.4"/>
  </Glyph>
);

export const arrowRight = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M4.75 12 19.25 12"/>
    <path d="M14.05 6.4 19.25 12 14.05 17.6"/>
  </Glyph>
);

export const arrowUp = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M12 19.25 12 4.75"/>
    <path d="M6.4 9.95 12 4.75 17.6 9.95"/>
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
    <path d="M4.5 13 9.5 18 19.5 5.5"/>
  </Glyph>
);

export const chevronDown = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M5 8.75 12 15.25 19 8.75"/>
  </Glyph>
);

export const chevronLeft = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M15.25 5 8.75 12 15.25 19"/>
  </Glyph>
);

export const chevronRight = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M8.75 19 15.25 12 8.75 5"/>
  </Glyph>
);

export const chevronUp = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M19 15.25 12 8.75 5 15.25"/>
  </Glyph>
);

export const clear = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M7 7l10 10M17 7 7 17"/>
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

export const gauge = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M4.21 18.5A9 9 0 1 1 19.79 18.5"/>
    <circle cx="12" cy="14" r="1"/>
    <path d="M12 14l4.25-4.25"/>
  </Glyph>
);

export const info = (props: IconProps = {}) => (
  <Glyph {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M10.5 11H12v5.5"/>
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
    <circle cx="12" cy="5.5" r="1.25"/>
    <circle cx="12" cy="12" r="1.25"/>
    <circle cx="12" cy="18.5" r="1.25"/>
    <path d="M12 5.5h.01M12 12h.01M12 18.5h.01"/>
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
    <path d="M15.5 5 19 8.5 9.5 18 4.5 19.5 6 14.5z"/>
    <path d="M13.5 7l3.5 3.5"/>
  </Glyph>
);

export const plus = (props: IconProps = {}) => (
  <Glyph {...props}>
    <path d="M12 4.5v15M4.5 12h15"/>
  </Glyph>
);

export const schemeSystem = (props: IconProps = {}) => (
  <Glyph {...props}>
    <rect x="3" y="4" width="18" height="12" rx="1.5"/>
    <path d="M10 16l-1 4h6l-1-4"/>
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
    <path d="M4 6.5h16"/>
    <path d="M9.5 6.5v-2h5v2"/>
    <path d="M6 6.5 7 20h10l1-13.5"/>
    <path d="M10 10.5v6M14 10.5v6"/>
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
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>
  </Glyph>
);
