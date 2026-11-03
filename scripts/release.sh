#!/bin/sh
# Tags packages on main as <package>-v<version> and pushes the tags, then
# publishes them with the publish token from .env and mirrors the registry;
# reads elsewhere use the read token in ~/.npmrc. Only the packages named are
# released; with none it lists those whose version the registry lacks. Without
# --execute it stops before tagging, and with --no-mirror after publishing.
#
#   scripts/release.sh kit|tokens|mcp-bridge|appliance-types|appliance-ui|canvas|chart ... [--execute] [--no-mirror]
# Lists of names and tags are split on purpose.
# shellcheck disable=SC2086
set -eu
cd "$(dirname "$0")/.."
die() { printf 'release: %s\n' "$*" >&2; exit 1; }
say() { printf 'release: %s\n' "$*"; }
[ -e .env ] && eval "$(cat .env)"

execute=false mirror=true names=
for arg; do
  case $arg in
    --execute) execute=true ;;
    --no-mirror) mirror=false ;;
    -*) die "unknown option $arg" ;;
    *) [ -f "packages/$arg/package.json" ] || die "no package at packages/$arg"; names="$names $arg" ;;
  esac
done

[ "$(git branch --show-current)" = main ] || die "release from main, after the PR is merged"
[ -z "$(git status --porcelain)" ] || die "commit or stash first"
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main is not origin/main"

field() { node -p "require('./packages/$1/package.json').$2"; }
on_registry() {
  [ -n "$(NODE_OPTIONS=--use-system-ca npm view "@wired-square/$1@$(field "$1" version)" version \
    --@wired-square:registry="$(field "$1" publishConfig.registry)" 2>/dev/null)" ]
}

if [ -z "$names" ]; then
  for dir in packages/*/; do
    name=$(basename "$dir")
    on_registry "$name" || say "not on the registry: $name $(field "$name" version)"
  done
  die "name the packages to release"
fi

for name in $names; do
  version=$(field "$name" version)
  ! on_registry "$name" || die "@wired-square/$name $version is already on the registry"
  ! git rev-parse -q --verify "refs/tags/$name-v$version" >/dev/null || die "$name-v$version already exists"
  awk -v pkg="## \`@wired-square/$name\`" -v ver="### $version" '/^## /{here = $0 == pkg} here && $0 == ver{found = 1} END{exit !found}' CHANGELOG.md \
    || die "CHANGELOG.md has no heading for $version under @wired-square/$name"
done

# Read before the CI run so a wrong setting fails at once. Never exported, so
# nothing the run starts sees it.
if $execute; then
  token=${WSLIB_REGISTRY_TOKEN:?set in .env}
fi

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
log=$(mktemp "${TMPDIR:-/tmp}/release-ci.XXXXXX")
say "releasing$names; ci.sh --tag logs to $log"
scripts/ci.sh --tag >"$log" 2>&1 || { tail -n 40 "$log" >&2; die "ci.sh --tag failed; the full log is $log"; }

for name in $names; do
  (cd "packages/$name" && npm pack -q --pack-destination "$stage" >/dev/null)
done
$execute || { say "dry run; would publish $(cd "$stage" && echo *.tgz)"; rm "$log"; exit 0; }

umask 077
tags=
for name in $names; do
  version=$(field "$name" version)
  git tag -s -m "$name $version" "$name-v$version"
  tags="$tags $name-v$version"
done
# Pushed before publishing, so nothing is ever published without its tag on
# main. The pre-push hook runs ci.sh again.
git push -q origin $tags >>"$log" 2>&1 || { git tag -d $tags >/dev/null; die "pushing$tags failed, so nothing is published; see $log"; }
say "pushed$tags"

pending=$tags
for name in $names; do
  version=$(field "$name" version)
  registry=$(field "$name" publishConfig.registry)
  printf '%s:_authToken=%s\n' "${registry#https:}" "$token" >"$stage/npmrc"
  if ! NODE_OPTIONS=--use-system-ca npm publish "$stage/wired-square-$name-$version.tgz" --registry "$registry" \
    --userconfig "$stage/npmrc" >>"$log" 2>&1; then
    git tag -d $pending >/dev/null
    git push -q origin --delete $pending >>"$log" 2>&1 || say "withdrawing$pending from origin failed; delete them there"
    [ "$pending" = "$tags" ] || ! $mirror || scripts/mirror.sh
    die "publishing $name failed, so$pending are withdrawn; see $log"
  fi
  say "published @wired-square/$name $version"
  pending=${pending#" $name-v$version"}
done
! $mirror || scripts/mirror.sh
rm "$log"
