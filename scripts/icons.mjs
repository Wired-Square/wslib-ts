// Writes the icons' names, their Solid glyphs, preview.svg and kit's default
// glyphs from packages/icons/glyphs; --check fails when a checked-in file
// differs from what it would write, and --dist builds the sprite and the glyph
// files into packages/icons/dist.
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fail } from "./files.mjs";

const repo = join(import.meta.dirname, "..");
const icons = join(repo, "packages/icons");
const STROKE = 'fill="none" stroke="currentColor" style="stroke-width: var(--icon-stroke, 2)" stroke-linecap="round" stroke-linejoin="round"';
const SVG_PROPS = `viewBox="0 0 24 24" width="1em" height="1em" ${STROKE}`;

const glyphs = readdirSync(join(icons, "glyphs"))
  .filter((file) => file.endsWith(".svg"))
  .sort()
  .map((file) => {
    const name = file.slice(0, -4);
    const svg = readFileSync(join(icons, "glyphs", file), "utf8");
    const body = svg.match(/^<svg[^>]*>([\s\S]*)<\/svg>\s*$/)[1].split("\n").map((line) => line.trim()).filter(Boolean);
    return { name, camel: name.replace(/-(\w)/g, (_, c) => c.toUpperCase()), body };
  });

const indent = (lines, by) => lines.map((line) => `${" ".repeat(by)}${line}`).join("\n");
const banner = "// Written by scripts/icons.mjs from packages/icons/glyphs; the gates fail when it differs.\n";

const names = `${banner}export const ICON_NAMES = [
${glyphs.map(({ name }) => `  "${name}",`).join("\n")}
] as const;

export type IconName = (typeof ICON_NAMES)[number];
`;

const solid = `${banner}import type { JSX } from "solid-js";

export type IconProps = JSX.SvgSVGAttributes<SVGSVGElement>;

const Glyph = (props: IconProps) => <svg aria-hidden="true" ${SVG_PROPS} {...props} />;
${glyphs
  .map(
    ({ camel, body }) => `
export const ${camel} = (props: IconProps = {}) => (
  <Glyph {...props}>
${indent(body, 4)}
  </Glyph>
);`,
  )
  .join("\n")}
`;

const KIT = { schemeSystem: "scheme-system", schemeLight: "sun", schemeDark: "moon", copy: "copy", clear: "clear", chevron: "chevron-down", more: "more" };
const kit = `${banner}import type { JSX } from "solid-js";

const glyph = (children: JSX.Element) => (
  <svg aria-hidden="true" ${SVG_PROPS}>
    {children}
  </svg>
);

export const glyphs = {
${Object.entries(KIT)
  .map(([slot, name]) => {
    const { body } = glyphs.find((glyph) => glyph.name === name);
    return body.length === 1 ? `  ${slot}: () => glyph(${body[0]}),` : `  ${slot}: () =>\n    glyph(\n      <>\n${indent(body, 8)}\n      </>,\n    ),`;
  })
  .join("\n")}
};
`;

const COLUMNS = 7;
const CELL = { width: 96, height: 80 };
const rows = Math.ceil(glyphs.length / COLUMNS);
const at = (i) => ({ x: (i % COLUMNS) * CELL.width, y: Math.floor(i / COLUMNS) * CELL.height });
const preview = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLUMNS * CELL.width} ${rows * CELL.height}" width="${COLUMNS * CELL.width}" height="${rows * CELL.height}" style="color-scheme: light dark; color: CanvasText">
  <g ${STROKE}>
${glyphs
  .map(({ body }, i) => {
    const { x, y } = at(i);
    return `    <svg x="${x + 32}" y="${y + 14}" width="32" height="32" viewBox="0 0 24 24">\n${indent(body, 6)}\n    </svg>`;
  })
  .join("\n")}
  </g>
  <g fill="currentColor" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="12" text-anchor="middle">
${glyphs
  .map(({ name }, i) => {
    const { x, y } = at(i);
    return `    <text x="${x + CELL.width / 2}" y="${y + 66}">${name}</text>`;
  })
  .join("\n")}
  </g>
</svg>
`;

const generated = {
  "packages/icons/src/index.ts": names,
  "packages/icons/src/solid.tsx": solid,
  "packages/icons/preview.svg": preview,
  "packages/kit/src/glyphs.tsx": kit,
};

if (process.argv.includes("--dist")) {
  const dist = join(icons, "dist");
  mkdirSync(dist, { recursive: true });
  cpSync(join(icons, "glyphs"), join(dist, "glyphs"), { recursive: true });
  const symbols = glyphs.map(({ name, body }) => `  <symbol id="icon-${name}" viewBox="0 0 24 24" ${STROKE}>\n${indent(body, 4)}\n  </symbol>`);
  writeFileSync(join(dist, "sprite.svg"), `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join("\n")}\n</svg>\n`);
} else if (process.argv.includes("--check")) {
  fail(
    "differs from packages/icons/glyphs — run node scripts/icons.mjs",
    Object.entries(generated).filter(([file, text]) => readFileSync(join(repo, file), "utf8") !== text).map(([file]) => file),
  );
} else {
  for (const [file, text] of Object.entries(generated)) writeFileSync(join(repo, file), text);
}
