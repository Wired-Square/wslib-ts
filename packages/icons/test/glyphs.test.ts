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

const turns = {
  half: ([x, y]: number[]) => [24 - x!, 24 - y!],
  clockwise: ([x, y]: number[]) => [24 - y!, x!],
  anticlockwise: ([x, y]: number[]) => [y!, 24 - x!],
};

test.each([
  ["chevron-up", "chevron-down", turns.half],
  ["chevron-left", "chevron-down", turns.clockwise],
  ["chevron-right", "chevron-down", turns.anticlockwise],
  ["arrow-left", "arrow-right", turns.half],
  ["arrow-down", "arrow-right", turns.clockwise],
  ["arrow-up", "arrow-right", turns.anticlockwise],
] as const)("%s is %s turned about the centre", (name, base, turn) => {
  const points = (glyph: string) =>
    [...sources.find((source) => source.name === glyph)!.doc.querySelectorAll("path")].map((path) => {
      const flat = path.getAttribute("d")!.slice(1).split(" ").map(Number);
      return flat.flatMap((_, i) => (i % 2 ? [] : [flat.slice(i, i + 2)]));
    });
  const rounded = (paths: number[][][]) => paths.map((path) => path.map((point) => point.map((v) => Math.round(v * 100) / 100)));
  expect(points(name)).toEqual(rounded(points(base).map((path) => path.map(turn))));
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
