import { controls, dots, minimap } from "./chrome.js";
import type { ChromeHost } from "./chrome.js";
import { html, svg, within } from "./dom.js";
import {
  between,
  boundsOf,
  clamp,
  centreOn,
  contains,
  fitBounds,
  intersects,
  toCanvas,
  visibleRect,
  wheelFactor,
  zoomTo,
} from "./viewport.js";
import type { Point, Rect, Size, Viewport } from "./viewport.js";

export interface CanvasNode<D = unknown> {
  id: string;
  x: number;
  y: number;
  data: D;
  className?: string;
}

export interface CanvasEdge<E = unknown> {
  id: string;
  source: string;
  target: string;
  data: E;
  className?: string;
}

/** A node with its live position and its last measured size, if it has been measured. */
export interface MeasuredNode<D = unknown> extends CanvasNode<D> {
  size: Size | undefined;
}

/** The rectangles of an edge's two nodes, in canvas coordinates. */
export interface EdgeGeometry {
  source: Rect;
  target: Rect;
}

/** An edge's drawing: `draw` runs when it mounts and whenever its edge or geometry changes. */
export interface EdgeView<E = unknown> {
  draw(edge: CanvasEdge<E>, geometry: EdgeGeometry): void;
  dispose?(): void;
}

export interface SizeObserver {
  observe(element: Element): void;
  unobserve(element: Element): void;
  disconnect(): void;
}

export interface MoveOptions {
  duration?: number;
}

export interface FitOptions extends MoveOptions {
  /** The nodes to frame; all of them by default. None of them on the canvas leaves the camera where it is. */
  ids?: readonly string[];
  /** Room around the nodes, as a fraction of their extent. */
  padding?: number;
  maxZoom?: number;
}

export interface CanvasOptions<D = unknown, E = unknown> {
  /** Puts a node's content into `element`, returning what takes it down. */
  mount(element: HTMLElement, node: CanvasNode<D>): () => void;
  mountEdge?(path: SVGGElement, label: HTMLElement, edge: CanvasEdge<E>): EdgeView<E>;
  /** The camera at mount; without one, the camera fits the first nodes given. */
  viewport?: Viewport;
  minZoom?: number;
  maxZoom?: number;
  /** The size assumed for a node not yet measured, for culling and fitting; 200 by 100 by default. */
  unmeasuredSize?: Size;
  background?: { gap: number; size: number };
  controls?: boolean;
  minimap?: { nodeColour?(node: CanvasNode<D>): string };
  onNodeClick?(node: CanvasNode<D>, event: PointerEvent): void;
  onNodeEnter?(node: CanvasNode<D>): void;
  onNodeLeave?(node: CanvasNode<D>): void;
  onPaneClick?(event: PointerEvent): void;
  onNodeDrag?(node: CanvasNode<D>, position: Point): void;
  /** A drag let go: the position to commit. */
  onNodeDragEnd?(node: CanvasNode<D>, position: Point): void;
  onNodeMeasured?(node: CanvasNode<D>, size: Size): void;
  onConnect?(source: string, target: string): void;
  onMoveEnd?(viewport: Viewport): void;
  /** Seams for tests: an element's layout size, a resize observer, and an animation frame. */
  measure?(element: HTMLElement): Size;
  observe?(onResize: (elements: readonly Element[]) => void): SizeObserver;
  frame?(step: (now: number) => void): void;
}

export interface CanvasHandle<D = unknown, E = unknown> {
  setNodes(nodes: readonly CanvasNode<D>[]): void;
  setEdges(edges: readonly CanvasEdge<E>[]): void;
  getNode(id: string): MeasuredNode<D> | undefined;
  getNodes(): MeasuredNode<D>[];
  getViewport(): Viewport;
  setViewport(viewport: Viewport, options?: MoveOptions): Promise<void>;
  setCentre(x: number, y: number, options?: MoveOptions & { zoom?: number }): Promise<void>;
  fitView(options?: FitOptions): Promise<void>;
  /** A point in client coordinates, in canvas coordinates. */
  screenToCanvas(point: Point): Point;
  destroy(): void;
}

