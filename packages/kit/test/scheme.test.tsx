import { beforeEach, expect, test, vi } from "vitest";

import { IconSet, SCHEME_KEY, SchemePicker, applyScheme, chooseScheme, storedScheme } from "../src/index";
import { mount } from "../src/testing";
import { read, rule } from "./css";

type Rule = { selector: string; media?: string; declared: [string, string][] };

function rules(css: string, media?: string): Rule[] {
  const found: Rule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let at = 0;
  while (text.slice(at).trim()) {
    const open = text.indexOf("{", at);
    let depth = 1;
    let close = open + 1;
    for (; depth > 0; close++) depth += text[close] === "{" ? 1 : text[close] === "}" ? -1 : 0;
    const prelude = text.slice(at, open).trim();
    const body = text.slice(open + 1, close - 1);
    if (prelude.startsWith("@media")) {
      found.push(...rules(body, prelude.slice("@media".length).trim()));
    } else {
      const declared = body
        .split(";")
        .filter((line) => line.trim())
        .map((line) => {
          const colon = line.indexOf(":");
          return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] as [string, string];
        });
      found.push({ selector: prelude, ...(media && { media }), declared });
    }
    at = close;
  }
  return found;
}

/** What `:root` declares, in cascade order, with `<html data-app-scheme={attribute}>` on a system preferring `system`. */
function yielded(css: string, attribute: string | undefined, system: "light" | "dark") {
  const matches = (selector: string) => {
    if (selector === ":root") return true;
    const gate = /^:root:where\(\[data-app-scheme(~?)="([^"]+)"\]\)$/.exec(selector);
    if (!gate || attribute === undefined) return false;
    return gate[1] ? attribute.split(/\s+/).includes(gate[2]!) : attribute === gate[2];
  };
  const media = (condition: string | undefined) => condition === undefined || condition === `(prefers-color-scheme: ${system})`;
  return Object.fromEntries(
    rules(css)
      .filter((rule) => media(rule.media) && matches(rule.selector))
      .flatMap((rule) => rule.declared),
  );
}

test("each data-app-scheme yields the light or the dark tokens, and the color-scheme to match", () => {
  const css = read("theme.css");
  const { "color-scheme": _, ...light } = yielded(css, undefined, "light");
  const { "color-scheme": followed, ...dark } = yielded(css, "light dark", "dark");
  expect(followed).toBe("light dark");
  expect(dark["--app-bg"]).not.toBe(light["--app-bg"]);
  expect(dark["--app-accent"]).not.toBe(light["--app-accent"]);

  for (const system of ["light", "dark"] as const) {
    expect(yielded(css, undefined, system), `no attribute, ${system} system`).toEqual(light);
    expect(yielded(css, "light", system), `light, ${system} system`).toEqual({ ...light, "color-scheme": "light" });
    expect(yielded(css, "dark", system), `dark, ${system} system`).toEqual({ ...dark, "color-scheme": "dark" });
  }
  expect(yielded(css, "light dark", "light")).toEqual(light);
});

test("theme.css carries none of the tokens left to an app's shell", () => {
  expect(read("theme.css")).not.toMatch(/--app-(hostname|logo-size|qr-)/);
});

const scheme = () => document.documentElement.getAttribute("data-app-scheme");

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-app-scheme");
});

function blockStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  });
}

test("a browser with nothing stored follows the system, and a choice is kept and applied", () => {
  expect(storedScheme()).toBe("system");
  applyScheme();
  expect(scheme()).toBe("light dark");

  chooseScheme("dark");
  expect(scheme()).toBe("dark");
  expect(storedScheme()).toBe("dark");
  document.documentElement.removeAttribute("data-app-scheme");
  applyScheme();
  expect(scheme()).toBe("dark");

  chooseScheme("light");
  expect(storedScheme()).toBe("light");
  chooseScheme("system");
  expect(scheme()).toBe("light dark");
  expect(storedScheme()).toBe("system");
});

