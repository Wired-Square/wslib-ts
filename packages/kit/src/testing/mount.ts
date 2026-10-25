import type { JSX } from "solid-js";
import { render } from "solid-js/web";

const mounted: (() => void)[] = [];

export interface MountOptions {
  /** What goes around the screen: a router, a session provider. */
  wrap?: (screen: () => JSX.Element) => JSX.Element;
}

/** What a `wrap` puts around the screen, and what `mount` returns: a router's history, say. */
export interface Wrapped<T> {
  view: JSX.Element;
  yields: T;
}

export interface YieldingMountOptions<T> {
  wrap: (screen: () => JSX.Element) => Wrapped<T>;
}

const isWrapped = (out: JSX.Element | Wrapped<unknown>): out is Wrapped<unknown> =>
  typeof out === "object" && out !== null && !(out instanceof Node) && !Array.isArray(out);

/** Renders `screen` into a fresh element on `document.body`, which it returns, or what `wrap` yields. */
export function mount(screen: () => JSX.Element, options?: MountOptions): HTMLElement;
export function mount<T>(screen: () => JSX.Element, options: YieldingMountOptions<T>): T;
export function mount(screen: () => JSX.Element, options: MountOptions | YieldingMountOptions<unknown> = {}): unknown {
  const root = document.body.appendChild(document.createElement("div"));
  let yielded: unknown = root;
  const wrapped = () => {
    const out = options.wrap ? options.wrap(screen) : screen();
    if (!isWrapped(out)) return out;
    yielded = out.yields;
    return out.view;
  };
  mounted.push(render(wrapped, root));
  return yielded;
}

/** Everything `mount` mounted, taken down, and the document emptied. */
export function unmountAll() {
  for (const dispose of mounted.splice(0)) dispose();
  document.body.replaceChildren();
}
