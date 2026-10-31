import { createCanvas } from "@wired-square/canvas/core";
import type {
  CanvasEdge,
  CanvasHandle,
  CanvasNode,
  CanvasOptions,
  EdgeGeometry,
  PanelPosition,
} from "@wired-square/canvas/core";
import {
  createContext,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  mergeProps,
  onCleanup,
  onMount,
  runWithOwner,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor, JSX, ParentProps } from "solid-js";
import { insert } from "solid-js/web";

const Scope = createContext<{ canvas: Accessor<CanvasHandle | undefined>; set(canvas: CanvasHandle | undefined): void }>();

/** Shares the handle of the `Canvas` inside it with `useCanvas` callers beside it, such as drawers and panels. */
export function CanvasScope(props: ParentProps) {
  const [canvas, set] = createSignal<CanvasHandle>();
  return <Scope.Provider value={{ canvas, set }}>{props.children}</Scope.Provider>;
}

/** The handle of the nearest `Canvas`, once it has mounted. */
export function useCanvas<D = unknown, E = unknown>(): Accessor<CanvasHandle<D, E> | undefined> {
  const scope = useContext(Scope);
  if (!scope) throw new Error("useCanvas needs a CanvasScope or a Canvas around it");
  return scope.canvas as unknown as Accessor<CanvasHandle<D, E> | undefined>;
}

export interface CanvasProps<D, E> extends Omit<CanvasOptions<D, E>, "mount" | "mountEdge"> {
  nodes: readonly CanvasNode<D>[];
  edges?: readonly CanvasEdge<E>[];
  node(node: Accessor<CanvasNode<D>>): JSX.Element;
  edge?(edge: Accessor<CanvasEdge<E>>, geometry: Accessor<EdgeGeometry>): JSX.Element;
  edgeLabel?(edge: Accessor<CanvasEdge<E>>, geometry: Accessor<EdgeGeometry>): JSX.Element;
  /** Classes beside the canvas's own. */
  class?: string;
  style?: JSX.CSSProperties | string;
  children?: JSX.Element;
}

/** The board canvas over `createCanvas`; the settings are read at mount and the callbacks whenever they fire. */
export function Canvas<D, E = unknown>(props: CanvasProps<D, E>) {
  const outer = useContext(Scope);
  const [canvas, setCanvas] = createSignal<CanvasHandle<D, E>>();
  const owner = getOwner();
  const nodeById = createMemo(() => new Map(props.nodes.map((node) => [node.id, node])));
  const edgeById = createMemo(() => new Map((props.edges ?? []).map((edge) => [edge.id, edge])));
  const rooted = (render: () => void) => runWithOwner(owner, () => createRoot((dispose) => (render(), dispose)))!;
  let root!: HTMLDivElement;

  const mount = (element: HTMLElement, node: CanvasNode<D>) => {
    const dispose = rooted(() => {
      const current = createMemo(() => nodeById().get(node.id) ?? node);
      insert(element, untrack(() => props.node(current)));
    });
    return () => {
      dispose();
      element.replaceChildren();
    };
  };
  const mountEdge = (path: SVGGElement, label: HTMLElement, edge: CanvasEdge<E>) => {
    const [geometry, setGeometry] = createSignal<EdgeGeometry>();
    let dispose: (() => void) | undefined;
    return {
      draw(_: CanvasEdge<E>, next: EdgeGeometry) {
        setGeometry(next);
        dispose ??= rooted(() => {
          const current = createMemo(() => edgeById().get(edge.id) ?? edge);
          const drawn = geometry as Accessor<EdgeGeometry>;
          insert(path, untrack(() => props.edge?.(current, drawn)));
          insert(label, untrack(() => props.edgeLabel?.(current, drawn)));
        });
      },
      dispose: () => dispose?.(),
    };
  };

  onMount(() => {
    const drawsEdges = props.edge || props.edgeLabel;
    const handle = createCanvas<D, E>(root, mergeProps(props, { mount, ...(drawsEdges && { mountEdge }) }));
    setCanvas(() => handle);
    outer?.set(handle);
    onCleanup(() => {
      handle.destroy();
      if (outer?.canvas() === handle) outer.set(undefined);
    });
  });

  createEffect(() => canvas()?.setNodes(props.nodes));
  createEffect(() => canvas()?.setEdges(props.edges ?? []));

  return (
    <Scope.Provider value={{ canvas, set: () => {} }}>
      <div ref={root} classList={props.class ? { [props.class]: true } : {}} style={props.style}>
        <div class="app-canvas__children">{props.children}</div>
      </div>
    </Scope.Provider>
  );
}

/** A panel pinned to a corner of the nearest positioned element, inside the canvas or beside it. */
export function CanvasPanel(props: ParentProps<{ position: PanelPosition }>) {
  return (
    <div class="app-canvas-panel nopan nowheel" data-position={props.position}>
      {props.children}
    </div>
  );
}
