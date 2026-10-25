import { expect, test } from "vitest";

import { applyScheme, applyTheme } from "../src/index";
import type { Scheme } from "../src/index";

const sheet = () => document.adoptedStyleSheets[0]!;

/** The light rule's declarations, the followed dark one's and the forced one's, with the selector and condition each is under. */
function declared() {
  const [light, media, forced] = sheet().cssRules as unknown as [CSSStyleRule, CSSMediaRule, CSSStyleRule];
  const dark = media.cssRules[0] as CSSStyleRule;
  const tokens = (style: CSSStyleDeclaration) => Object.fromEntries([...style].map((name) => [name, style.getPropertyValue(name)]));
  return {
    light: [light.selectorText, tokens(light.style)],
    dark: [media.media.mediaText, dark.selectorText, tokens(dark.style)],
    forced: [forced.selectorText, tokens(forced.style)],
  };
}

// jsdom has constructable stylesheets but not `adoptedStyleSheets`. One page
// for the file, as in a browser: `applyTheme` adopts its sheet once.
const adopted: CSSStyleSheet[] = [];
const adoptSheets = () =>
  Object.defineProperty(document, "adoptedStyleSheets", { value: adopted, writable: true, configurable: true });
adoptSheets();

test("applyTheme adopts one stylesheet, replaced on each call, with the dark set where the page opts in or forces it", () => {
  applyTheme({ "--app-accent": "navy" }, { "--app-accent": "skyblue", "--app-bg": "black" });
  expect(document.adoptedStyleSheets).toHaveLength(1);
  expect(declared()).toEqual({
    light: [":root", { "--app-accent": "navy" }],
    dark: [
      "(prefers-color-scheme: dark)",
      ':root:where([data-app-scheme~="dark"])',
      { "--app-accent": "skyblue", "--app-bg": "black" },
    ],
    forced: [':root:where([data-app-scheme="dark"])', { "--app-accent": "skyblue", "--app-bg": "black" }],
  });

  applyTheme({ "--app-accent": "teal" });
  expect(document.adoptedStyleSheets).toHaveLength(1);
  expect(declared()).toEqual({
    light: [":root", { "--app-accent": "teal" }],
    dark: ["(prefers-color-scheme: dark)", ':root:where([data-app-scheme~="dark"])', {}],
    forced: [':root:where([data-app-scheme="dark"])', {}],
  });
});

test("applyTheme declares each token by its own setProperty, so an unclosed value stays in its own property", () => {
  applyTheme({ "--app-a": "calc(1px", "--app-b": "/*", "--app-c": "navy" });
  expect(declared().light[1]).toEqual({ "--app-a": "calc(1px", "--app-b": "/*", "--app-c": "navy" });
});

test("applyTheme's dark set reaches the page exactly where applyScheme's attribute asks for dark", () => {
  applyTheme({ "--app-accent": "navy" }, { "--app-accent": "skyblue" });
  const [light, media, forced] = sheet().cssRules as unknown as [CSSStyleRule, CSSMediaRule, CSSStyleRule];
  const followed = media.cssRules[0] as CSSStyleRule;
  const accent = (system: "light" | "dark") => {
    const root = document.documentElement;
    const applying = [light, ...(system === "dark" && root.matches(followed.selectorText) ? [followed] : []), ...(root.matches(forced.selectorText) ? [forced] : [])];
    return applying.at(-1)!.style.getPropertyValue("--app-accent");
  };

  const cases: [Scheme, string, string][] = [
    ["light", "navy", "navy"],
    ["dark", "skyblue", "skyblue"],
    ["system", "navy", "skyblue"],
  ];
  for (const [scheme, onLight, onDark] of cases) {
    applyScheme(scheme);
    expect([accent("light"), accent("dark")], scheme).toEqual([onLight, onDark]);
  }
});

test("applyTheme sets the light tokens inline on the root, and no dark set, in a browser without adopted stylesheets", () => {
  delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
  try {
    applyTheme({ "--app-accent": "navy" }, { "--app-accent": "skyblue" });
    expect(document.documentElement.style.getPropertyValue("--app-accent")).toBe("navy");
  } finally {
    document.documentElement.removeAttribute("style");
    adoptSheets();
  }
});