test("a stored value that is no scheme reads as the fallback", () => {
  localStorage.setItem(SCHEME_KEY, "sepia");
  expect(storedScheme()).toBe("system");
  expect(storedScheme("dark")).toBe("dark");
});

test("an app's fallback stands in for empty and blocked storage, and a stored choice beats it", () => {
  expect(storedScheme("dark")).toBe("dark");
  localStorage.setItem(SCHEME_KEY, "light");
  expect(storedScheme("dark")).toBe("light");
  blockStorage();
  expect(storedScheme("dark")).toBe("dark");
});

test("blocked storage falls back to the system, and a choice still applies to the page", () => {
  blockStorage();
  expect(storedScheme()).toBe("system");
  applyScheme();
  expect(scheme()).toBe("light dark");
  chooseScheme("dark");
  expect(scheme()).toBe("dark");
  expect(storedScheme()).toBe("system");
});

test("the package root exports the key a page's head script reads", () => {
  expect(SCHEME_KEY).toBe("app-scheme");
});

const ALL = ["System colour scheme", "Light colour scheme", "Dark colour scheme"];

function picker(choices?: Parameters<typeof SchemePicker>[0]["choices"]) {
  const root = mount(() => <SchemePicker {...(choices && { choices })} />);
  const button = (label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const labels = () => [...root.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
  const pressed = () => labels().filter((label) => button(label!)!.getAttribute("aria-pressed") === "true");
  return { root, button, labels, pressed };
}

test("SchemePicker presses the scheme a page ships with, whatever is stored", () => {
  localStorage.setItem(SCHEME_KEY, "light");
  for (const [shipped, pressed] of [
    ["dark", "Dark colour scheme"],
    ["light dark", "System colour scheme"],
    [undefined, "Light colour scheme"],
    ["sepia", "Light colour scheme"],
  ] as const) {
    if (shipped) document.documentElement.setAttribute("data-app-scheme", shipped);
    else document.documentElement.removeAttribute("data-app-scheme");
    expect(picker().pressed(), String(shipped)).toEqual([pressed]);
  }
});

test("SchemePicker's pressed button takes an accent underbar, kept with the focus ring, and Highlight under forced colours", () => {
  const css = read("kit.css");
  const pressed = '.app-scheme-picker .app-btn[aria-pressed="true"]';
  expect(rule(css, pressed)).toMatch(/\n {2}color: var\(--app-text\);[^}]*\n {2}box-shadow: inset 0 -2px 0 var\(--app-accent\);/);
  expect(rule(css, `${pressed}:focus-visible`)).toMatch(/box-shadow: inset 0 -2px 0 var\(--app-accent\), var\(--app-focus\);/);
  expect(css).toMatch(/@media \(forced-colors: active\) \{\s*\.app-scheme-picker \.app-btn\[aria-pressed="true"\] \{[^}]*border-color: Highlight;/);
});

test("SchemePicker presses the applied scheme and applies and keeps the one chosen", () => {
  chooseScheme("light");
  const { root, button, pressed } = picker();
  expect(root.querySelector("[role=group]")!.getAttribute("aria-label")).toBe("Colour scheme");
  expect(pressed()).toEqual(["Light colour scheme"]);

  button("Dark colour scheme")!.click();
  expect(pressed()).toEqual(["Dark colour scheme"]);
  expect(scheme()).toBe("dark");
  expect(storedScheme()).toBe("dark");
});

test("SchemePicker offers all three schemes by default, and only the choices it is given, in their order", () => {
  expect(picker().labels()).toEqual(ALL);
  expect(picker(["dark", "light"]).labels()).toEqual(["Dark colour scheme", "Light colour scheme"]);
});

test("SchemePicker draws the glyphs an IconSet gives it", () => {
  const root = mount(() => (
    <IconSet icons={{ schemeDark: () => <span class="moon">dark</span> }}>
      <SchemePicker choices={["light", "dark"]} />
    </IconSet>
  ));
  const [light, dark] = root.querySelectorAll("button");
  expect(light!.querySelector("svg")).not.toBeNull();
  expect(dark!.innerHTML).toBe('<span class="moon">dark</span>');
});
