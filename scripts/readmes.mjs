import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

import { fail } from "./files.mjs";

const workspaces = readdirSync("packages").flatMap((name) => ["-w", `packages/${name}`]);
const packed = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts", ...workspaces], { encoding: "utf8" }),
);

fail(
  "a package's tarball has no README.md",
  packed.filter(({ files }) => !files.some(({ path }) => path === "README.md")).map(({ name }) => name),
);
