// Runs the kit's tests and the consumer fixture at the oldest versions its
// peer ranges claim, installed into a temp copy so the repo's tree is untouched.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const floor = { "solid-js": "1.9.11", vitest: "4.1.2", vite: "6.4.1", "vite-plugin-solid": "2.11.10" };

const repo = resolve(import.meta.dirname, "..");
const kit = join(repo, "packages/kit");
const root = mkdtempSync(join(tmpdir(), "kit-floor-"));
const work = join(root, "packages/kit");
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: work, stdio: "inherit", ...options });

try {
  cpSync(join(repo, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  for (const entry of ["src", "test", "tsconfig.json", "vitest.config.ts"]) {
    cpSync(join(kit, entry), join(work, entry), { recursive: true });
  }
  const { name, type, exports, devDependencies } = JSON.parse(readFileSync(join(kit, "package.json"), "utf8"));
  const tools = Object.fromEntries(["jsdom", "typescript", "@types/node"].map((dep) => [dep, devDependencies[dep]]));
  writeFileSync(join(work, "package.json"), JSON.stringify({ name, type, exports, devDependencies: { ...tools, ...floor } }));

  // Without --legacy-peer-deps, npm 10 crashes resolving vitest's optional peers.
  run("npm", ["install", "--legacy-peer-deps", "--no-audit", "--no-fund", "--loglevel", "error"]);
  for (const dep of Object.keys(floor)) {
    const { version } = JSON.parse(readFileSync(join(work, "node_modules", dep, "package.json"), "utf8"));
    if (version !== floor[dep]) throw new Error(`${dep} installed at ${version}, not ${floor[dep]}`);
  }
  console.log(`floor: ${Object.entries(floor).map(([dep, v]) => `${dep}@${v}`).join(", ")}`);
  run("npx", ["tsc", "-p", "."]);
  run("npx", ["tsc", "-p", "test"]);
  run("npx", ["vitest", "run"]);
  run("node", [join(repo, "scripts/fixture.mjs")], { cwd: repo, env: { ...process.env, KIT_MODULES: join(work, "node_modules") } });
} finally {
  rmSync(root, { recursive: true, force: true });
}
