# @wired-square/tokens

The `--app-*` tokens that `@wired-square/kit` draws with, as data: each token's light default and, where it has one,
its dark, the `TokenName` and `Tokens` types for `satisfies`, and `groups`, the same tokens in `theme.css`'s groups
with their notes. The kit's `theme.css` is written from it.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/tokens
```

## Entry points

| Subpath | What |
|---|---|
| `.` | `light`, `dark`, `groups`, `TokenName` and `Tokens`, compiled JavaScript with types |
| `./tokens.json` | Each name mapped to `{ "light": "…", "dark"?: "…" }` |

```ts
import { applyTheme } from "@wired-square/kit";
import type { Tokens } from "@wired-square/tokens";

applyTheme({ "--app-accent": "#0b5cad" } satisfies Partial<Tokens>);
```

## Peers

None, and no dependencies.

## Moved names

- From `@wired-square/appliance-ui`'s `theme.css` (removed in its 0.1.0) to here, from 0.2.0: `--app-hostname`,
  `--app-hostname-contrast`, `--app-qr-dark`, `--app-qr-light`, `--app-logo-size` and `--app-logo-size-welcome`.
  `@wired-square/kit/theme.css` defines them from kit 0.3.1.
