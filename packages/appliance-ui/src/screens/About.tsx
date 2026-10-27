/**
 * Settings → About: what this installation is, and whether each optional part
 * of it came up.
 *
 * **Superseded by the box OS that runs products as containers: frozen, fixes
 * only, and removed in a later release, which its migration note will list.**
 *
 * Two lists the daemon fills: the facts under "This installation" — the
 * backend's typed rows, then the product's — and the subsystems, rendered
 * without knowing what any of them is. A subsystem not running is marked, and
 * the screen says that is normal; the `Subsystem` wire type has the argument.
 */
import type { AboutView, Availability } from "@wired-square/appliance-types";
import { Loaded, Section, duration, when } from "@wired-square/kit";
import { For, Show, createResource } from "solid-js";

import { api } from "../api";

export function About() {
  const [about, { refetch }] = createResource(() => api<AboutView>("/api/about"));

  return (
    <Loaded of={about} refetch={refetch} reading="this installation">
      {(view) => (
        <>
          <Section title="This installation">
            <dl class="app-details">
              <dt>{view().product}</dt>
              <dd>
                <strong>{view().version}</strong>
              </dd>

              <dt>Hostname</dt>
              <dd>{view().hostname ?? "—"}</dd>

              <dt>Operating system</dt>
              <dd>{view().os ?? "—"}</dd>

              <dt>Kernel</dt>
              <dd>
                <code>{view().kernel ?? "—"}</code>{" "}
                <span class="app-muted">{view().architecture}</span>
              </dd>

              <dt>Daemon uptime</dt>
              <dd>{duration(view().daemon_uptime_s)}</dd>

              <dt>Daemon last started</dt>
              <dd>{when(view().daemon_started_at)}</dd>

              <dt>Host uptime</dt>
              <dd>{duration(view().host_uptime_s)}</dd>

              <For each={view().facts}>
                {(fact) => (
                  <>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </>
                )}
              </For>
            </dl>
          </Section>

          <Section title="Subsystems">
            <dl class="app-details">
              <For each={view().subsystems}>
                {(subsystem) => (
                  <>
                    <dt>{subsystem.name}</dt>
                    <dd>
                      <Show when={subsystem.availability.state === "unsupported"}>
                        <span class="app-about__absent">Not running — </span>
                      </Show>
                      {detail(subsystem.availability)}
                    </dd>
                  </>
                )}
              </For>
            </dl>
            <p class="app-muted">
              Not running is not necessarily a fault: each subsystem is optional, and
              the daemon starts without it by design.
            </p>
          </Section>
        </>
      )}
    </Loaded>
  );
}

/** The mechanism in use, or why there is none. */
const detail = (of: Availability) => (of.state === "ready" ? of.via : of.because);
