import "@wired-square/appliance-ui/shell.css";
import "@wired-square/appliance-ui/appliance.css";

import { SessionProvider, Settings } from "@wired-square/appliance-ui";
import type { Session } from "@wired-square/appliance-ui";
import { render } from "solid-js/web";

const controlSocket: Session = {
  branding: () => undefined,
  me: () => null,
  local: () => ({ username: "control-socket:admin", role: "admin", local: true }),
  refresh: () => {},
};

render(
  () => (
    <SessionProvider value={controlSocket}>
      <Settings section="certificates" view="ca" navigate={() => {}} />
    </SessionProvider>
  ),
  document.getElementById("appliance")!,
);
