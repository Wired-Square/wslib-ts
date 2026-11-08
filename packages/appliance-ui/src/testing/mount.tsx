/** A screen rendered into jsdom's document by the kit's `mount`, inside a session. */
import { mount as mountInKit } from "@wired-square/kit/testing";
import type {
  MountOptions as KitMountOptions,
  YieldingMountOptions as KitYieldingMountOptions,
} from "@wired-square/kit/testing";
import type { JSX } from "solid-js";

import { ProofHost } from "../parts/withProof";
import { SessionProvider } from "../shell/session";
import type { Session } from "../shell/session";
import { admin } from "./sessions";

export interface MountOptions extends Omit<KitMountOptions, "around"> {
  /** `admin`, the control socket's, unless given. `wrap` goes inside it. */
  session?: Session;
}

export interface YieldingMountOptions<T> extends Omit<KitYieldingMountOptions<T>, "around"> {
  session?: Session;
}

/**
 * Renders `screen` beside a `ProofHost` into a fresh element on `document.body`,
 * which it returns, or what `wrap` yields.
 */
export function mount(screen: () => JSX.Element, options?: MountOptions): HTMLElement;
export function mount<T>(screen: () => JSX.Element, options: YieldingMountOptions<T>): T;
export function mount(
  screen: () => JSX.Element,
  { session = admin, ...options }: MountOptions | YieldingMountOptions<unknown> = {},
): unknown {
  return mountInKit(screen, {
    ...options,
    around: (view) => (
      <SessionProvider value={session}>
        {view()}
        <ProofHost />
      </SessionProvider>
    ),
  } as KitYieldingMountOptions<unknown>);
}
