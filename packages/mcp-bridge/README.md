# @wired-square/mcp-bridge

The page half of wslib-mcp's `dom` and `tauri-bridge` features: the DOM ops its `dom` tools run in the page, and a
bridge that answers them over Tauri events. The contract with the Rust half is data: `DOM_OPS` lists the ops,
`DOM_OP_CLASS` marks each `read` or `drive`, and `REQUEST_EVENT` and `REPLY_EVENT` name the events.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/mcp-bridge
```

## Entry points

Both are compiled JavaScript with types; there is no root entry.

| Subpath | What |
|---|---|
| `./dom-ops` | `domOps`, `DomOp`, `DOM_OPS`, `DOM_OP_CLASS`, `DomOpClass`, `runDomOp`, `rectInViewport`, `clippingAncestor` and `describe` |
| `./tauri-bridge` | `startHarnessBridge`, `answer`, `REQUEST_EVENT`, `REPLY_EVENT`, `HarnessArgs`, `HarnessRequest`, `HarnessReply` and `AppOps` |

Importing `./dom-ops` wraps `console.error` and `console.warn` and listens for `window` `error` and
`unhandledrejection`, keeping the last 200 for the `console` op, so import it before anything that can fail.

```ts
import "@wired-square/mcp-bridge/dom-ops";
import { startHarnessBridge } from "@wired-square/mcp-bridge/tauri-bridge";

await startHarnessBridge({ navigate: ({ path }) => router.navigate(String(path)) });
```

## Peers

- `@tauri-apps/api` ^2.0.0, optional, for `./tauri-bridge` only

No dependencies.

## Moved names

- From wslib-mcp 0.1.1's `dom` and `tauri-bridge` features to here, as 0.1.0, with behaviour and export names
  unchanged: `./dom-ops` and `./tauri-bridge` as listed above.
