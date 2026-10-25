import { deepEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { dark, groups, light } from "../src/tokens.ts";

type Defaults = { light: string; dark?: string };

const json: Record<string, Defaults> = JSON.parse(readFileSync(new URL("../dist/tokens.json", import.meta.url), "utf8"));
const values = (scheme: keyof Defaults) =>
  Object.fromEntries(Object.entries(json).filter(([, token]) => token[scheme]).map(([name, token]) => [name, token[scheme]]));

test("tokens.json gives each token in groups its light value, and its dark one where it has one", () => {
  const source = groups.flatMap((group) => Object.entries(group.tokens) as [string, Defaults][]);
  deepEqual(json, Object.fromEntries(source.map(([name, { light, dark }]) => [name, dark ? { light, dark } : { light }])));
});

test("light and dark hold the same values as tokens.json", () => {
  deepEqual(light, values("light"));
  deepEqual(dark, values("dark"));
});
