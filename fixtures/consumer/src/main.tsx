import "@wired-square/kit/theme.css";
import "@wired-square/kit/kit.css";

import { Button, Notice, SchemePicker, Section, applyScheme } from "@wired-square/kit";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";

applyScheme();

function App() {
  const [presses, setPresses] = createSignal(0);
  return (
    <Section title="Kit consumer" actions={<SchemePicker />}>
      <Notice tone="good">{presses() > 0 && `Pressed ${presses()} times`}</Notice>
      <Button tone="primary" onClick={() => setPresses((n) => n + 1)}>
        Press
      </Button>
    </Section>
  );
}

render(() => <App />, document.getElementById("app")!);
