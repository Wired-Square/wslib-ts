/**
 * A vitest `setupFiles` entry: what jsdom lacks that `Dialog`, `Menu` and
 * `Pulse` stand on, no network, and everything mounted taken down after each test.
 */
import { afterEach, vi } from "vitest";

import { unmountAll } from "./mount";

globalThis.fetch = () => Promise.reject(new Error("no network in tests"));

window.matchMedia = (query) => ({ matches: false, media: query }) as MediaQueryList;

HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};

const shown = new WeakSet<HTMLElement>();

function toggle(panel: HTMLElement, newState: "open" | "closed") {
  const before = Object.assign(new Event("beforetoggle", { cancelable: true }), { newState });
  if (!panel.dispatchEvent(before)) return;
  if (newState === "open") shown.add(panel);
  else shown.delete(panel);
  panel.dispatchEvent(Object.assign(new Event("toggle"), { newState }));
}

HTMLElement.prototype.hidePopover = function () {
  if (shown.has(this)) toggle(this, "closed");
};

document.addEventListener("click", (e) => {
  const id = (e.target as Element).closest("[popovertarget]")?.getAttribute("popovertarget");
  const panel = id ? document.getElementById(id) : null;
  if (panel) toggle(panel, shown.has(panel) ? "closed" : "open");
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
