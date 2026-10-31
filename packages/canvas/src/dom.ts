const SVG = "http://www.w3.org/2000/svg";

export function html<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: Element) {
  const element = document.createElement(tag);
  element.className = className;
  parent?.append(element);
  return element;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, className: string, parent?: Element) {
  const element = document.createElementNS(SVG, tag);
  element.setAttribute("class", className);
  parent?.append(element);
  return element;
}

/** The nearest element from `target` up to `root` with `className`, or `null`. */
export function within(target: EventTarget | null, className: string, root: Element): Element | null {
  for (let at = target instanceof Element ? target : null; at && at !== root; at = at.parentElement) {
    if (at.classList.contains(className)) return at;
  }
  return null;
}
