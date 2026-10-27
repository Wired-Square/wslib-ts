/**
 * A vitest `setupFiles` entry for a jsdom suite over these components: the kit's,
 * and an `EventSource` that never connects, which the shell's feeds stand on.
 */
import "@wired-square/kit/testing/setup";

globalThis.EventSource = class {
  static readonly CLOSED = 2;
  readonly readyState = 0;
  addEventListener() {}
  close() {}
} as unknown as typeof EventSource;
