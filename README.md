# wslib-ts

Wired Square's shared TypeScript packages, as npm workspaces.

| Package | What |
|---|---|
| [`@wired-square/kit`](packages/kit) | SolidJS components, the `--app-*` tokens they read, and test helpers |
| [`@wired-square/tokens`](packages/tokens) | The `--app-*` tokens' names and defaults, as TypeScript and JSON |

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

Its tarballs keep the `integrity` Forgejo gave them, so a lockfile's pins hold on either.

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

## Development

```sh
npm install
scripts/ci.sh
```

`scripts/ci.sh` is the CI definition: the lockfile, the commit-message and dossier gates, no runtime dependencies in
the packages and no peers in tokens, then `npm run check`. `--tag` adds `npm run floor`. Run it before every push,
once per clone:

```sh
git config core.hooksPath scripts/hooks
```

`npm run floor` (needs the network) reruns the typecheck, the tests and the fixture in a temp install of the oldest
versions the peer ranges claim: solid-js 1.9.11, vitest 4.1.2, vite 6.4.1, and vite-plugin-solid 2.11.10 with
babel-preset-solid 1.9.10.

`check` builds `dist/` (the compiled `./core`, which `npm pack` builds too), then runs the gates (no name of another
repository, and no colour literal outside a `theme.css`), the typecheck, the tests, and a build of `fixtures/consumer`
against the packed kit.

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
