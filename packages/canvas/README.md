# @wired-square/canvas

A board canvas: a pannable, zoomable pane of nodes and edges, with connecting, a dot background, controls, a minimap
and corner panels. The core is framework-free compiled JavaScript, a Solid binding ships as TSX, and a React binding as
compiled JavaScript. The app owns the document and the selection; the canvas mounts what it is given and reports what
happens.

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
| `./core` | Compiled JavaScript with types: `createCanvas`, `floatingAnchors`, `bezierPath`, and the types |
| `.` | `Canvas`, `CanvasPanel`, `CanvasScope` and `useCanvas`, as TSX behind the `solid` export condition |
| `./react` | The same four for React 19, compiled JavaScript with types |
| `./canvas.css` | The canvas's styles, in the cascade layer `canvas` |

Import `@wired-square/kit/theme.css`, which defines the `--app-canvas-*` tokens, then `canvas.css`, once, in the entry
module. Every colour the canvas draws is one of those tokens. `canvas.css` reads `--app-canvas-bg`, `-dot`,
`-connection`, `-chrome`, `-chrome-text`, `-chrome-hover`, `-chrome-border`, `-minimap-node`, `-minimap-mask` and
`-minimap-view`, and kit's `--app-radius`, `--app-shadow`, `--app-focus`, `--app-good` and `--app-bad`, with no
fallbacks.

## The core

