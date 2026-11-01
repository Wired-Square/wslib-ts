# wslib-ts

Wired Square's shared TypeScript packages, published under `@wired-square`.

| Package | What it does |
|---|---|
| [`@wired-square/appliance-types`](packages/appliance-types/README.md) | The appliance's wire types and limits, generated from wslib-rs's `wslib-appliance-types` |
| [`@wired-square/appliance-ui`](packages/appliance-ui/README.md) | The appliance's browser half: the shell, the Settings screens and their parts, and test helpers |
| [`@wired-square/canvas`](packages/canvas/README.md) | A pan and zoom board canvas of nodes and edges, framework-free with Solid and React bindings |
| [`@wired-square/chart`](packages/chart/README.md) | A framework-free time-series chart drawn as SVG |
| [`@wired-square/icons`](packages/icons/README.md) | Wired Square's glyphs as plain SVG on a 24 grid, a sprite for apps without a bundler, and Solid components |
| [`@wired-square/kit`](packages/kit/README.md) | SolidJS components, the `--app-*` tokens they read, and test helpers |
| [`@wired-square/mcp-bridge`](packages/mcp-bridge/README.md) | The page half of wslib-mcp's `dom` tools, and their bridge over Tauri events |
| [`@wired-square/tokens`](packages/tokens/README.md) | The `--app-*` tokens' names and defaults, as TypeScript and JSON |

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

The mirror restores the `peerDependenciesMeta` Forgejo drops, without which a lockfile records optional peers as
required. Each package's README covers the rest. [CONTRIBUTING.md](CONTRIBUTING.md) covers development and releases.
