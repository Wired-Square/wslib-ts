import "@wired-square/kit/theme.css";
import "@wired-square/kit/kit.css";
import "@wired-square/appliance-ui/shell.css";
import "@wired-square/appliance-ui/appliance.css";

import { SessionProvider, Settings } from "@wired-square/appliance-ui";
import type { Session } from "@wired-square/appliance-ui";
import { Button, Notice, Refusal as KitRefusal, SchemePicker, ScreenBoundary, Section, applyScheme } from "@wired-square/kit";
import { Refusal, refusalMessage } from "@wired-square/kit/core";
import { createSignal } from "solid-js";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";

applyScheme();

function Refused(): JSX.Element {
  throw new Refusal("Refused through core");
}

const controlSocket: Session = {
  branding: () => undefined,
  me: () => null,
  local: () => ({ username: "control-socket:admin", role: "admin", local: true }),
  refresh: () => {},
};

function App() {
  const [presses, setPresses] = createSignal(0);
  return (
    <Section title="Kit consumer" actions={<SchemePicker />}>
      <Notice tone="good">{presses() > 0 && `Pressed ${presses()} times`}</Notice>
      <Button tone="primary" onClick={() => setPresses((n) => n + 1)}>
        Press
      </Button>
      <ScreenBoundary pathname={() => "/"}>
        <Refused />
      </ScreenBoundary>
      <Notice tone="warn">{refusalMessage(new KitRefusal("Recognised by core"))}</Notice>
      <SessionProvider value={controlSocket}>
        <Settings section="certificates" view="ca" navigate={() => {}} />
      </SessionProvider>
    </Section>
  );
}

render(() => <App />, document.getElementById("app")!);
