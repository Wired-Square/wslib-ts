# wslib-ts

Wired Square's shared TypeScript packages, as npm workspaces.

| Package | What |
|---|---|
| [`@wired-square/kit`](packages/kit) | SolidJS components, the `--app-*` tokens they read, and test helpers |
| [`@wired-square/tokens`](packages/tokens) | The `--app-*` tokens' names and defaults, as TypeScript and JSON |
| [`@wired-square/mcp-bridge`](packages/mcp-bridge) | The page half of wslib-mcp's `dom` tools, and their bridge over Tauri events |
| [`@wired-square/appliance-types`](packages/appliance-types) | The appliance's wire types and limits, generated from wslib-rs's `wslib-appliance-types` |
| [`@wired-square/appliance-ui`](packages/appliance-ui) | The appliance's browser half: the shell, the Settings screens and their parts, and test helpers |

## `@wired-square/kit`

### Install

The package is published to the Forgejo registry. Point the scope at it in the app's `.npmrc`:

```ini
@wired-square:registry=https://forge.wiredsquare.com/api/packages/wired-square/npm/
```

Reads need a `read:package` Forgejo token, kept machine-wide in `~/.npmrc`:

```sh
npm config set -- '//forge.wiredsquare.com/api/packages/wired-square/npm/:_authToken' <token>
```

The host must trust the CA that signs `forge.wiredsquare.com`. Node keeps its own CA store, so point it at the
system's with `NODE_OPTIONS=--use-system-ca` (Node 22.15 or later), or at the CA with `NODE_EXTRA_CA_CERTS`.

Off the network, and in CI, read the read-only mirror instead, with its own token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

Its tarballs keep the `integrity` Forgejo gave them, so a lockfile's pins hold on either. Prefer the mirror: it
restores the `peerDependenciesMeta` Forgejo drops, without which a lockfile records optional peers as required. Each
package's `publishConfig.registry` names Forgejo only because that is where a release publishes.

npm 10's `npm install` can fail with "Cannot read properties of null (reading 'edgesOut')" over the optional `vitest`
peer. `npm ci` and npm 11 are unaffected.

```sh
npm install @wired-square/kit solid-js
```

It ships TSX source behind a `solid` export condition. `vite-plugin-solid` finds it, compiles it with the app and keeps
it out of vite's pre-bundler, so the app's vite config needs nothing beyond the plugin:

```ts
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({ plugins: [solid()] });
```

When trying a local checkout through `link:` or `file:`, add `resolve: { dedupe: ["solid-js"] }`. A linked package
resolves `solid-js` from its own directory, and two copies of Solid are two reactive graphs.

### Styles

Import the tokens, then the components' styles, once, in the entry module:

```ts
import "@wired-square/kit/theme.css";
import "@wired-square/kit/kit.css";
```

No component names a colour, and neither file loads a font or a URL, so a strict CSP needs no `unsafe-inline` for
styles.

`kit.css` puts every rule in the cascade layer `kit`, a public name that will not change. An app's own unlayered rules
beat the kit's whatever their specificity, and a rule the app adds to `@layer kit` sits at the kit's precedence instead.
That includes element rules: a global `input { padding: … }` or `button { … }` undoes the kit's sizing, such as the
room `SearchInput` keeps for its Clear button. Put such resets in a layer declared before the kit's,
`@layer reset, kit;`, so the kit wins over them. Drop any unlayered override written against the old order at the
same time: a leftover `.app-btn:focus-visible { box-shadow: none }` then removes the kit's only focus ring.

`CopyButton`'s negative inline margin lines its value up with plain text, but a shrink-to-fit parent, such as a flex
item sized by its content, then comes out 12px narrower than the button and wraps short values mid-word. Let such a
parent take the space instead: `flex: 1; min-width: 0`.

### Browsers

`Menu` and `Popover` stand on the `popover` attribute, which sets the floor at WebKit 17 (Safari 17, and a WKWebView on
the same).

### The three seams

**Tokens.** Every value the kit draws is an `--app-*` custom property defined in `theme.css`. Restyle by redefining any
subset in a stylesheet imported after it, with dark values under both of `theme.css`'s dark selectors. The colour scheme
is `<html data-app-scheme>`: `applyScheme()` before `render` applies the stored choice (`storedScheme(fallback)` names
the default), and `SchemePicker` offers the `choices` given, all three by default.

