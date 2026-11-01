import { render } from "solid-js/web";
import { afterEach, expect, test } from "vitest";

import { ICON_NAMES } from "../src/index";
import * as glyphs from "../src/solid";

const SVG = "http://www.w3.org/2000/svg";
const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

const mount = (view: () => unknown) => {
  const root = document.body.appendChild(document.createElement("div"));
  disposers.push(render(view as () => Element, root));
  return root;
};

const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

test("there is one Solid glyph per name, camelCased", () => {
  expect(Object.keys(glyphs).sort()).toEqual(ICON_NAMES.map(camel).sort());
});

test.each(ICON_NAMES)("%s renders a hidden 1em svg on the 24 grid, its shapes in the SVG namespace", (name) => {
  const svg = mount(glyphs[camel(name) as keyof typeof glyphs]).querySelector("svg")!;
  expect(svg.namespaceURI).toBe(SVG);
  expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
  expect(svg.getAttribute("width")).toBe("1em");
  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.getAttribute("stroke")).toBe("currentColor");
  expect(svg.getAttribute("style")).toMatch(/stroke-width: ?var\(--icon-stroke, 2\)/);
  expect(svg.children.length).toBeGreaterThan(0);
  for (const shape of svg.children) expect(shape.namespaceURI).toBe(SVG);
});

test("a glyph's props reach its svg, over the defaults", () => {
  const svg = mount(() => glyphs.check({ class: "big", width: "2em", "aria-hidden": false, "aria-label": "Saved", role: "img" })).querySelector("svg")!;
  expect(svg.getAttribute("class")).toBe("big");
  expect(svg.getAttribute("width")).toBe("2em");
  expect(svg.getAttribute("aria-label")).toBe("Saved");
  expect(svg.getAttribute("aria-hidden")).toBe("false");
});
