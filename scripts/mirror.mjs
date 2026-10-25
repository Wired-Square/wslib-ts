// Copies every package in the Forgejo npm registry to a read-only mirror, with
// each tarball URL rewritten onto the mirror, since npm sends the mirror's token
// only to its own host. A tarball already on the mirror is never rewritten.
// Settings come from .env (see .env.example).
//
//   scripts/mirror.sh [--dry-run]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
const setting = (key) => process.env[key] || die(`set ${key} in .env`);
const forge = setting("WSLIB_FORGE_URL");
const owner = setting("WSLIB_FORGE_OWNER");
const dest = setting("WSLIB_MIRROR_DEST");
const mirror = setting("WSLIB_NPM_MIRROR_URL");
if (!/[:/]$/.test(dest)) die("WSLIB_MIRROR_DEST must end in : or /");
if (!mirror.endsWith("/")) die("WSLIB_NPM_MIRROR_URL must end in /");
const dryRun = process.argv.includes("--dry-run");

function die(message) {
  console.error(`mirror: ${message}`);
  process.exit(1);
}

const token = execFileSync("op", ["read", setting("WSLIB_REGISTRY_TOKEN_REF")], { encoding: "utf8" }).trim();
async function get(url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) die(`${url}: ${response.status}`);
  return response;
}

const names = new Set();
for (let page = 1; ; page++) {
  const batch = await (await get(`${forge}/api/v1/packages/${owner}?type=npm&limit=50&page=${page}`)).json();
  if (batch.length === 0) break;
  for (const { name } of batch) names.add(name);
}
if (names.size === 0) die("the registry lists no packages");

const stage = mkdtempSync(join(tmpdir(), "mirror-"));
try {
  for (const name of names) {
    const packument = await (await get(`${forge}/api/packages/${owner}/npm/${name.replace("/", "%2f")}`)).json();
    for (const [version, { dist }] of Object.entries(packument.versions)) {
      const file = decodeURIComponent(new URL(dist.tarball).pathname.split("/").pop());
      const tarball = Buffer.from(await (await get(dist.tarball)).arrayBuffer());
      const integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
      const shasum = createHash("sha1").update(tarball).digest("hex");
      if (integrity !== dist.integrity || shasum !== dist.shasum) die(`${name} ${version} does not match its packument`);
      const path = join(stage, name, "-", file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, tarball);
      dist.tarball = `${mirror}${name}/-/${file}`;
    }
    writeFileSync(join(stage, name, "index.json"), JSON.stringify(packument));
    console.log(`mirror: ${name}`);
  }

  const rsync = (...args) =>
    execFileSync("rsync", ["-rt", ...(dryRun ? ["--dry-run", "--itemize-changes"] : []), ...args, `${stage}/`, dest], {
      stdio: "inherit",
    });
  // Tarballs before packuments, so no packument names a tarball the mirror lacks.
  rsync("--ignore-existing", "--exclude=index.json");
  rsync("--include=*/", "--include=index.json", "--exclude=*");
} finally {
  rmSync(stage, { recursive: true, force: true });
}
