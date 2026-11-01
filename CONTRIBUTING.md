# Contributing to wslib-ts

[README.md](README.md) lists the packages. This file covers working on them: the registry, the gates and releases.

## The registry

A release publishes to the Forgejo registry, and consumers read the mirror. To read Forgejo directly, point the scope
at it in `.npmrc`:

```ini
@wired-square:registry=https://forge.wiredsquare.com/api/packages/wired-square/npm/
```

Reads need a `read:package` Forgejo token, kept machine-wide in `~/.npmrc`:

```sh
npm config set -- '//forge.wiredsquare.com/api/packages/wired-square/npm/:_authToken' <token>
```

Forgejo's packument gives tarball URLs under `/api/packages/Wired-Square/npm/`, and they land in the lockfile. pnpm
matches the token to that path case-sensitively, so without a second line keyed to it the tarballs fail with a 401:

```sh
npm config set -- '//forge.wiredsquare.com/api/packages/Wired-Square/npm/:_authToken' <token>
```

The mirror rewrites tarball URLs onto its own lowercase host, so it needs only the one.

The host must trust the CA that signs `forge.wiredsquare.com`. Node keeps its own CA store, so point it at the
system's with `NODE_OPTIONS=--use-system-ca` (Node 22.15 or later), or at the CA with `NODE_EXTRA_CA_CERTS`. pnpm
checks the lockfile against the registry before every script, so every pnpm script reading Forgejo needs it, not only
an install.

The mirror's tarballs keep the `integrity` Forgejo gave them, so a lockfile's pins hold on either registry. Each
package's `publishConfig.registry` names Forgejo only because that is where a release publishes.

## Development

The repo's tooling needs Node 22.18 or later, which runs TypeScript tests without a build.

```sh
npm install
scripts/ci.sh
```

`scripts/ci.sh` is the CI definition: the lockfile, the commit-message and dossier gates, no runtime dependencies in
the packages but appliance-ui's `uqr`, no peers in tokens, appliance-types or chart, only the optional `@tauri-apps/api` in mcp-bridge and only the optional `solid-js` in canvas and icons, then `npm run check`. `--tag` adds `npm run floor`. Run it before every push,
once per clone:

```sh
git config core.hooksPath scripts/hooks
```

`npm run floor` (needs the network) reruns the typecheck, the tests and the fixture in a temp install of the oldest
versions the ranges claim, once per package: for the kit, solid-js 1.9.11, vitest 4.1.2, vite 6.4.1, and
vite-plugin-solid 2.11.10 with babel-preset-solid 1.9.10; for the canvas and the icons' Solid glyphs, the kit's floors; for appliance-ui, the
same Solid floors, vite 8.0.0, uqr 0.1.3, and the kit 0.3.5 and appliance-types 0.1.0, packed from this checkout
while it is at them and from the registry past them. The kit's and the canvas's runs leave appliance-ui out of the
fixture.

`check` builds `dist/` (the kit's and the canvas's compiled `./core`, the tokens, mcp-bridge, appliance-types, chart, the icons and
appliance-ui's `./vite`, which `npm pack` builds too), then runs the gates (no name of another repository, no colour literal outside
`theme.css` and the token values, `theme.css` as `scripts/theme-css.mjs` writes it from `packages/tokens`, and the icons' generated files and kit's
default glyphs as `scripts/icons.mjs` writes them from `packages/icons/glyphs`), the
typecheck, the tests, and a build of `fixtures/consumer` through `applianceVite` against the packed kit, canvas, icons and
appliance-ui, with the packed tokens, mcp-bridge, appliance-types, chart, icons, the canvas's `./core` and appliance-ui's `./vite` imported in plain node
and appliance-types and chart typechecked under NodeNext.

## Releasing a package

Bump the package's `version` and give `CHANGELOG.md` a heading for it in the PR. Once that is merged, on `main`, with
`.env` filled in from `.env.example`:

```sh
scripts/release.sh kit --execute
```

`scripts/release.sh` releases only the packages named (`scripts/release.sh kit tokens --execute`); with none it lists
those whose version is not on the registry yet and stops. It reads the `write:package` token from 1Password at
`WSLIB_REGISTRY_TOKEN_REF` in the account `WSLIB_OP_ACCOUNT` (so it never sits on disk, and no build script sees it),
runs `scripts/ci.sh --tag` into a log it names, signs a tag `<package>-v<version>` for each package and pushes the tags,
then publishes each package and runs `scripts/mirror.sh`. Pushing the tags first means every published version has its
tag on `main`; when a publish fails, the tags of the packages not yet published are withdrawn. Without `--execute` it
stops before tagging; with `--no-mirror` it stops after publishing. The tag records what was published; consumers pin
the registry version, not the tag. `scripts/mirror.sh` copies every package on the registry to the mirror, with each
`dist.tarball` rewritten onto the mirror's host and each tarball checked against its `integrity`; `--dry-run` shows what
would change.

## appliance-types

`packages/appliance-types` is the TypeScript that ts-rs writes for wslib-rs's `wslib-appliance-types`, at the crate tag
pinned in `scripts/appliance-types-sync.mjs`. The files under `src/generated/` are never edited by hand:
`node scripts/appliance-types-sync.mjs` rewrites them from the pinned tag, and `--check` fails naming any that have
drifted. Both need the network and cargo, so neither runs in `scripts/ci.sh`; GitHub Actions runs `--check` when the
generated files or the script change.
