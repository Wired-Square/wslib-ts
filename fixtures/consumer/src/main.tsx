import "@wired-square/kit/theme.css";
import "@wired-square/kit/kit.css";

import { Button, Notice, Refusal as KitRefusal, SchemePicker, ScreenBoundary, Section, applyScheme } from "@wired-square/kit";
import { Refusal, refusalMessage } from "@wired-square/kit/core";
import { check } from "@wired-square/icons/solid";
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";

applyScheme();

function Refused(): JSX.Element {
  throw new Refusal("Refused through core");
}

function App() {
  const [presses, setPresses] = createSignal(0);
  return (
    <Section title="Kit consumer" actions={<SchemePicker />}>
      <Notice tone="good">{presses() > 0 && `Pressed ${presses()} times`}</Notice>
      <Button tone="primary" onClick={() => setPresses((n) => n + 1)}>
        {check({ class: "fixture-check" })}
        Press
      </Button>
      <ScreenBoundary pathname={() => "/"}>
        <Refused />
      </ScreenBoundary>
      <Notice tone="warn">{refusalMessage(new KitRefusal("Recognised by core"))}</Notice>
    </Section>
  );
}

render(() => <App />, document.getElementById("app")!);
