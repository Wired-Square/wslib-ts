import "@wired-square/canvas/canvas.css";

import { Canvas, CanvasPanel, CanvasScope, useCanvas } from "@wired-square/canvas";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";

// The fixture runs in jsdom, which lays nothing out.
const laidOut = () => ({ width: 400, height: 300 });

function Zoom() {
  const canvas = useCanvas();
  return <button onClick={() => void canvas()?.setViewport({ x: 0, y: 0, zoom: 2 })}>Zoom</button>;
}

function Board() {
  const [title, setTitle] = createSignal("Pinned");
  return (
    <CanvasScope>
      <Canvas
        nodes={[{ id: "a", x: 10, y: 10, data: null }]}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        measure={laidOut}
        controls
        node={() => (
          <button class="face" onClick={() => setTitle("Moved")}>
            {title()}
          </button>
        )}
      />
      <CanvasPanel position="top-left">
        <Zoom />
      </CanvasPanel>
    </CanvasScope>
  );
}

render(() => <Board />, document.getElementById("canvas")!);
