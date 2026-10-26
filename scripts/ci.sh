#!/usr/bin/env bash
# The CI definition. The pre-push hook, the release script and a future Actions
# workflow call this rather than restating it. --tag adds the peer-floor check,
# which needs the network.
#
#   scripts/ci.sh [--tag]
set -euo pipefail
cd "$(dirname "$0")/.."

all=false
[[ ${1:-} == --tag ]] && all=true

die() { printf 'ci: %s\n' "$*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

step "Installed packages match the lockfile"
npm ls --all >/dev/null || die "node_modules is out of step with package-lock.json: npm ci"

step "No other repository is named in a commit message"
! git log --format=%B | grep -nIiE -f scripts/forbidden-names.txt || die "say 'a prior appliance' instead"

step "No reference to the project dossier"
! git grep -nIE --untracked '\[\[[A-Za-z][^]]*\]\]' -- ':!scripts/ci.sh' || die "the dossier is cited; state the constraint here"

step "The packages have no runtime dependencies, tokens no peers, and mcp-bridge one optional peer"
node -e 'const [kit, tokens, bridge] = ["kit", "tokens", "mcp-bridge"].map((name) => require(`./packages/${name}/package.json`));
const declared = { ...kit.dependencies, ...tokens.dependencies, ...tokens.peerDependencies, ...bridge.dependencies };
const tauriOnly = Object.keys(bridge.peerDependencies).join() === "@tauri-apps/api" && bridge.peerDependenciesMeta["@tauri-apps/api"].optional;
process.exit(Object.keys(declared).length || !tauriOnly ? 1 : 0)' \
  || die "a package declares dependencies, tokens declares peers, or mcp-bridge a peer beyond optional @tauri-apps/api"

step "Build, gates, typecheck, tests and the consumer fixture"
npm run check

if $all; then
  step "Peer floors"
  npm run floor
fi

printf '\nci: ok\n'
