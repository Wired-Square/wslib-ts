// Rewrites packages/appliance-types/src/generated from the pinned crate tag, or
// with --check fails naming each file that has drifted from it. It needs the
// network and cargo, so CI runs --check in GitHub Actions, not in ci.sh.
//
//   node scripts/appliance-types-sync.mjs [--check]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { fail } from "./files.mjs";

const TAG = "wslib-appliance-types-v0.1.1";
const SOURCE = "git@github.com:Wired-Square/wslib-rs.git";

const generated = resolve(import.meta.dirname, "../packages/appliance-types/src/generated");
const check = process.argv[2] === "--check";
const work = mkdtempSync(join(tmpdir(), "appliance-types-"));
const clone = join(work, "wslib-rs");
const output = join(work, "generated");

const tsFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir, { recursive: true }).map((file) => file.replaceAll("\\", "/")).filter((file) => file.endsWith(".ts")) : [];

try {
  execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--quiet", "--depth", "1", "--branch", TAG, SOURCE, clone], { stdio: "inherit" });
  mkdirSync(output);
  execFileSync("cargo", ["test", "--quiet", "-p", "wslib-appliance-types", "--features", "ts"], {
    cwd: clone,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, TS_RS_EXPORT_DIR: output, TS_RS_IMPORT_EXTENSION: "js" },
  });

  if (check) {
    const drifted = [...new Set([...tsFiles(output), ...tsFiles(generated)])]
      .filter((file) => !existsSync(join(output, file)) || !existsSync(join(generated, file)) || !readFileSync(join(output, file)).equals(readFileSync(join(generated, file))))
      .sort();
    fail(`src/generated differs from ${TAG}; run node scripts/appliance-types-sync.mjs`, drifted);
    console.log(`appliance-types: src/generated matches ${TAG}`);
  } else {
    rmSync(generated, { recursive: true, force: true });
    cpSync(output, generated, { recursive: true });
    console.log(`appliance-types: wrote ${tsFiles(generated).length} files from ${TAG}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
