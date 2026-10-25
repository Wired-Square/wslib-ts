import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { fail, repoFiles } from "./files.mjs";

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|color-mix|oklch)\(/;

// CSS's named colours, in a declaration's value; `transparent`, `currentColor`
// and the forced-colours system colours are not on the list.
const NAMED = new RegExp(
  ":[^;{}]*\\b(" +
    "aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|" +
    "burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|" +
    "darkgoldenrod|darkgr[ae]y|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|" +
    "darksalmon|darkseagreen|darkslateblue|darkslategr[ae]y|darkturquoise|darkviolet|deeppink|deepskyblue|" +
    "dimgr[ae]y|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|" +
    "gr[ae]y|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|" +
    "lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgr[ae]y|lightgreen|lightpink|" +
    "lightsalmon|lightseagreen|lightskyblue|lightslategr[ae]y|lightsteelblue|lightyellow|lime|limegreen|linen|" +
    "magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|" +
    "mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|" +
    "navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|" +
    "papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|" +
    "salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategr[ae]y|snow|springgreen|" +
    "steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen" +
    ")\\b",
  "i",
);

const hits = repoFiles()
  .filter((file) => file.startsWith("packages/kit/src/") && /\.(tsx?|css)$/.test(file) && basename(file) !== "theme.css")
  .flatMap((file) => {
    const css = file.endsWith(".css");
    const text = readFileSync(file, "utf8");
    return (css ? text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")) : text)
      .split("\n")
      .flatMap((line, i) =>
        LITERAL.test(line) || (css && !line.trimStart().startsWith("--") && NAMED.test(line))
          ? [`${file}:${i + 1}: ${line.trim()}`]
          : [],
      );
  });

fail("a colour outside theme.css — every value a component uses must come from a token", hits);
