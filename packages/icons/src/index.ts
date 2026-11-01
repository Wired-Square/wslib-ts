// Written by scripts/icons.mjs from packages/icons/glyphs; the gates fail when it differs.
export const ICON_NAMES = [
  "alert",
  "bang",
  "check",
  "chevron",
  "clear",
  "cloud",
  "copy",
  "database",
  "info",
  "lock",
  "moon",
  "more",
  "overcast",
  "pencil",
  "plus",
  "scheme-system",
  "sun",
  "timer",
  "trash",
  "unlock",
  "x",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