interface NodeRecord<D> {
  node: CanvasNode<D>;
  x: number;
  y: number;
  size: Size | undefined;
  element: HTMLElement;
  dispose: (() => void) | undefined;
}

interface EdgeRecord<E> {
  edge: CanvasEdge<E>;
  view: { path: SVGGElement; label: HTMLElement; drawing: EdgeView<E>; drawn: EdgeGeometry | undefined } | undefined;
}

type Gesture<D> =
  | { kind: "pane"; pointer: number; from: Point; last: Point; moved: boolean }
  | { kind: "pinch"; last: [Point, Point] }
  | { kind: "node"; pointer: number; record: NodeRecord<D>; from: Point; last: Point; moved: boolean }
  | { kind: "connect"; pointer: number; record: NodeRecord<D>; from: Point; line: SVGPathElement };

const CLICK_SLOP = 3;
const OVERSCAN = 200;
const WHEEL_SETTLE = 150;

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const client = (event: MouseEvent) => ({ x: event.clientX, y: event.clientY });
const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const layoutSize = (element: HTMLElement): Size => ({ width: element.offsetWidth, height: element.offsetHeight });

const resizeObserver = (onResize: (elements: readonly Element[]) => void): SizeObserver =>
  new ResizeObserver((entries) => onResize(entries.map((entry) => entry.target)));

