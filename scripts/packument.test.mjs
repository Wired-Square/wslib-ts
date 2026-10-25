import { deepEqual } from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { withManifest } from "./packument.mjs";

const manifest = {
  name: "@wired-square/example",
  version: "1.0.0",
  license: "MIT",
  repository: { type: "git", url: "github:Wired-Square/wslib-ts", directory: "packages/example" },
  type: "module",
  exports: { ".": "./index.js" },
  peerDependencies: { "solid-js": "^1.9.11", vitest: "^4.0.0" },
  peerDependenciesMeta: { vitest: { optional: true } },
};

const dist = { integrity: "sha512-x", shasum: "x", tarball: "https://mirror.example.com/npm/@wired-square/example/-/example-1.0.0.tgz" };

// As Forgejo serves it: the meta, exports and type gone, and the repository blanked.
const forgejo = {
  _id: "@wired-square/example@1.0.0",
  name: "@wired-square/example",
  version: "1.0.0",
  author: { name: "" },
  license: "MIT",
  repository: { type: "", url: "" },
  peerDependencies: { "solid-js": "^1.9.11", vitest: "^4.0.0" },
  readme: "ERROR: No README data found!",
  dist,
};

test("withManifest restores what Forgejo's packument drops from the tarball's package.json, keeping the mirror's dist", () => {
  const work = mkdtempSync(join(tmpdir(), "packument-"));
  try {
    writeFileSync(join(work, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(work, "index.js"), "");
    const file = execFileSync("npm", ["pack", "--silent", "--pack-destination", work], { cwd: work, encoding: "utf8" }).trim();
    deepEqual(withManifest(structuredClone(forgejo), join(work, file)), { ...forgejo, ...manifest, dist });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
