/** A viewer's colour scheme, kept per origin and set as `<html>`'s `data-app-scheme`. */
export type Scheme = "system" | "light" | "dark";

/** The `localStorage` key, which a page's inline head script reads too. */
export const SCHEME_KEY = "app-scheme";
export const SCHEMES: readonly Scheme[] = ["system", "light", "dark"];

/** The scheme this browser chose, or `fallback` when storage is empty, blocked or holds no scheme. */
export function storedScheme(fallback: Scheme = "system"): Scheme {
  try {
    const stored = localStorage.getItem(SCHEME_KEY);
    return SCHEMES.find((scheme) => scheme === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

/** System is `"light dark"`, so calling this opts the page in. Call it before `render`. */
export function applyScheme(scheme: Scheme = storedScheme()): void {
  document.documentElement.setAttribute("data-app-scheme", scheme === "system" ? "light dark" : scheme);
}

/** Applies `scheme` and keeps it for this browser, where storage allows. */
export function chooseScheme(scheme: Scheme): void {
  applyScheme(scheme);
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    // Applied for this page only.
  }
}