/** Turns `root` into a board canvas: a pannable, zoomable pane of nodes and edges. */
export function createCanvas<D = unknown, E = unknown>(root: HTMLElement, options: CanvasOptions<D, E>): CanvasHandle<D, E> {
  const limits = { minZoom: options.minZoom ?? 0.5, maxZoom: options.maxZoom ?? 2 };
  const measure = options.measure ?? layoutSize;
  const frame = options.frame ?? ((step: (now: number) => void) => void requestAnimationFrame(step));
  const unmeasured = options.unmeasuredSize ?? { width: 200, height: 100 };
  const clampZoom = (next: Viewport): Viewport => ({ ...next, zoom: clamp(next.zoom, limits.minZoom, limits.maxZoom) });

  const existing = new Set(root.children);
  root.classList.add("app-canvas");
  const drawBackground = options.background && dots(root, options.background);
  const pane = html("div", "app-canvas__pane", root);
  const edgeLayer = svg("svg", "app-canvas__edges", pane);
  const labelLayer = html("div", "app-canvas__labels", pane);
  const nodeLayer = html("div", "app-canvas__nodes", pane);

  const nodes = new Map<string, NodeRecord<D>>();
  const byElement = new WeakMap<Element, NodeRecord<D>>();
  const edges = new Map<string, EdgeRecord<E>>();
  const pointers = new Map<number, Point>();
  let viewport = clampZoom(options.viewport ?? { x: 0, y: 0, zoom: 1 });
  let size = measure(root);
  let gesture: Gesture<D> | undefined;
  let hovered: NodeRecord<D> | undefined;
  let animation = 0;
  let aim: Viewport | undefined;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let mapDirty = true;
  // "pending" until the first nodes arrive, then "estimated" until they are measured, when it fits once more.
  let mountFit: "pending" | "estimated" | "done" = options.viewport ? "done" : "pending";
  let connectionLayer: SVGSVGElement | undefined;

  const rectOf = (record: NodeRecord<D>): Rect => ({ x: record.x, y: record.y, ...(record.size ?? unmeasured) });
  const placed = (record: NodeRecord<D>): MeasuredNode<D> => ({ ...record.node, x: record.x, y: record.y, size: record.size });
  const dragged = () => (gesture?.kind === "node" && gesture.moved ? gesture.record : undefined);

  const observer = (options.observe ?? resizeObserver)((elements) => {
    for (const element of elements) {
      if (element === root) {
        size = measure(root);
        continue;
      }
      if (element === map?.frame) {
        map.resize();
        continue;
      }
      const record = byElement.get(element);
      if (!record?.dispose) continue;
      const next = measure(record.element);
      if (record.size && record.size.width === next.width && record.size.height === next.height) continue;
      record.size = next;
      mapDirty = true;
      options.onNodeMeasured?.(record.node, next);
    }
    if (mountFit !== "done") fitOnMount(mountFit === "pending" ? "estimated" : "done");
    sync();
  });
  observer.observe(root);

  function setNodeClass(record: NodeRecord<D>) {
    record.element.className = classes("app-canvas__node", record.node.className, dragged() === record && "is-dragging");
  }

  function place(record: NodeRecord<D>) {
    record.element.style.transform = `translate(${record.x}px, ${record.y}px)`;
  }

  function leave(record: NodeRecord<D>) {
    if (hovered !== record) return;
    hovered = undefined;
    options.onNodeLeave?.(record.node);
  }

  function show(record: NodeRecord<D>, visible: boolean, before: Element | null = null) {
    if (visible === Boolean(record.dispose)) return;
    if (visible) {
      nodeLayer.insertBefore(record.element, before);
      record.dispose = options.mount(record.element, record.node);
      observer.observe(record.element);
    } else {
      leave(record);
      observer.unobserve(record.element);
      record.dispose!();
      record.dispose = undefined;
      record.element.remove();
    }
  }

  function showEdge(record: EdgeRecord<E>, geometry: EdgeGeometry | undefined) {
    if (!geometry) {
      if (!record.view) return;
      record.view.drawing.dispose?.();
      record.view.path.remove();
      record.view.label.remove();
      record.view = undefined;
      return;
    }
    if (!record.view) {
      const path = svg("g", "", edgeLayer);
      const label = html("div", "app-canvas__label", labelLayer);
      record.view = { path, label, drawing: options.mountEdge!(path, label, record.edge), drawn: undefined };
    }
    const { view } = record;
    view.path.setAttribute("class", classes("app-canvas__edge", record.edge.className));
    if (view.drawn && sameRect(view.drawn.source, geometry.source) && sameRect(view.drawn.target, geometry.target)) return;
    view.drawn = geometry;
    view.drawing.draw(record.edge, geometry);
  }

  function sync() {
    const seen = visibleRect(viewport, size);
    const margin = OVERSCAN / viewport.zoom;
    const area = { x: seen.x - margin, y: seen.y - margin, width: seen.width + 2 * margin, height: seen.height + 2 * margin };
    const visible = (rect: Rect) => size.width > 0 && size.height > 0 && intersects(area, rect);
    // The layer stays in the nodes' order: each node shown goes in before the next one already mounted.
    let next = nodeLayer.firstElementChild;
    for (const record of nodes.values()) {
      if (record.dispose) next = record.element.nextElementSibling;
      show(record, record === dragged() || visible(rectOf(record)), next);
    }
    for (const record of edges.values()) {
      const source = nodes.get(record.edge.source);
      const target = nodes.get(record.edge.target);
      const geometry = source && target ? { source: rectOf(source), target: rectOf(target) } : undefined;
      showEdge(record, geometry && visible(boundsOf([geometry.source, geometry.target])!) ? geometry : undefined);
    }
    if (map && mapDirty) {
      const colour = options.minimap?.nodeColour;
      map.nodes([...nodes.values()].map((record) => ({ rect: rectOf(record), colour: colour?.(record.node) })));
      mapDirty = false;
    }
    map?.view();
  }

  function apply(next: Viewport) {
    viewport = next;
    pane.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.zoom})`;
    drawBackground?.(next);
    sync();
  }

  function settle() {
    clearTimeout(wheelTimer);
    wheelTimer = undefined;
    options.onMoveEnd?.(viewport);
  }

  function interrupt() {
    animation++;
    aim = undefined;
    mountFit = "done";
  }

  /** Interrupts, and a wheel zoom still waiting to settle reports now. */
  function takeCamera() {
    interrupt();
    if (wheelTimer !== undefined) settle();
  }

  function moveTo(next: Viewport, duration = 0): Promise<void> {
    takeCamera();
    const target = clampZoom(next);
    if (duration <= 0) {
      apply(target);
      settle();
      return Promise.resolve();
    }
    aim = target;
    const run = animation;
    const from = viewport;
    let start: number | undefined;
    return new Promise((resolve) => {
      const step = (now: number) => {
        if (run !== animation) return resolve();
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        apply(between(from, target, t));
        if (t < 1) return frame(step);
        aim = undefined;
        settle();
        resolve();
      };
      frame(step);
    });
  }

  function fitTarget({ ids, padding = 0.1, maxZoom = limits.maxZoom }: FitOptions): Viewport | undefined {
    const chosen = ids ? ids.flatMap((id) => nodes.get(id) ?? []) : [...nodes.values()];
    const bounds = boundsOf(chosen.map(rectOf));
    if (!bounds || !size.width || !size.height) return undefined;
    return fitBounds(bounds, size, padding, { minZoom: limits.minZoom, maxZoom: Math.min(maxZoom, limits.maxZoom) });
  }

  function fitOnMount(next: "estimated" | "done") {
    const target = fitTarget({});
    if (!target) return;
    mountFit = next;
    apply(target);
  }

  const local = (point: Point) => {
    const { left, top } = root.getBoundingClientRect();
    return { x: point.x - left, y: point.y - top };
  };

  function wheelZoom(event: WheelEvent, about: Point) {
    interrupt();
    apply(zoomTo(viewport, viewport.zoom * wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey), about, limits));
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(settle, WHEEL_SETTLE);
  }

  const host: ChromeHost = {
    root,
    viewport: () => viewport,
    size: () => size,
    measure,
    panBy: (delta) => {
      takeCamera();
      apply({ ...viewport, x: viewport.x + delta.x, y: viewport.y + delta.y });
    },
    settle,
    zoomBy: (factor, duration) => {
      const from = aim ?? viewport;
      void moveTo(zoomTo(from, from.zoom * factor, { x: size.width / 2, y: size.height / 2 }, limits), duration);
    },
    wheelZoom,
    fitView: () => void handle.fitView({ duration: 200 }),
  };
  if (options.controls) controls(host);
  const map = options.minimap && minimap(host);
  if (map) observer.observe(map.frame);
  const created = [...root.children].filter((element) => !existing.has(element));

  function nodeUnder(point: Point, except: NodeRecord<D>) {
    return [...nodes.values()].reverse().find((record) => record !== except && contains(rectOf(record), point));
  }

  function endGesture() {
    if (gesture?.kind === "connect") gesture.line.remove();
    gesture = undefined;
    pointers.clear();
    root.classList.remove("is-connecting");
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || within(event.target, "nopan", root)) return;
    pointers.set(event.pointerId, client(event));
    if (gesture?.kind === "pane" && pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Point, Point];
      gesture = { kind: "pinch", last: [a, b] };
      return;
    }
    if (gesture) return;
    takeCamera();
    const element = within(event.target, "app-canvas__node", root);
    const record = element && byElement.get(element);
    const from = client(event);
    if (record && within(event.target, "canvas-source", root)) {
      connectionLayer ??= svg("svg", "app-canvas__connection", pane);
      const line = svg("path", "app-canvas__connection-line", connectionLayer);
      gesture = { kind: "connect", pointer: event.pointerId, record, from: handle.screenToCanvas(from), line };
      root.classList.add("is-connecting");
    } else if (record) {
      gesture = { kind: "node", pointer: event.pointerId, record, from, last: from, moved: false };
    } else {
      gesture = { kind: "pane", pointer: event.pointerId, from, last: from, moved: false };
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!gesture || !pointers.has(event.pointerId)) return;
    if (event.buttons === 0) return finish(event, true);
    const at = client(event);
    pointers.set(event.pointerId, at);
    switch (gesture.kind) {
      case "pinch": {
        const [a, b] = [...pointers.values()] as [Point, Point];
        const [lastA, lastB] = gesture.last;
        gesture.last = [a, b];
        const before = local(midpoint(lastA, lastB));
        const now = local(midpoint(a, b));
        const moved = { ...viewport, x: viewport.x + now.x - before.x, y: viewport.y + now.y - before.y };
        apply(zoomTo(moved, (viewport.zoom * distance(a, b)) / (distance(lastA, lastB) || 1), now, limits));
        return;
      }
      case "connect": {
        const to = handle.screenToCanvas(at);
        gesture.line.setAttribute("d", `M${gesture.from.x},${gesture.from.y}L${to.x},${to.y}`);
        return;
      }
    }
    if (event.pointerId !== gesture.pointer) return;
    if (!gesture.moved) {
      if (distance(at, gesture.from) < CLICK_SLOP) return;
      gesture.moved = true;
      if (gesture.kind === "node") setNodeClass(gesture.record);
    }
    // Stepping from the last pointer, not the press, keeps a camera move made mid-gesture by the wheel or the app.
    const dx = at.x - gesture.last.x;
    const dy = at.y - gesture.last.y;
    gesture.last = at;
    if (gesture.kind === "pane") {
      apply({ ...viewport, x: viewport.x + dx, y: viewport.y + dy });
      return;
    }
    const { record } = gesture;
    record.x += dx / viewport.zoom;
    record.y += dy / viewport.zoom;
    place(record);
    sync();
    options.onNodeDrag?.(record.node, { x: record.x, y: record.y });
  }

  const onPointerUp = (event: PointerEvent) => finish(event, event.type === "pointercancel");

  function finish(event: PointerEvent, cancelled: boolean) {
    if (!pointers.delete(event.pointerId) || !gesture) return;
    const ended = gesture;
    if (ended.kind !== "pinch" && ended.pointer !== event.pointerId) return;
    endGesture();
    switch (ended.kind) {
      case "pinch":
        return settle();
      case "pane":
        if (ended.moved) settle();
        else if (!cancelled) options.onPaneClick?.(event);
        return;
      case "node": {
        const { record } = ended;
        if (!ended.moved) {
          if (!cancelled) options.onNodeClick?.(record.node, event);
          return;
        }
        setNodeClass(record);
        mapDirty = true;
        sync();
        options.onNodeDragEnd?.(record.node, { x: record.x, y: record.y });
        return;
      }
      case "connect": {
        const target = !cancelled && nodeUnder(handle.screenToCanvas(client(event)), ended.record);
        if (target) options.onConnect?.(ended.record.node.id, target.node.id);
      }
    }
  }

  function onWheel(event: WheelEvent) {
    if (within(event.target, "nowheel", root)) return;
    event.preventDefault();
    wheelZoom(event, local(client(event)));
  }

  // WebKit reports a trackpad pinch as gesture events, not as a ctrl-wheel.
  let gestureZoom: number | undefined;
  const onGestureStart = (event: Event) => {
    if (within(event.target, "nowheel", root)) return;
    event.preventDefault();
    takeCamera();
    gestureZoom = viewport.zoom;
  };
  const onGestureChange = (event: Event) => {
    if (gestureZoom === undefined) return;
    event.preventDefault();
    const { scale } = event as Event & { scale: number };
    apply(zoomTo(viewport, gestureZoom * scale, local(client(event as MouseEvent)), limits));
  };
  const onGestureEnd = () => {
    if (gestureZoom === undefined) return;
    gestureZoom = undefined;
    settle();
  };

  // A native drag of an image or link inside a node would end ours with a pointercancel.
  const onDragStart = (event: DragEvent) => {
    if (!within(event.target, "nopan", root)) event.preventDefault();
  };

  const listeners: [EventTarget, string, (event: never) => void, AddEventListenerOptions?][] = [
    [root, "pointerdown", onPointerDown],
    [root, "wheel", onWheel, { passive: false }],
    [root, "gesturestart", onGestureStart],
    [root, "gesturechange", onGestureChange],
    [root, "gestureend", onGestureEnd],
    [root, "dragstart", onDragStart],
    // Captured, so content that stops these from bubbling can't leave a gesture live.
    [document, "pointermove", onPointerMove, { capture: true }],
    [document, "pointerup", onPointerUp, { capture: true }],
    [document, "pointercancel", onPointerUp, { capture: true }],
  ];
  for (const [target, type, listener, opts] of listeners) target.addEventListener(type, listener as EventListener, opts);

  function createRecord(node: CanvasNode<D>): NodeRecord<D> {
    const element = document.createElement("div");
    const record: NodeRecord<D> = { node, x: node.x, y: node.y, size: undefined, element, dispose: undefined };
    element.dataset.id = node.id;
    element.addEventListener("pointerenter", () => {
      hovered = record;
      options.onNodeEnter?.(record.node);
    });
    element.addEventListener("pointerleave", () => leave(record));
    byElement.set(element, record);
    return record;
  }

  const handle: CanvasHandle<D, E> = {
    setNodes(next) {
      const ids = new Set(next.map((node) => node.id));
      for (const [id, record] of nodes) {
        if (ids.has(id)) continue;
        if (gesture && "record" in gesture && gesture.record === record) endGesture();
        show(record, false);
        nodes.delete(id);
      }
      for (const node of next) {
        let record = nodes.get(node.id);
        if (record?.node === node) continue;
        if (!record) nodes.set(node.id, (record = createRecord(node)));
        record.node = node;
        if (record !== dragged()) {
          record.x = node.x;
          record.y = node.y;
        }
        setNodeClass(record);
        place(record);
      }
      mapDirty = true;
      if (mountFit === "pending") fitOnMount("estimated");
      sync();
    },
    setEdges(next) {
      if (!options.mountEdge) return;
      const ids = new Set(next.map((edge) => edge.id));
      for (const [id, record] of edges) {
        if (ids.has(id)) continue;
        showEdge(record, undefined);
        edges.delete(id);
      }
      for (const edge of next) {
        const record = edges.get(edge.id);
        if (!record) edges.set(edge.id, { edge, view: undefined });
        else if (record.edge !== edge) {
          record.edge = edge;
          if (record.view) record.view.drawn = undefined;
        }
      }
      sync();
    },
    getNode: (id) => {
      const record = nodes.get(id);
      return record && placed(record);
    },
    getNodes: () => [...nodes.values()].map(placed),
    getViewport: () => ({ ...viewport }),
    setViewport: (next, { duration } = {}) => moveTo(next, duration),
    setCentre: (x, y, { zoom = viewport.zoom, duration } = {}) =>
      moveTo(centreOn({ x, y }, clamp(zoom, limits.minZoom, limits.maxZoom), size), duration),
    fitView(fit = {}) {
      const target = fitTarget(fit);
      return target ? moveTo(target, fit.duration) : Promise.resolve();
    },
    screenToCanvas: (point) => toCanvas(viewport, local(point)),
    destroy() {
      interrupt();
      clearTimeout(wheelTimer);
      hovered = undefined;
      for (const [target, type, listener, opts] of listeners) target.removeEventListener(type, listener as EventListener, opts);
      for (const record of edges.values()) showEdge(record, undefined);
      for (const record of nodes.values()) show(record, false);
      observer.disconnect();
      map?.destroy();
      for (const element of created) element.remove();
      root.classList.remove("app-canvas", "is-connecting");
    },
  };

  apply(viewport);
  return handle;
}