**`applyTheme(tokens, darkTokens?)`** applies token values at runtime as one adopted stylesheet, replaced on each call.
A token set inline on `<html>`, by `documentElement.style.setProperty` say, beats that sheet, so an app that applies its
theme that way should switch to `applyTheme`.

**`IconSet`** replaces the glyphs the kit draws: `schemeSystem`, `schemeLight`, `schemeDark`, `empty` (`NothingYet`),
`more` (`Menu`'s trigger) and `copy` (`CopyButton`). Each is a `() => JSX.Element`, and a nested set merges over the
outer one.

```tsx
<IconSet icons={{ schemeDark: () => <MoonIcon /> }}>
  <App />
</IconSet>
```

### Errors

Throw `Refusal` with a sentence written for a person, and `Form`, `Confirm`, `createAction`, `Loaded`,
`ScreenBoundary` and `PendingChange` show it as it is. Anything else thrown shows a fixed sentence and is logged. Mark a
request nothing answered with `new Refusal(message, { unanswered: true })`. A transport's own error class can extend
`Refusal`.

### Plain node

`@wired-square/kit/core` is compiled JavaScript, so node imports it without a bundler: `Refusal`, `refusalMessage`,
`unanswered`, the formatters (with `formatWhen`), `placePopover`, `duration`, `cx`, `unchanged`, the `Pending` types, and the scheme and theme functions.
It is the same module the components import, so a `Refusal` from either entry is one class.

### Testing

With vitest and jsdom, name the setup in `setupFiles`, then mount and find things by their words:

```ts
// vitest.config.ts
test: { environment: "jsdom", setupFiles: ["@wired-square/kit/testing/setup"] }
```

```tsx
import { button, mount, text } from "@wired-square/kit/testing";

mount(() => <Settings />, { wrap: (screen) => <Router>{screen()}</Router> });
button("Save").click();
```

A helper that puts its own provider around a caller's `wrap` passes it as `around`, and `mount` still returns what
`wrap` yields.

## `@wired-square/tokens`

The kit's `--app-*` tokens with their light and dark defaults, as data, installed from the same registry. It has no
dependencies and no peers.

```ts
import { applyTheme } from "@wired-square/kit";
import type { Tokens } from "@wired-square/tokens";

const brand = { "--app-accent": "#0b5cad" } satisfies Partial<Tokens>;
applyTheme(brand);
```

`light` and `dark` hold the defaults, `groups` the same tokens in `theme.css`'s groups with their notes, and
`@wired-square/tokens/tokens.json` maps each name to `{ "light": "…", "dark"?: "…" }`.

## `@wired-square/mcp-bridge`

The page half of wslib-mcp's `dom` and `tauri-bridge` features, installed from the same registry. It has no
dependencies; `@tauri-apps/api` 2 is an optional peer, needed only by `./tauri-bridge`.

```ts
import "@wired-square/mcp-bridge/dom-ops";
import { startHarnessBridge } from "@wired-square/mcp-bridge/tauri-bridge";

await startHarnessBridge({ navigate: ({ path }) => router.navigate(String(path)) });
```

`startHarnessBridge(appOps?)` answers each `harness:request` `{ id, op, args }` with a `harness:reply` `{ id, ok }` or
`{ id, error }`, trying the app's own ops before the DOM ops. Over another transport, hand each request to
`answer(request, appOps?)`, or to `runDomOp(op, args)` from `./dom-ops`.

Importing `./dom-ops` wraps `console.error` and `console.warn` and listens for `window` `error` and
`unhandledrejection`, keeping the last 200 for the `console` op, so import it before anything that can fail.

The contract with the Rust half is data: `DOM_OPS` lists the ops, `DOM_OP_CLASS` marks each `read` or `drive`, and
`REQUEST_EVENT` and `REPLY_EVENT` name the events.

## `@wired-square/appliance-types`

The TypeScript that ts-rs writes for wslib-rs's `wslib-appliance-types`, at the crate tag pinned in
`scripts/appliance-types-sync.mjs`, installed from the same registry. It has no dependencies and no peers.

```ts
import { ROLE_LADDER, type Role } from "@wired-square/appliance-types";
```

Every type is exported from the root, along with the crate's limits in `constants`. The files under `src/generated/`
are never edited by hand: `node scripts/appliance-types-sync.mjs` rewrites them from the pinned tag, and `--check`
fails naming any that have drifted. Both need the network and cargo, so neither runs in `scripts/ci.sh`.

## `@wired-square/appliance-ui`

The appliance's browser half, installed from the same registry: the shell, the Settings screens and their parts, and
test helpers. Its peers are the kit ^0.3.1, appliance-types ^0.1.0, solid-js ^1.9.11 and, for `./vite` only, vite
^8.0.0. `uqr`, its QR encoder, comes with it. Like the kit, it ships TSX behind the `solid` condition, so the app
installs `vite-plugin-solid` ^2.11.10 too.

```sh
npm install @wired-square/appliance-ui @wired-square/appliance-types @wired-square/kit solid-js
npm install -D vite vite-plugin-solid
```

`applianceVite` sets `base: "./"` for the daemon's `<base href>` and writes a `.gz` beside each compressible file;
the app passes Solid's plugin. `applianceProxy(target?)` proxies `/api` and `/healthz` to a development stand-in for
the console, `http://127.0.0.1:8080` by default:

```ts
import { applianceProxy, applianceVite } from "@wired-square/appliance-ui/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(applianceVite({ plugins: [solid()], server: { proxy: applianceProxy() } }));
```

The components import no CSS. Import, once and in this order:

```ts
import "@wired-square/kit/theme.css";
// the app's own token overrides
import "@wired-square/kit/kit.css";
import "@wired-square/appliance-ui/shell.css"; // only if the app mounts `Shell` or `Chrome`
import "@wired-square/appliance-ui/appliance.css";
```

`Chrome` reads `GET /api/switcher` at the origin root, whatever the app's base, and given two or more `AppLink`s
shows a menu beside the hostname, named for the app whose `href` is the longest prefix of the page's path. Choosing
another loads its `href`. Any failure, a 401 included, leaves the masthead without one and signs nobody out.

Wire types and limits are imported from `@wired-square/appliance-types`; this package does not re-export them.
That includes `Pending` and its parts, which the kit also declares, with the same shape, for its own components.
`./testing` and `./testing/setup` are the kit's test helpers with a session around the screen.

## Development

The repo's tooling needs Node 22.18 or later, which runs TypeScript tests without a build.

```sh
npm install
scripts/ci.sh
```

`scripts/ci.sh` is the CI definition: the lockfile, the commit-message and dossier gates, no runtime dependencies in
the packages but appliance-ui's `uqr`, no peers in tokens or appliance-types and only the optional `@tauri-apps/api` in mcp-bridge, then `npm run check`. `--tag` adds `npm run floor`. Run it before every push,
once per clone:

```sh
git config core.hooksPath scripts/hooks
```

`npm run floor` (needs the network) reruns the typecheck, the tests and the fixture in a temp install of the oldest
versions the ranges claim, once per package: for the kit, solid-js 1.9.11, vitest 4.1.2, vite 6.4.1, and
vite-plugin-solid 2.11.10 with babel-preset-solid 1.9.10; for appliance-ui, the same Solid floors, vite 8.0.0, uqr
0.1.3, and the kit and appliance-types packed from this checkout, which must be at 0.3.1 and 0.1.0. The kit's run
leaves appliance-ui out of the fixture.

`check` builds `dist/` (the kit's compiled `./core`, the tokens, mcp-bridge, appliance-types and appliance-ui's
`./vite`, which `npm pack` builds too), then runs the gates (no name of another repository, no colour literal outside
`theme.css` and the token values, and `theme.css` as `scripts/theme-css.mjs` writes it from `packages/tokens`), the
typecheck, the tests, and a build of `fixtures/consumer` through `applianceVite` against the packed kit and
appliance-ui, with the packed tokens, mcp-bridge, appliance-types and appliance-ui's `./vite` imported in plain node
and appliance-types typechecked under NodeNext.

## Releasing a package

Bump the package's `version` and give `CHANGELOG.md` a heading for it in the PR. Once that is merged, on `main`, with
`.env` filled in from `.env.example`:

```sh
scripts/release.sh kit --execute
git push origin kit-v<version>
scripts/mirror.sh
```

`scripts/release.sh` runs `scripts/ci.sh --tag`, packs the package, reads the `write:package` token from 1Password at
`WSLIB_REGISTRY_TOKEN_REF` (so it never sits on disk, and no build script sees it), publishes, and tags
`<package>-v<version>`. Without `--execute` it stops before publishing. The tag records what was published; consumers
pin the registry version, not the tag. `scripts/mirror.sh` copies every package on the registry to the mirror, with
each `dist.tarball` rewritten onto the mirror's host and each tarball checked against its `integrity`; `--dry-run`
shows what would change.
