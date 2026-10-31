// Rewrites appliance-ui's src/serial/generated from the pinned crate tag, or
// from a local checkout at a rev, and records the source in its SOURCE file;
// with --check fails naming each file that has drifted from it. ci.sh --tag
// refuses a SOURCE other than the tag. It needs cargo, and the network unless
// --from is given.
//
//   node scripts/serial-console-sync.mjs [--check] [--from <checkout> <rev>]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { fail } from "./files.mjs";

const TAG = "wslib-serial-console-v0.1.1";
const REMOTE = "git@github.com:Wired-Square/wslib-rs.git";
const CRATE = "wslib-serial-console";

const generated = resolve(import.meta.dirname, "../packages/appliance-ui/src/serial/generated");
const args = process.argv.slice(2);
const check = args.includes("--check");
const at = args.indexOf("--from");
const from = at < 0 ? undefined : args.slice(at + 1, at + 3);
if (from && from.length < 2) fail("usage", ["--from <checkout> <rev>"]);
const work = mkdtempSync(join(tmpdir(), "serial-console-"));
const clone = join(work, "wslib-rs");
const output = join(work, "generated");

const files = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).map((file) => file.replaceAll("\\", "/")) : []);
const git = (...args) => execFileSync("git", ["-c", "advice.detachedHead=false", ...args], { encoding: "utf8" }).trim();

try {
  let source = TAG;
  if (from) {
    git("clone", "--quiet", "--no-hardlinks", resolve(from[0]), clone);
    git("-C", clone, "checkout", "--quiet", from[1]);
    source = `local ${git("-C", clone, "rev-parse", "HEAD")}`;
  } else {
    git("clone", "--quiet", "--depth", "1", "--branch", TAG, REMOTE, clone);
  }
  execFileSync("cargo", ["test", "--quiet", "-p", CRATE, "--features", "ts"], {
    cwd: clone,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, TS_RS_EXPORT_DIR: output },
  });
  writeFileSync(join(output, "SOURCE"), `${source}\n`);

  if (check) {
    const drifted = [...new Set([...files(output), ...files(generated)])]
      .filter((file) => !existsSync(join(output, file)) || !existsSync(join(generated, file)) || !readFileSync(join(output, file)).equals(readFileSync(join(generated, file))))
      .sort();
    fail(`src/serial/generated differs from ${source}; run node scripts/serial-console-sync.mjs`, drifted);
    console.log(`serial-console: src/serial/generated matches ${source}`);
  } else {
    rmSync(generated, { recursive: true, force: true });
    cpSync(output, generated, { recursive: true });
    console.log(`serial-console: wrote ${files(generated).length - 1} files from ${source}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
