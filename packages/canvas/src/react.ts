import { createCanvas } from "@wired-square/canvas/core";
import type {
  CanvasEdge,
  CanvasHandle,
  CanvasNode,
  CanvasOptions,
  EdgeGeometry,
  PanelPosition,
} from "@wired-square/canvas/core";
import { createContext, createElement, useContext, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CSSProperties, Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { createPortal } from "react-dom";

const Scope = createContext<{ canvas: CanvasHandle | undefined; set: Dispatch<SetStateAction<CanvasHandle | undefined>> } | undefined>(
  undefined,
);
const ignore = () => {};
const none: readonly never[] = [];

/** Shares the handle of the `Canvas` inside it with `useCanvas` callers beside it, such as drawers and panels. */
export function CanvasScope({ children }: { children?: ReactNode }): ReactElement {
  const [canvas, set] = useState<CanvasHandle>();
  const value = useMemo(() => ({ canvas, set }), [canvas]);
  return createElement(Scope.Provider, { value }, children);
}

/** The handle of the nearest `Canvas`, once it has mounted. */
export function useCanvas<D = unknown, E = unknown>(): CanvasHandle<D, E> | undefined {
  const scope = useContext(Scope);
  if (!scope) throw new Error("useCanvas needs a CanvasScope or a Canvas around it");
  return scope.canvas as CanvasHandle<D, E> | undefined;
}

export interface CanvasProps<D, E> extends Omit<CanvasOptions<D, E>, "mount" | "mountEdge"> {
  nodes: readonly CanvasNode<D>[];
  edges?: readonly CanvasEdge<E>[];
  node(node: CanvasNode<D>): ReactNode;
  edge?(edge: CanvasEdge<E>, geometry: EdgeGeometry): ReactNode;
  edgeLabel?(edge: CanvasEdge<E>, geometry: EdgeGeometry): ReactNode;
  /** Classes beside the canvas's own. */
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

interface EdgeView<E> {
  path: SVGGElement;
  label: HTMLElement;
  edge: CanvasEdge<E>;
  geometry: EdgeGeometry;
}

/** The board canvas over `createCanvas`; the settings are read at mount and the callbacks whenever they fire. */
export function Canvas<D, E = unknown>(props: CanvasProps<D, E>): ReactElement {
  const outer = useContext(Scope);
  const [canvas, setCanvas] = useState<CanvasHandle<D, E>>();
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const latest = useRef(props);
  const root = useRef<HTMLDivElement>(null);
  const shown = useRef(new Map<string, { element: HTMLElement; node: CanvasNode<D> }>()).current;
  const drawn = useRef(new Map<string, EdgeView<E>>()).current;
  const edges = props.edges ?? none;
  const nodeById = useMemo(() => new Map(props.nodes.map((node) => [node.id, node])), [props.nodes]);
  const edgeById = useMemo(() => new Map(edges.map((edge) => [edge.id, edge])), [edges]);

  useLayoutEffect(() => {
    latest.current = props;
  });

  useLayoutEffect(() => {
    const drawsEdges = props.edge || props.edgeLabel;
    const mount = (element: HTMLElement, node: CanvasNode<D>) => {
      shown.set(node.id, { element, node });
      redraw();
      return () => {
        shown.delete(node.id);
        redraw();
      };
    };
    const mountEdge = (path: SVGGElement, label: HTMLElement, { id }: CanvasEdge<E>) => ({
      draw(edge: CanvasEdge<E>, geometry: EdgeGeometry) {
        drawn.set(id, { path, label, edge, geometry });
        redraw();
      },
      dispose() {
        drawn.delete(id);
        redraw();
      },
    });
    const options = new Proxy({} as CanvasOptions<D, E>, {
      get: (_, key) =>
        key === "mount" ? mount : key === "mountEdge" ? drawsEdges && mountEdge : latest.current[key as keyof CanvasProps<D, E>],
    });
    const handle = createCanvas<D, E>(root.current!, options);
    setCanvas(() => handle);
    outer?.set(handle as CanvasHandle);
    return () => {
      handle.destroy();
      outer?.set((current) => (current === (handle as CanvasHandle) ? undefined : current));
    };
  }, []);

  useLayoutEffect(() => canvas?.setNodes(props.nodes), [canvas, props.nodes]);
  useLayoutEffect(() => canvas?.setEdges(edges), [canvas, edges]);

  const portals = [...shown].map(([id, { element, node }]) => createPortal(props.node(nodeById.get(id) ?? node), element, `node:${id}`));
  for (const [id, { path, label, edge, geometry }] of drawn) {
    const current = edgeById.get(id) ?? edge;
    portals.push(createPortal(props.edge?.(current, geometry), path, `edge:${id}`));
    portals.push(createPortal(props.edgeLabel?.(current, geometry), label, `label:${id}`));
  }
  const scope = useMemo(() => ({ canvas: canvas as CanvasHandle | undefined, set: ignore }), [canvas]);

  return createElement(
    Scope.Provider,
    { value: scope },
    createElement(
      "div",
      { ref: root, className: ["app-canvas", props.className?.trim()].filter(Boolean).join(" "), style: props.style },
      createElement("div", { className: "app-canvas__children" }, props.children),
      portals,
    ),
  );
}

/** A panel pinned to a corner of the nearest positioned element, inside the canvas or beside it. */
export function CanvasPanel({ position, children }: { position: PanelPosition; children?: ReactNode }): ReactElement {
  return createElement("div", { className: "app-canvas-panel nopan nowheel", "data-position": position }, children);
}
