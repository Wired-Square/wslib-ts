/**
 * Settings → Audit: the durable record of what was done to this box.
 *
 * **Admin, because this names who did what.** An Operator can act on the
 * appliance; reading the record of everybody else's actions is a different
 * privilege, and the daemon's `Role` doc records rolling those together as the
 * mistake a prior appliance made with its middle tier.
 *
 * Paged by `createPagedList`, whose header says why Load more is offered on
 * the daemon's word and never on a full page.
 */
import type { AuditRecord, Page } from "@wired-square/appliance-types";
import { Button, Notice, Section, Table, Td, Th, Tr, createPagedList, when } from "@wired-square/kit";
import { For, Show } from "solid-js";

import { api } from "../api";

export function AuditLog(props: { title?: string }) {
  // No `limit`: the route's own default is a screenful with room to scroll,
  // and sending a number would be a second copy of it here — one the
  // generated constants do not carry, so nothing would notice the two
  // drifting apart. `MAX_AUDIT_PAGE` is the ceiling and is exported; the
  // default is the daemon's business.
  // No key: the wire carries no id, and a record is never patched.
  const log = createPagedList<AuditRecord>(
    (cursor) =>
      api<Page<AuditRecord>>(`/api/audit${cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`}`),
    null,
  );

  // Nothing is fetched until the screen is mounted and asks once.
  void log.refresh();

  return (
    <Section
      title={props.title ?? "Audit log"}
      blurb="Every change made to this appliance, and the sign-ins it refused, newest first."
    >
      <Notice tone="bad">{log.failed()}</Notice>

      <Show when={log.started() && log.rows().length === 0}>
        <Notice tone="neutral">
          Nothing has been recorded yet. This fills as people sign in — or
          fail to — and change things.
        </Notice>
      </Show>

      <Show when={log.rows().length > 0}>
        <Table
          head={
            <>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>What</Th>
            </>
          }
        >
          <For each={log.rows()}>
            {(row) => (
              <Tr>
                <Td numeric>{when(row.at)}</Td>
                <Td>{row.actor}</Td>
                <Td>
                  {row.message}
                  <Show when={row.fields.length > 0}>
                    <small class="app-table__fields">
                      <For each={row.fields}>
                        {([name, value]) => (
                          <span class="app-table__field">
                            {name}: {value}
                          </span>
                        )}
                      </For>
                    </small>
                  </Show>
                </Td>
              </Tr>
            )}
          </For>
        </Table>
      </Show>

      <Show when={log.hasMore() || log.pending()}>
        <div class="app-actions">
          <Button pending={log.pending()} onClick={() => void log.more()}>
            Load more
          </Button>
        </div>
      </Show>
    </Section>
  );
}
