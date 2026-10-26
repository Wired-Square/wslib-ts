import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "../src");

export const read = (file: string) => readFileSync(join(src, file), "utf8");

export const sourceFiles = () => readdirSync(src);

/** The body of the rule whose selector is exactly `selector`, at the start of a line. */
export function rule(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  if (at < 0) throw new Error(`no rule for ${selector}`);
  return css.slice(at, css.indexOf("}", at));
}

/** The rules inside every `@media (forced-colors: active)` block, outdented so `rule` finds them. */
export const forcedColours = (css: string) =>
  [...css.matchAll(/@media \(forced-colors: active\) \{\n([\s\S]*?)\n\}/g)]
    .map(([, body]) => `\n${body!.replace(/^ {2}/gm, "")}`)
    .join("\n");
