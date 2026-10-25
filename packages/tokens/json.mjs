import { writeFileSync } from "node:fs";

import { dark, light } from "./dist/tokens.js";

const tokens = Object.fromEntries(
  Object.entries(light).map(([name, value]) => [name, name in dark ? { light: value, dark: dark[name] } : { light: value }]),
);
writeFileSync("dist/tokens.json", `${JSON.stringify(tokens, null, 2)}\n`);
