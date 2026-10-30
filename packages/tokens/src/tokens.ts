type Token = { light: string; dark?: string; note?: string };
type Group = { heading?: string; note?: string; tokens: Record<`--app-${string}`, Token> };

export const groups = [
  {
    heading: "surfaces, back to front",
    tokens: {
      "--app-bg": { light: "#f7f8f9", dark: "#14171a" },
      "--app-surface": { light: "#ffffff", dark: "#1c2024" },
      "--app-surface-sunken": { light: "#eef0f2", dark: "#111316" },
      "--app-border": { light: "#d9dde1", dark: "#30363c" },
      "--app-border-strong": { light: "#b6bec5", dark: "#4a535b" },
    },
  },
  {
    heading: "text",
    tokens: {
      "--app-text": { light: "#1a1f24", dark: "#e4e7ea" },
      "--app-text-muted": { light: "#5b666f", dark: "#9aa4ad" },
      "--app-text-inverted": { light: "#ffffff", dark: "#14171a" },
    },
  },
  {
    heading: "brand",
    tokens: {
      "--app-accent": {
        light: "#4a5568",
        dark: "#a3b1c2",
        note: "`-contrast` goes on top of the accent: a light accent needs dark text, and only the app can know which it chose.",
      },
      "--app-accent-contrast": { light: "#ffffff", dark: "#14171a" },
      "--app-accent-sunken": { light: "#37414f", dark: "#8795a7" },
      "--app-accent-disabled": {
        light: "color-mix(in srgb, var(--app-accent) 55%, var(--app-surface))",
        note: "Solid, where an opacity would show what is behind a disabled primary button.",
      },
      "--app-accent-edge": { light: "color-mix(in srgb, var(--app-accent-sunken) 50%, var(--app-text))" },
    },
  },
  {
    heading: "status",
    note: 'Four tones, not three: "no answer yet" is not a warning, and rendering it as one trains people to ignore amber.',
    tokens: {
      "--app-good": { light: "#2f7a4f", dark: "#5cb98a" },
      "--app-warn": { light: "#9a6114", dark: "#d9a250" },
      "--app-bad": { light: "#b02a2a", dark: "#e46a6a" },
      "--app-neutral": { light: "#78838c", dark: "#8e99a2" },
      "--app-good-bg": { light: "#e8f4ec", dark: "#1b3326" },
      "--app-warn-bg": { light: "#fbf1e0", dark: "#3a2d15" },
      "--app-bad-bg": { light: "#f9e9e9", dark: "#3d1e1e" },
      "--app-neutral-bg": { light: "#eef0f2", dark: "#262b30" },
    },
  },
  {
    note: 'Destructive intent, which an app may want to differ from "bad news".',
    tokens: {
      "--app-alert": { light: "#b02a2a", dark: "#c43c3c" },
      "--app-alert-contrast": { light: "#ffffff" },
      "--app-alert-edge": { light: "color-mix(in srgb, var(--app-alert) 50%, var(--app-text))" },
    },
  },
  {
    heading: "type",
    tokens: {
      "--app-font": { light: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
      "--app-font-mono": { light: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
    },
  },
  {
    heading: "shape",
    tokens: {
      "--app-radius": { light: "0.375rem" },
      "--app-radius-lg": { light: "0.75rem" },
      "--app-field-max": {
        light: "28rem",
        note: "The widest a field's input grows in a bare form; a dialog sets it to `none`.",
      },
      "--app-control-line-height": {
        light: "1.2",
        note: "Shared by buttons and fields, so the two are as tall as each other in a row.",
      },
      "--app-shadow": {
        light: "0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.08)",
        dark: "0 1px 2px rgb(0 0 0 / 0.4), 0 1px 3px rgb(0 0 0 / 0.5)",
      },
      "--app-focus": { light: "0 0 0 3px color-mix(in srgb, var(--app-accent) 35%, transparent)" },
    },
  },
  {
    heading: "appliance",
    note: "The pill naming the box.",
    tokens: {
      "--app-hostname": { light: "var(--app-text)" },
      "--app-hostname-contrast": { light: "var(--app-text-inverted)" },
    },
  },
  {
    note: "A QR code, dark on light in either scheme: not every scanner reads one inverted.",
    tokens: {
      "--app-qr-dark": { light: "#000000" },
      "--app-qr-light": { light: "#ffffff" },
    },
  },
  {
    note: "The logo's height in the masthead, and its cap on the signed-out card.",
    tokens: {
      "--app-logo-size": { light: "2.25rem" },
      "--app-logo-size-welcome": { light: "6rem" },
    },
  },
  {
    note: "The serial console's ANSI blue, magenta and cyan, then who typed what, clear of the status red, green and amber.",
    tokens: {
      "--app-console-accent": { light: "var(--app-accent)" },
      "--app-console-writer-0": { light: "#2457b0", dark: "#7fb2ff" },
      "--app-console-writer-1": { light: "#7038c0", dark: "#c39bff" },
      "--app-console-writer-2": { light: "#b02a7a", dark: "#ff8ad0" },
      "--app-console-writer-3": { light: "#4646c8", dark: "#a3a7ff" },
      "--app-console-writer-4": { light: "#8a2f9e", dark: "#e19bf0" },
      "--app-console-writer-5": { light: "#2f6f9e", dark: "#8fd3ff" },
    },
  },
] as const satisfies readonly Group[];

type KeysOf<T> = T extends unknown ? keyof T : never;
export type TokenName = KeysOf<(typeof groups)[number]["tokens"]>;
export type Tokens = Record<TokenName, string>;

const entries = groups.flatMap((group) => Object.entries(group.tokens)) as [TokenName, Token][];

export const light = Object.fromEntries(entries.map(([name, token]) => [name, token.light])) as Tokens;

export const dark: Partial<Tokens> = Object.fromEntries(
  entries.filter(([, token]) => token.dark).map(([name, token]) => [name, token.dark]),
);
