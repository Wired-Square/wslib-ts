/**
 * A Solid renderer onto plain objects, so a screen runs under the browser's
 * reactive core in node: a resource that errors throws on read, as it does in
 * a browser and does not under the server renderer.
 */
import { createRenderer } from "solid-js/universal";

export class Element {
  parent: Element | undefined;
  readonly children: Element[] = [];
  readonly props: Record<string, unknown> = {};

  constructor(
    readonly tag: string,
    public text = "",
  ) {}

  showModal() {}
  close() {}
  hidePopover() {}
  focus() {}
  querySelector(_selector: string): unknown {
    return null;
  }
}

function indexIn(parent: Element, node: Element): number {
  const at = parent.children.indexOf(node);
  if (at < 0) throw new Error(`a <${node.tag}> is not a child of its <${parent.tag}>`);
  return at;
}

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
  use,
} = createRenderer<Element>({
  createElement: (tag) => new Element(tag),
  createTextNode: (value) => new Element("#text", value),
  replaceText: (node, value) => {
    node.text = value;
  },
  isTextNode: (node) => node.tag === "#text",
  setProperty: (node, name, value) => {
    node.props[name] = value;
  },
  insertNode: (parent, node, anchor) => {
    if (node.parent) node.parent.children.splice(indexIn(node.parent, node), 1);
    parent.children.splice(anchor ? indexIn(parent, anchor) : parent.children.length, 0, node);
    node.parent = parent;
  },
  removeNode: (parent, node) => {
    parent.children.splice(indexIn(parent, node), 1);
    node.parent = undefined;
  },
  getParentNode: (node) => node.parent,
  getFirstChild: (node) => node.children[0],
  getNextSibling: (node) => node.parent && node.parent.children[indexIn(node.parent, node) + 1],
});
