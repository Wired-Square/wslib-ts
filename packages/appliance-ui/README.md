# @wired-square/appliance-ui

The appliance's browser half, built on `@wired-square/kit`: the shell and its masthead with the app switcher, the
Settings screens and their parts, a shared serial console, the request and live-feed helpers, a vite config for the
appliance, and test helpers. Wire types and limits are imported from `@wired-square/appliance-types`, and not re-exported here.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/appliance-ui @wired-square/appliance-types @wired-square/kit solid-js
npm install -D vite vite-plugin-solid
```

## Entry points

| Subpath | What |
|---|---|
| `.` | The shell, the screens, their parts, `SerialConsole`, and the request, feed and access helpers, as TSX |
| `./testing` | The kit's `mount` inside a session (`admin` by default), and the sessions `admin`, `behindConsole`, `signedIn` and `viewerSignedIn`, as TSX |
| `./testing/setup` | The kit's vitest `setupFiles` entry, and an `EventSource` that never connects, as TSX |
| `./vite` | `applianceVite` and `applianceProxy`, compiled JavaScript with types |
| `./shell.css` | The styles for `Shell` and `Chrome` |
| `./appliance.css` | The screens' and parts' styles |

`.`, `./testing` and `./testing/setup` ship TSX source behind a `solid` export condition, so the app compiles them
with `vite-plugin-solid` ^2.11.10, passed to `applianceVite({ plugins: [solid()] })`. The components import no CSS;
import, once and in this order, `@wired-square/kit/theme.css`, the app's own token overrides,
`@wired-square/kit/kit.css`, `./shell.css` (only if the app mounts `Shell` or `Chrome`) and `./appliance.css`.

## Vite

`applianceVite` sets `base: "./"` for the daemon's `<base href>` and writes a `.gz` beside each compressible file;
the app passes Solid's plugin. `applianceProxy(target?)` proxies `/api`, `/healthz` and `/ws`, its sockets included,
to a development stand-in for the console, `http://127.0.0.1:8080` by default:

```ts
import { applianceProxy, applianceVite } from "@wired-square/appliance-ui/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(applianceVite({ plugins: [solid()], server: { proxy: applianceProxy() } }));
```

## The app switcher

`Chrome` reads `GET /api/switcher` at the origin root, whatever the app's base, and given two or more `AppLink`s
shows a menu beside the hostname, named for the app whose `href` is the longest prefix of the page's path. Choosing
another loads its `href`. Any failure, a 401 included, leaves the masthead without one and signs nobody out.

## Peers

- `@wired-square/kit` ^0.4.0
- `@wired-square/appliance-types` ^0.1.0
- `solid-js` ^1.9.11
- `vite` ^8.0.0, optional, for `./vite` only

`uqr` ^0.1.3, its QR encoder, is its one dependency.

## Moved names

In 0.1.0, from this package (the 0.17.x installed from git):

- The wire types and constants, to `@wired-square/appliance-types`, whose README lists them.
- `Refusal` and `refusalMessage`, to `@wired-square/kit` and `@wired-square/kit/core`.
- `theme.css`'s six tokens, to `@wired-square/tokens` 0.2.0; `@wired-square/kit/theme.css` defines them from 0.3.1.

A lockfile from the git install still holds `@wired-square/appliance-ui@0.17.x`, and npm fails with `ERESOLVE`
against the kit peer until it goes: delete its `node_modules/@wired-square/appliance-ui` entry from
`package-lock.json`, or `npm uninstall @wired-square/appliance-ui` first, then install.
