/**
 * The daemon's two logs as views of one screen: "Since restart", `Logs`, the
 * ring this run keeps, then "Audit trail", `AuditLog`, what people did, which
 * outlives a restart. They are not two filters over one list: shown as one, a
 * cleared ring would read as nothing having happened.
 *
 * A switch unmounts the hidden view, so the ring's feed is closed while the
 * trail is shown and re-seeded on the way back. `transport` carries it.
 */
import { Views, routed } from "@wired-square/kit";
import type { Routed } from "@wired-square/kit";

import type { FeedTransport } from "../follow";
import { AuditLog } from "./AuditLog";
import { Logs } from "./Logs";

export function LogViews(props: Routed & { transport?: FeedTransport }) {
  return (
    <Views
      aria-label="Logs"
      group="logs"
      views={[
        {
          id: "since-restart",
          label: "Since restart",
          panel: () => <Logs title="Since restart" transport={props.transport} />,
        },
        { id: "audit", label: "Audit trail", panel: () => <AuditLog title="Audit trail" /> },
      ]}
      {...routed(props)}
    />
  );
}
