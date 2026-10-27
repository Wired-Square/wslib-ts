import { deepEqual } from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const src = new URL("../src/", import.meta.url);
const generated = readdirSync(new URL("generated", src), { recursive: true })
  .map((file) => String(file).replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -".ts".length));

test("the barrel re-exports every generated file, constants as values and the rest as types", () => {
  const lines = new Set(readFileSync(new URL("index.ts", src), "utf8").split(/\r?\n/));
  const exportLine = (name: string) => `${name === "constants" ? "export *" : "export type *"} from "./generated/${name}.js";`;
  deepEqual(generated.filter((name) => !lines.has(exportLine(name))), []);
});

test("no generated type is a bigint, which JSON cannot carry", () => {
  deepEqual(generated.filter((name) => /\bbigint\b/.test(readFileSync(new URL(`generated/${name}.ts`, src), "utf8"))), []);
});