```ts
import { bezierPath, createCanvas, floatingAnchors } from "@wired-square/canvas/core";

const canvas = createCanvas(element, {
  minZoom: 0.2,
  maxZoom: 2.5,
  viewport: saved, // without one, it fits the nodes, and refits as sizes land until the camera moves
  fitPadding: 0.2, // the mount fit's and the Fit control's; 0.1 by default
  unmeasuredSize: { width: 220, height: 160 }, // 200 by 100 by default
  background: { gap: 28, size: 1.5 },
  controls: true,
  connectionRadius: 20, // screen pixels within which a connection's end lands on a port; 0 by default
  minimap: { nodeColour: (node) => node.data.colour },
  mount: (element, node) => renderInto(element, node.id), // returns what takes it down
  mountEdge: (path, label, edge) => ({ draw: (edge, { source, target }) => drawString(path, label, floatingAnchors(source, target)) }),
  onNodeClick: (node) => select(node.id),
  onNodeDragEnd: (node, position) => commit(node.id, position),
  onEdgeClick: (edge) => select(edge.id),
  isValidConnection: (source, sourcePort, target, targetPort) => source !== target && targetPort !== undefined,
  onConnect: (source, target, { sourcePort, targetPort }) => link(source, sourcePort, target, targetPort),
  onMoveEnd: (viewport) => save(viewport),
});
canvas.setNodes(nodes); // { id, x, y, data, className? }
canvas.setEdges(edges); // { id, source, target, sourcePort?, targetPort?, data, className? }
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
  centres crosses each border, and the side, and `bezierPath(source, target, curvature = 0.25)` gives an SVG path
  between two such anchors whose ends leave along their sides, bowing by `curvature` where an end faces away. An
  edge naming a port also gets `sourcePort` or `targetPort` in its geometry once the port is measured: `{ x, y, side }`
  in canvas coordinates, at the middle of the port's outer side.
  `label` is an HTML element in canvas space for a tag. Edges take pointer events where they are painted, and labels
  everywhere; a click on either calls `onEdgeClick(edge, event)`, or `onPaneClick` without one, and a press on either
  pans the canvas.
- **Ports** are elements in a node's content with `data-canvas-port="<id>"`, unique within the node. A port's side is
  its `data-canvas-side` (`top`, `right`, `bottom` or `left`), or else the side of its node nearest it. An edge or a
  connection meets a port at the middle of that side of the port, its outer rim, not at its centre.
  `data-canvas-port-kind="in"` or `"out"` marks a port as an input or an output. Ports are measured when their node
  mounts or resizes and when its content changes, and kept after it scrolls away.
- **Connecting** starts on a press on a port or on an element with the class `canvas-source` inside a node. The canvas
  wears `is-connecting` while the line is drawn, and a drop on any other node calls
  `onConnect(source, target, { sourcePort, targetPort })`, each port `undefined` for a node-level end. A drop on a
  port, even where it stands out of its node, reports it; a drop elsewhere on a node reports none, and one on the
  empty pane does nothing. `isValidConnection(source, sourcePort, target, targetPort)` refuses a drop; while the line
  is drawn, the port or node under it wears `is-valid-target` or `is-invalid-target`.
  An end within `connectionRadius` screen pixels of a port lands on the nearest such port, and the marks follow it.
  The end with an `out` port, or the other end of an `in` port, is always reported as the source, whichever end the
  drag began at; two `in` ports or two `out` ports never connect, are marked invalid, and are not put to
  `isValidConnection`. The line from a port is `bezierPath` to the pointer, its pointer end on the side opposite the
  port's, or to the anchor of the port it would land on; the line from a `canvas-source` is straight.
- **The camera.** Drag the pane to pan; the wheel, a two-finger touch pinch and a WebKit trackpad pinch zoom about the
  pointer. `fitView({ ids, padding, maxZoom, duration })` leaves the camera put when none of `ids` is on the canvas,
  and its `padding` is `fitPadding` when not given. While a `fitView` animates, a size that lands re-aims it at the
  measured bounds, settling the same promise; a node never mounted counts at `unmeasuredSize`. The fit at mount
  refits as nodes are measured and the canvas resizes, until the canvas is pressed or the camera moved by the user or
  the app.
  `setCentre`, `setViewport` and `fitView` return a promise that settles when the move lands or is interrupted, and
  every move but the mount fit ends with `onMoveEnd`.
- **Opting out.** An element with the class `nopan` neither pans nor starts a drag or a click, and one with `nowheel`
  keeps its own wheel. The controls, the minimap and panels wear both. Stopping a pointer event's propagation in node
  content does not opt out of clicks and drags, since the canvas listens in the capture phase; use `nopan`.
- **Panels.** `<div class="app-canvas-panel" data-position="top-left">` sits in a corner (`top-left`, `top-right`,
  `bottom-left`, `bottom-right`) of its nearest positioned ancestor, inside the canvas or beside it. Panels sit at
  `z-index: 3`, above the pane and the minimap; an app may override it.

`measure`, `offset`, `observe` and `frame` are seams for tests: jsdom lays nothing out, observes no sizes and has no
animation frames, so a test gives each element a size and each port its top-left within its node, says when they
change, and runs the frames.
Synthetic pointer events must set `buttons`, since a `pointermove` with `buttons: 0` ends a drag; testing-library's
events and `new PointerEvent` default it to 0.

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

## React

```tsx
import { Canvas, CanvasPanel, CanvasScope, useCanvas } from "@wired-square/canvas/react";

<CanvasScope>
  <Canvas nodes={nodes} edges={edges} node={(node) => <Card card={node.data} />} edge={(edge, geometry) => <Wire geometry={geometry} />}
    onNodeClick={(node) => select(node.id)} />
  <Drawer /> {/* useCanvas()?.setCentre(x, y, { zoom: 1, duration: 400 }) */}
</CanvasScope>
```

The same four as the Solid binding, with React's idioms. `Canvas` reads its settings at mount and its callbacks when
they fire, so new closures on each render neither remount it nor go stale; remount it, through a `key`, to start a new
camera. `nodes` and `edges` are passed on whenever they change. `node`, `edge` and `edgeLabel` render through portals
into the mounted elements with the current node or edge and its geometry. `className` and `style` go on the canvas
element beside its own classes. `useCanvas()` gives the handle itself, `undefined` until the canvas mounts.

## Peers

- `solid-js` ^1.9.11, optional, for `.`.
- `react` and `react-dom` ^19.0.0, optional, for `./react`.

`./core` needs none of them.
