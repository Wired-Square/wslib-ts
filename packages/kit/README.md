# @wired-square/kit

SolidJS components for Wired Square's browser apps, the `--app-*` tokens they read (`theme.css`) and their styles
(`kit.css`), an error seam (`Refusal`), formatters, and helpers for testing under vitest and jsdom. No component names
a colour: every value it draws is a token, so an app restyles by redefining tokens, with `applyTheme`, or with
`IconSet` for the glyphs.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/kit solid-js
```

npm 10's `npm install` can fail with "Cannot read properties of null (reading 'edgesOut')" over the optional `vitest`
peer. `npm ci` and npm 11 are unaffected.

## Entry points

| Subpath | What |
|---|---|
| `.` | The components and their helpers, as TSX |
| `./core` | Compiled JavaScript with no JSX, for plain node: `Refusal`, `refusalMessage`, `unanswered`, the formatters, `formatWhen`, `placePopover`, `duration`, `cx`, `unchanged`, the `Pending` types, and the scheme and theme functions |
| `./testing` | `mount`, `unmountAll`, `button`, `field`, `type` and `text`, as TSX |
| `./testing/setup` | A vitest `setupFiles` entry for jsdom, as TSX |
| `./theme.css` | The `--app-*` tokens |
| `./kit.css` | The components' styles, in the cascade layer `kit` |

`.`, `./testing` and `./testing/setup` ship TSX source behind a `solid` export condition. `vite-plugin-solid` finds
it, compiles it with the app and keeps it out of vite's pre-bundler, so the app's vite config needs nothing beyond the
plugin:

```ts
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({ plugins: [solid()] });
```

When trying a local checkout through `link:` or `file:`, add `resolve: { dedupe: ["solid-js"] }`. A linked package
resolves `solid-js` from its own directory, and two copies of Solid are two reactive graphs.

`./core` is the same module the components import, so a `Refusal` from either entry is one class.

## Styles

Import the tokens, then the components' styles, once, in the entry module; no component imports its own CSS:

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

## Browsers

`Menu` and `Popover` stand on the `popover` attribute, which sets the floor at WebKit 17 (Safari 17, and a WKWebView on
the same).

## The three seams

**Tokens.** Every value the kit draws is an `--app-*` custom property defined in `theme.css`. Restyle by redefining any
subset in a stylesheet imported after it, with dark values under both of `theme.css`'s dark selectors. The colour scheme
is `<html data-app-scheme>`: `applyScheme()` before `render` applies the stored choice (`storedScheme(fallback)` names
the default), and `SchemePicker` offers the `choices` given, all three by default.

**`applyTheme(tokens, darkTokens?)`** applies token values at runtime as one adopted stylesheet, replaced on each call.
A token set inline on `<html>`, by `documentElement.style.setProperty` say, beats that sheet, so an app that applies its
theme that way should switch to `applyTheme`.

**`IconSet`** replaces the glyphs the kit draws: `schemeSystem`, `schemeLight`, `schemeDark`, `empty` (`NothingYet`),
`more` (`Menu`'s trigger), `copy` (`CopyButton`), `clear` (`SearchInput`'s clear button and `Dialog`'s close button),
`chevron` (after a `Menu` trigger given `chevron`) and `check` (a checked `MenuItemCheckbox` or `MenuItemRadio`). Each
is a `() => JSX.Element`, and a nested set merges over the outer one.

```tsx
<IconSet icons={{ schemeDark: () => <MoonIcon /> }}>
  <App />
</IconSet>
```

## Errors

Throw `Refusal` with a sentence written for a person, and `Form`, `Confirm`, `createAction`, `Loaded`,
`ScreenBoundary` and `PendingChange` show it as it is. Anything else thrown shows a fixed sentence and is logged. Mark a
request nothing answered with `new Refusal(message, { unanswered: true })`. A transport's own error class can extend
`Refusal`.

## Testing

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

## Peers

- `solid-js` ^1.9.11
- `vitest` ^4.0.0 || ^5.0.0, optional, for `./testing` and `./testing/setup`

## Moved names

- From `@wired-square/appliance-ui` (the 0.17.x installed from git) to here, and `./core`, in its 0.1.0: `Refusal` and
  `refusalMessage`.
