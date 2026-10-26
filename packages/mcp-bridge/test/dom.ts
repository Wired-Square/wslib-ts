import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });

Object.assign(globalThis, {
  window,
  document: window.document,
  getComputedStyle: (el: Element) => window.getComputedStyle(el),
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  HTMLSelectElement: window.HTMLSelectElement,
  HTMLOptionElement: window.HTMLOptionElement,
  Event: window.Event,
  MouseEvent: window.MouseEvent,
  PointerEvent: window.PointerEvent,
  KeyboardEvent: window.KeyboardEvent,
});

export function page(html: string) {
  document.body.innerHTML = html;
}

export function shown(el: Element) {
  el.getBoundingClientRect = () => new window.DOMRect(10, 20, 30, 40);
}
