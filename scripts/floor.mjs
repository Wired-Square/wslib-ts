// Runs the kit's, the canvas's, the icons' Solid, the store's and appliance-ui's tests, and the consumer fixture, at the
// oldest versions their peer and dependency ranges claim, each installed into a
// temp copy so the repo's tree is untouched. appliance-ui takes the kit and
// appliance-types packed while the workspace sits at their floor, so the kit's
// source resolves solid-js from the temp copy, not the repo; past it, from the
// registry.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const solid = { "solid-js": "1.9.11", "vite-plugin-solid": "2.11.10", "babel-preset-solid": "1.9.10" };

const sets = [
  {
    name: "kit",
    floor: { ...solid, vitest: "4.1.2", vite: "6.4.1" },
    tools: ["jsdom", "typescript", "@types/node"],
    entries: ["src", "test", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts"],
    test: ["npx", ["vitest", "run"]],
    fixture: { FIXTURE_KIT_ONLY: "1" },
  },
  {
    name: "canvas",
    floor: { ...solid, react: "19.0.0", "react-dom": "19.0.0" },
    tools: ["jsdom", "typescript", "@types/node", "@types/react", "@types/react-dom", "vitest", "vite"],
    entries: ["src", "test", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts"],
    test: ["npx", ["vitest", "run"]],
    fixture: { FIXTURE_KIT_ONLY: "1" },
  },
  {
    name: "icons",
    floor: solid,
    tools: ["jsdom", "typescript", "@types/node", "vitest", "vite"],
    entries: ["src", "test", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts"],
    test: ["npx", ["vitest", "run", "test/solid.test.tsx"]],
    fixture: { FIXTURE_KIT_ONLY: "1" },
  },
  {
    name: "store",
    floor: { ...solid, react: "19.0.0", "react-dom": "19.0.0" },
    tools: ["jsdom", "typescript", "@types/node", "@types/react", "@types/react-dom", "vitest", "vite"],
    entries: ["src", "test", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts"],
    test: ["npx", ["vitest", "run"]],
    fixture: { FIXTURE_KIT_ONLY: "1" },
  },
  {
    name: "appliance-ui",
    floor: { ...solid, vite: "8.0.0", uqr: "0.1.3" },
    tools: ["typescript", "@types/node", "vitest"],
    siblings: { "@wired-square/kit": "0.3.5", "@wired-square/appliance-types": "0.1.0" },
    entries: ["src", "test", "tsconfig.json", "tsconfig.build.json"],
    test: ["node", ["--test", "test/*.test.ts"]],
  },
];

const repo = resolve(import.meta.dirname, "..");

for (const set of sets) {
  const root = mkdtempSync(join(tmpdir(), `${set.name}-floor-`));
  const work = join(root, "packages", set.name);
  const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: work, stdio: "inherit", ...options });
  try {
    cpSync(join(repo, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
    for (const entry of set.entries) cpSync(join(repo, "packages", set.name, entry), join(work, entry), { recursive: true });
    const { name, type, exports, devDependencies } = JSON.parse(readFileSync(join(repo, "packages", set.name, "package.json"), "utf8"));
    const tools = Object.fromEntries(set.tools.map((dep) => [dep, devDependencies[dep]]));
    const siblings = Object.fromEntries(
      Object.entries(set.siblings ?? {}).map(([dep, version]) => {
        const workspace = JSON.parse(readFileSync(join(repo, "packages", dep.split("/")[1], "package.json"), "utf8")).version;
        if (workspace !== version) return [dep, version];
        const tarball = execFileSync("npm", ["pack", "--silent", "--pack-destination", root, "-w", dep], { cwd: repo, encoding: "utf8" }).trim();
        return [dep, `file:${join(root, tarball)}`];
      }),
    );
    writeFileSync(join(work, "package.json"), JSON.stringify({ name, type, exports, devDependencies: { ...tools, ...siblings, ...set.floor } }));

    // Without --legacy-peer-deps, npm 10 crashes resolving vitest's optional peers.
    run("npm", ["install", "--legacy-peer-deps", "--no-audit", "--no-fund", "--loglevel", "error"], {
      env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --use-system-ca` },
    });
    for (const dep of Object.keys(set.floor)) {
      const { version } = JSON.parse(readFileSync(join(work, "node_modules", dep, "package.json"), "utf8"));
      if (version !== set.floor[dep]) throw new Error(`${dep} installed at ${version}, not ${set.floor[dep]}`);
    }
    console.log(`${set.name} floor: ${Object.entries(set.floor).map(([dep, v]) => `${dep}@${v}`).join(", ")}`);
    run("npx", ["tsc", "-p", "tsconfig.build.json"]);
    run("npx", ["tsc", "-p", "."]);
    run("npx", ["tsc", "-p", "test"]);
    run(...set.test);
    run("node", [join(repo, "scripts/fixture.mjs")], { cwd: repo, env: { ...process.env, ...set.fixture, KIT_MODULES: join(work, "node_modules") } });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
