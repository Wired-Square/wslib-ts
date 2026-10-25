import { execFileSync } from "node:child_process";

/** Every file git tracks or would track, so ignored ones (node_modules, CLAUDE.md) are not read. */
export function repoFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

export function fail(rule, hits) {
  if (hits.length === 0) return;
  console.error(`${rule}:\n${hits.join("\n")}`);
  process.exit(1);
}
