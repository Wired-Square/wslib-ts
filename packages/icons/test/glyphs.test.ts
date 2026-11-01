import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

import { ICON_NAMES } from "../src/index";

const root = join(import.meta.dirname, "..");
const ROOT_ATTRIBUTES =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="stroke-width: var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round"';
const GEOMETRY = new Set(["d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height"]);
const PART = /^stroke: var\(--icon-[a-z]+(-[a-z]+)*, currentColor\)$/;

const sources = readdirSync(join(root, "glyphs")).map((file) => ({
  name: file.replace(/\.svg$/, ""),
  doc: new DOMParser().parseFromString(readFileSync(join(root, "glyphs", file), "utf8"), "image/svg+xml"),
}));

test("ICON_NAMES lists every source glyph, and only those", () => {
  expect([...ICON_NAMES].sort()).toEqual(sources.map(({ name }) => name).sort());
  expect(ICON_NAMES.every((name) => /^[a-z]+(-[a-z]+)*$/.test(name))).toBe(true);
});

test.each(sources)("$name is on the 24 grid with the one overridable stroke, and its shapes carry geometry and a colour part alone", ({ doc }) => {
  const svg = doc.documentElement;
  expect(svg.tagName).toBe("svg");
  expect([...svg.attributes].map(({ name, value }) => `${name}="${value}"`).join(" ")).toBe(ROOT_ATTRIBUTES);
  const shapes = [...svg.querySelectorAll("*")];
  expect(shapes.length).toBeGreaterThan(0);
  for (const shape of shapes) {
    expect(["path", "circle", "rect", "ellipse"]).toContain(shape.tagName);
    for (const { name, value } of shape.attributes) {
      if (name === "style") expect(value).toMatch(PART);
      else expect(GEOMETRY).toContain(name);
    }
  }
});

test("every --icon- colour part falls back to currentColor", () => {
  const raw = readdirSync(join(root, "glyphs")).map((file) => readFileSync(join(root, "glyphs", file), "utf8")).join("\n");
  const colours = [...raw.matchAll(/var\((--icon-[a-z-]+)([^)]*)\)/g)].filter(([, name]) => name !== "--icon-stroke");
  expect(new Set(colours.map(([, name]) => name))).toEqual(new Set(["--icon-sun", "--icon-cloud"]));
  for (const [, , fallback] of colours) expect(fallback).toBe(", currentColor");
});

test("the built sprite holds exactly one symbol per glyph, each drawn as its source with the stroke on the symbol", () => {
  const sprite = new DOMParser().parseFromString(readFileSync(join(root, "dist/sprite.svg"), "utf8"), "image/svg+xml");
  const symbols = [...sprite.documentElement.children];
  expect(symbols.map((symbol) => symbol.tagName)).toEqual(ICON_NAMES.map(() => "symbol"));
  expect(symbols.map((symbol) => symbol.id)).toEqual(ICON_NAMES.map((name) => `icon-${name}`));
  for (const { name, doc } of sources) {
    const symbol = sprite.getElementById(`icon-${name}`)!;
    for (const attribute of ["viewBox", "fill", "stroke", "style", "stroke-linecap", "stroke-linejoin"]) {
      expect(symbol.getAttribute(attribute)).toBe(doc.documentElement.getAttribute(attribute));
    }
    expect(symbol.innerHTML.replace(/\s+/g, "")).toBe(doc.documentElement.innerHTML.replace(/\s+/g, "").replaceAll(' xmlns="http://www.w3.org/2000/svg"', ""));
  }
  expect(readdirSync(join(root, "dist/glyphs")).sort()).toEqual(ICON_NAMES.map((name) => `${name}.svg`));
});
