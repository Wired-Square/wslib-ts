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

`.`, `./testing` and `./testing/setup` ship TSX source behind a `solid` export condition, which `vite-plugin-solid`
finds and compiles with the app. Import `theme.css`, then `kit.css`, once, in the entry module; no component imports
its own CSS.

## Peers

- `solid-js` ^1.9.11
- `vitest` ^4.0.0 || ^5.0.0, optional, for `./testing` and `./testing/setup`

## Moved names

- From `@wired-square/appliance-ui` (the 0.17.x installed from git) to here, and `./core`, in its 0.1.0: `Refusal` and
  `refusalMessage`.
