#!/bin/sh
# Publishes a package from main with the publish token from 1Password and tags
# it <package>-v<version>; reads elsewhere use the read token in ~/.npmrc.
# Without --execute it stops before publishing.
#
#   scripts/release.sh kit [--execute]
set -eu
cd "$(dirname "$0")/.."
die() { printf 'release: %s\n' "$*" >&2; exit 1; }
# shellcheck source=/dev/null
[ -f .env ] && . ./.env

name=${1:?usage: scripts/release.sh <package> [--execute]}
dir=packages/$name
[ -f "$dir/package.json" ] || die "no package at $dir"
[ "$(git branch --show-current)" = main ] || die "release from main, after the PR is merged"
[ -z "$(git status --porcelain)" ] || die "commit or stash first"
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main is not origin/main"

version=$(node -p "require('./$dir/package.json').version")
registry=$(node -p "require('./$dir/package.json').publishConfig.registry")
tag=$name-v$version
! git rev-parse -q --verify "refs/tags/$tag" >/dev/null || die "$tag already exists"
grep -q "^### $version\$" CHANGELOG.md || die "CHANGELOG.md has no heading for $version"

scripts/ci.sh --tag

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
# Packed first, so no build script runs with the token about.
(cd "$dir" && npm pack -q --pack-destination "$stage" >/dev/null)
tarball=$(ls "$stage"/*.tgz)
[ "${2:-}" = --execute ] || { printf 'release: dry run; would publish %s as %s\n' "$(basename "$tarball")" "$tag"; exit 0; }

umask 077
printf '%s:_authToken=%s\n' "${registry#https:}" \
  "$(op read "${WSLIB_REGISTRY_TOKEN_REF:?set to the op:// reference of your publish token}")" >"$stage/npmrc"
git tag -s -m "$name $version" "$tag"
NODE_OPTIONS=--use-system-ca npm publish "$tarball" --registry "$registry" --userconfig "$stage/npmrc" \
  || { git tag -d "$tag" >/dev/null; die "publish failed; $tag removed"; }
printf 'release: published; push the tag: git push origin %s\n' "$tag"
