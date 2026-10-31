# @wired-square/canvas

A board canvas: a pannable, zoomable pane of nodes and edges, with connecting, a dot background, controls, a minimap
and corner panels. The core is framework-free compiled JavaScript, and a Solid binding ships as TSX. The app owns the
document and the selection; the canvas mounts what it is given and reports what happens.

## Install

Point the scope at the mirror in the app's `.npmrc`, with a read token:

```ini
@wired-square:registry=https://mirror.wiredsquare.com/npm/
//mirror.wiredsquare.com/npm/:_authToken=${NPM_MIRROR_TOKEN}
```

```sh
npm install @wired-square/canvas
```

## Entry points

| Subpath | What |
|---|---|
| `./core` | Compiled JavaScript with types: `createCanvas`, `floatingAnchors`, and the types |
| `.` | `Canvas`, `CanvasPanel`, `CanvasScope` and `useCanvas`, as TSX behind the `solid` export condition |
| `./canvas.css` | The canvas's styles, in the cascade layer `canvas` |

Import `@wired-square/kit/theme.css`, which defines the `--app-canvas-*` tokens, then `canvas.css`, once, in the entry
module. Every colour the canvas draws is one of those tokens. `canvas.css` reads `--app-canvas-bg`, `-dot`,
`-connection`, `-chrome`, `-chrome-text`, `-chrome-hover`, `-chrome-border`, `-minimap-node`, `-minimap-mask` and
`-minimap-view`, and kit's `--app-radius`, `--app-shadow` and `--app-focus`, with no fallbacks.

## The core

```ts
import { createCanvas, floatingAnchors } from "@wired-square/canvas/core";

const canvas = createCanvas(element, {
  minZoom: 0.2,
  maxZoom: 2.5,
  viewport: saved, // without one, it fits the first nodes given
  unmeasuredSize: { width: 220, height: 160 }, // 200 by 100 by default
  background: { gap: 28, size: 1.5 },
  controls: true,
  minimap: { nodeColour: (node) => node.data.colour },
  mount: (element, node) => renderInto(element, node.id), // returns what takes it down
  mountEdge: (path, label, edge) => ({ draw: (edge, { source, target }) => drawString(path, label, floatingAnchors(source, target)) }),
  onNodeClick: (node) => select(node.id),
  onNodeDragEnd: (node, position) => commit(node.id, position),
  onConnect: (source, target) => link(source, target),
  onMoveEnd: (viewport) => save(viewport),
});
canvas.setNodes(nodes); // { id, x, y, data, className? }
canvas.setEdges(edges); // { id, source, target, data, className? }
```

- **Nodes.** Only the nodes in view are mounted, each in a `.app-canvas__node` wearing its `className`. `setNodes`
  matches by id: an unchanged node object is skipped, and a changed one keeps its element and its mount. `mount` runs
  once per showing, so content that changes reads the app's current node itself, a React portal or a Solid accessor.
  The element is kept between showings, and `mount`'s dispose owns clearing it.
- **Classes.** A node's app classes arrive only through `node.className`, which replaces the node element's whole
  class on each update. Nodes stack in the order `setNodes` first gave them.
- **Sizes** are measured by a `ResizeObserver` and kept after a node scrolls away. `getNode(id)` and `getNodes()`
  give each node's live position and its `size`, `undefined` until it has been measured; `unmeasuredSize` stands in
  for culling and fitting until then.
- **Drags** move the node; `onNodeDrag` reports each step and `onNodeDragEnd` the position to commit. A node the app
  passes again mid-drag keeps the drag's position.
- **Edges** mount when the span of their two nodes is in view. `draw` runs with the two nodes' rectangles whenever
  either moves or resizes, or the edge changes; `floatingAnchors(source, target)` gives where the line between their
  centres crosses each border, and the side. `label` is an HTML element in canvas space for a tag; labels take pointer
  events, and a press on one pans the canvas.
- **Connecting** starts on a press on an element with the class `canvas-source` inside a node. The canvas wears
  `is-connecting` while the line is drawn, and a drop on any other node calls `onConnect(source, target)`. A drop on
  the empty pane does nothing.
- **The camera.** Drag the pane to pan; the wheel, a two-finger touch pinch and a WebKit trackpad pinch zoom about the
  pointer. `fitView({ ids, padding, maxZoom, duration })` leaves the camera put when none of `ids` is on the canvas.
  `setCentre`, `setViewport` and `fitView` return a promise that settles when the move lands or is interrupted, and
  every move but the mount fit ends with `onMoveEnd`.
- **Opting out.** An element with the class `nopan` neither pans nor starts a drag or a click, and one with `nowheel`
  keeps its own wheel. The controls, the minimap and panels wear both.
- **Panels.** `<div class="app-canvas-panel" data-position="top-left">` sits in a corner (`top-left`, `top-right`,
  `bottom-left`, `bottom-right`) of its nearest positioned ancestor, inside the canvas or beside it. Panels sit at
  `z-index: 3`, above the pane and the minimap; an app may override it.

`measure`, `observe` and `frame` are seams for tests: jsdom lays nothing out, observes no sizes and has no animation
frames, so a test gives each element a size, says when it changes, and runs the frames.

## Solid

```tsx
import { Canvas, CanvasPanel, CanvasScope, useCanvas } from "@wired-square/canvas";

<CanvasScope>
  <Canvas nodes={nodes()} edges={edges()} node={(node) => <Card card={node().data} />} edge={(edge, geometry) => <String geometry={geometry()} />}
    onNodeClick={(node) => select(node.id)} />
  <Drawer /> {/* useCanvas()()?.setCentre(x, y, { zoom: 1, duration: 400 }) */}
</CanvasScope>
```

`Canvas` takes `createCanvas`'s options as props, reading the settings at mount and the callbacks when they fire;
remount it, through a keyed `Show`, to start a new camera. `class` and `style` go on the canvas element beside its own
classes, and `.app-canvas` fills its parent's height. `node` and `edge` render once per showing with accessors
that follow the node, the edge and the geometry. `useCanvas()` gives an accessor to the handle of the `Canvas` in the
nearest `CanvasScope`, or of the `Canvas` around it.

## Peers

- `solid-js` ^1.9.11, optional: `./core` needs nothing.
