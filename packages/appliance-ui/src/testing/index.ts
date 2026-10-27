/**
 * What a product's vitest suite over these components needs on top of
 * `@wired-square/kit/testing`, in jsdom: name
 * `@wired-square/appliance-ui/testing/setup` in `setupFiles`, and mount a
 * screen in one of the sessions here.
 */
export { mount } from "./mount";
export type { MountOptions, YieldingMountOptions } from "./mount";
export { admin, behindConsole, signedIn, viewerSignedIn } from "./sessions";
