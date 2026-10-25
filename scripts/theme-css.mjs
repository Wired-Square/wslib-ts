// Writes the kit's theme.css from @wired-square/tokens, or with --check fails
// when the checked-in file differs from what it would write.
import { readFileSync, writeFileSync } from "node:fs";

import { groups } from "../packages/tokens/src/tokens.ts";
import { fail } from "./files.mjs";

const FILE = "packages/kit/src/theme.css";

function comment(text, indent) {
  const one = `${indent}/* ${text} */`;
  if (one.length <= 90) return one;
  const lines = [`${indent}/*`];
  for (const word of text.split(" ")) {
    const next = `${lines.at(-1)} ${word}`;
    if (next.length <= 80) lines[lines.length - 1] = next;
    else lines.push(`${indent} * ${word}`);
  }
  return `${lines.join("\n")} */`;
}

const heading = (text) => `  /* --- ${text} ${"-".repeat(65 - text.length)} */`;

const declarations = (scheme, indent) =>
  groups
    .map((group) =>
      Object.entries(group.tokens)
        .filter(([, token]) => token[scheme])
        .map(([name, token]) => `${indent}${name}: ${token[scheme]};`),
    )
    .filter((lines) => lines.length)
    .map((lines) => lines.join("\n"))
    .join("\n\n");

const lightDeclarations = groups
  .map((group) =>
    [
      group.heading && heading(group.heading),
      group.note && comment(group.note, "  "),
      ...Object.entries(group.tokens).flatMap(([name, token]) => [token.note && comment(token.note, "  "), `  ${name}: ${token.light};`]),
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n\n");

const css = `/*
 * The kit's tokens, each with a neutral value. An app restyles the kit by
 * redefining any subset in a stylesheet imported after this one, or at runtime
 * with \`applyTheme\`. No component names a colour, so these are the only values
 * there are.
 *
 * The palette is deliberately anonymous: an app still looking like this has not
 * been branded, and that should be obvious.
 */

:root {
${lightDeclarations}
}

/*
 * The dark palette, for a page that opts in with \`data-app-scheme="light dark"\`
 * while the system prefers dark, or forces it with \`data-app-scheme="dark"\`.
 * \`:where\` keeps an app's own \`:root\` rule, imported after this file, winning;
 * an app that redefines one of these tokens redefines its dark value too.
 */
@media (prefers-color-scheme: dark) {
  :root:where([data-app-scheme~="dark"]) {
    color-scheme: light dark;

${declarations("dark", "    ")}
  }
}

/* The block above, forced; a test holds the tokens equal. */
:root:where([data-app-scheme="dark"]) {
  color-scheme: dark;

${declarations("dark", "  ")}
}

:root:where([data-app-scheme="light"]) {
  color-scheme: light;
}

.numeric {
  font-variant-numeric: tabular-nums;
}
`;

if (!process.argv.includes("--check")) writeFileSync(FILE, css);
else fail(`${FILE} differs from @wired-square/tokens — run node scripts/theme-css.mjs`, readFileSync(FILE, "utf8") === css ? [] : [FILE]);
