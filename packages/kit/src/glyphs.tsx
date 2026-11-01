// Written by scripts/icons.mjs from packages/icons/glyphs; the gates fail when it differs.
import type { JSX } from "solid-js";

const glyph = (children: JSX.Element) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" style="stroke-width: var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round">
    {children}
  </svg>
);

export const glyphs = {
  schemeSystem: () =>
    glyph(
      <>
        <rect x="3" y="4" width="18" height="12" rx="1.5"/>
        <path d="M10 16l-1 4h6l-1-4"/>
      </>,
    ),
  schemeLight: () =>
    glyph(
      <>
        <circle style="stroke: var(--icon-sun, currentColor)" cx="12" cy="12" r="4.25"/>
        <path style="stroke: var(--icon-sun, currentColor)" d="M12 3v3.25M12 17.75V21M3 12h3.25M17.75 12H21M5.64 5.64l2.3 2.3M16.06 16.06l2.3 2.3M18.36 5.64l-2.3 2.3M7.94 16.06l-2.3 2.3"/>
      </>,
    ),
  schemeDark: () => glyph(<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>),
  copy: () =>
    glyph(
      <>
        <rect x="8" y="8" width="13" height="13" rx="2"/>
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
      </>,
    ),
  clear: () => glyph(<path d="M7 7l10 10M17 7 7 17"/>),
  chevron: () => glyph(<path d="M5 8.75 12 15.25 19 8.75"/>),
  more: () =>
    glyph(
      <>
        <circle cx="12" cy="5.5" r="1.25"/>
        <circle cx="12" cy="12" r="1.25"/>
        <circle cx="12" cy="18.5" r="1.25"/>
        <path d="M12 5.5h.01M12 12h.01M12 18.5h.01"/>
      </>,
    ),
};
