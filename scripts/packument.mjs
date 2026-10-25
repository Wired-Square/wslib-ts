import { execFileSync } from "node:child_process";

/** A packument's version entry with the tarball's own package.json laid over it: Forgejo drops `peerDependenciesMeta`, `exports` and more, and blanks `repository`. */
export function withManifest(entry, tarball) {
  const manifest = JSON.parse(execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8" }));
  return { ...entry, ...manifest, dist: entry.dist };
}
