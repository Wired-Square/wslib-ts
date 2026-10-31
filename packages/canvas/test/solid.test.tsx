import { Canvas, CanvasPanel, CanvasScope, useCanvas } from "@wired-square/canvas";
import type { CanvasEdge, CanvasNode } from "@wired-square/canvas/core";
import { floatingAnchors } from "@wired-square/canvas/core";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, test, vi } from "vitest";

import { fakeLayout, newRoot, pointer } from "./harness";

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

const mount = (view: () => ReturnType<typeof Canvas>) => {
  const root = newRoot();
  disposers.push(render(view, root));
  return root;
};

type Card = { title: string };
const card = (id: string, x: number, title: string): CanvasNode<Card> => ({ id, x, y: 0, data: { title } });

test("Canvas mounts each node's JSX, updates it in place as its node changes, and draws edges with their geometry", () => {
  const layout = fakeLayout();
  const [nodes, setNodes] = createSignal([card("a", 0, "First"), card("b", 300, "Second")]);
  const edges: CanvasEdge<string>[] = [{ id: "ab", source: "a", target: "b", data: "knows" }];
  const root = mount(() => (
    <Canvas<Card, string>
      nodes={nodes()}
      edges={edges}
      viewport={{ x: 0, y: 0, zoom: 1 }}
      measure={layout.measure}
      observe={layout.observe}
      frame={layout.frame}
      node={(node) => <p class="face">{node().data.title}</p>}
      edge={(_, geometry) => {
        const ends = () => floatingAnchors(geometry().source, geometry().target);
        return <line class="string" x1={ends().source.x} x2={ends().target.x} />;
      }}
      edgeLabel={(edge) => <span>{edge().data}</span>}
    />
  ));
  layout.settle();
  const face = root.querySelector('[data-id="a"] .face')!;
  expect(face.textContent).toBe("First");
  setNodes([card("a", 0, "Renamed"), nodes()[1]!]);
  expect(root.querySelector('[data-id="a"] .face')).toBe(face);
  expect(face.textContent).toBe("Renamed");

  const line = root.querySelector(".app-canvas__edge line")!;
  expect(line).toBeInstanceOf(SVGElement);
  expect([line.getAttribute("x1"), line.getAttribute("x2")]).toEqual(["100", "300"]);
  setNodes([nodes()[0]!, card("b", 500, "Second")]);
  expect(line.getAttribute("x2")).toBe("500");
  expect(root.querySelector(".app-canvas__label")!.textContent).toBe("knows");
});

test("useCanvas beside the Canvas reaches its camera, and CanvasPanel sits in a corner", async () => {
  const layout = fakeLayout();
  let centre: (() => void) | undefined;
  function Drawer() {
    const canvas = useCanvas();
    centre = () => void canvas()?.setCentre(100, 100, { zoom: 2 });
    return <CanvasPanel position="bottom-left">drawer</CanvasPanel>;
  }
  let inner: ReturnType<typeof useCanvas> | undefined;
  function Inside() {
    inner = useCanvas();
    return null;
  }
  const root = mount(() => (
    <CanvasScope>
      <Canvas nodes={[]} viewport={{ x: 0, y: 0, zoom: 1 }} measure={layout.measure} observe={layout.observe} node={() => null}>
        <Inside />
      </Canvas>
      <Drawer />
    </CanvasScope>
  ));
  centre!();
  expect(inner!()?.getViewport()).toEqual({ x: 200, y: 100, zoom: 2 });
  const panel = root.querySelector(".app-canvas-panel")!;
  expect(panel.getAttribute("data-position")).toBe("bottom-left");
  expect(panel.classList.contains("nopan")).toBe(true);
});

test("Canvas reads its callbacks when they fire, and takes everything down when it unmounts", () => {
  const layout = fakeLayout();
  const first = vi.fn();
  const second = vi.fn();
  const [onNodeClick, setOnNodeClick] = createSignal(first);
  const [shown, setShown] = createSignal(true);
  const root = mount(() => (
    <>
      {shown() && (
        <Canvas
          nodes={[card("a", 0, "First")]}
          viewport={{ x: 0, y: 0, zoom: 1 }}
          measure={layout.measure}
          observe={layout.observe}
          node={(node) => <p>{node().data.title}</p>}
          onNodeClick={onNodeClick()}
        />
      )}
    </>
  ));
  setOnNodeClick(() => second);
  const element = root.querySelector('[data-id="a"]')!;
  pointer(element, "pointerdown", 1, 1);
  pointer(element, "pointerup", 1, 1);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();

  setShown(false);
  expect(root.innerHTML).toBe("");
  expect(layout.observed.size).toBe(0);
});

test("useCanvas outside any canvas says what it needs", () => {
  function Lost() {
    useCanvas();
    return null;
  }
  expect(() => mount(() => <Lost />)).toThrow("useCanvas needs a CanvasScope or a Canvas around it");
});
