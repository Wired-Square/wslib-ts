/**
 * Logs: what the daemon has said about itself since it started.
 *
 * **It shows this daemon's own events and nothing else** — the blurb says
 * so, rather than leaving somebody to conclude the box is not logging. The
 * daemon reads no journal, so sshd and NetworkManager are `journalctl`
 * questions, and so is anything from before this start: the buffer is in
 * memory. A local session is worded for a service, whose whole log went to the
 * file the snapshot names, or wherever its own subscriber writes where it
 * names none.
 *
 * Both routes take `SessionAdmin` on an appliance and `Admin` on a local
 * backend. `transport` carries the feed where `EventSource` cannot reach it.
 *
 * **Ordered by `seq`, never by `at`** — see the wire type. The snapshot is
 * read on every `open` of the feed, which the daemon has subscribed before it
 * answers, and what the feed delivered meanwhile is folded in, so a line
 * emitted between the two reaches the screen once. The snapshot is the
 * daemon's newest, so it replaces the list: a reconnect after a restart —
 * `seq` restarts with the daemon — shows the new run and nothing of the old.
 */
import { LOG_LEVELS, LOG_RING } from "@wired-square/appliance-types";
import type { LogLevel, LogRecord, LogSnapshot } from "@wired-square/appliance-types";
import { Button, FeedStatus, Field, Notice, Section, Select, count, refusalMessage, time, when } from "@wired-square/kit";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { api, saveText } from "../api";
import { useFeed } from "../feed";
import type { FeedTransport } from "../follow";
import { useSession } from "../shell/session";

/** Position in the generated ladder, so "at least a warning" is `>=`. */
const rank = (level: LogLevel) => LOG_LEVELS.indexOf(level);

const fieldText = ([k, v]: [string, string]) => `${k}=${v}`;

/**
 * A record with what the screen derives from it, built once on arrival rather
 * than per keystroke and per render: the filter runs over the whole list on
 * every character typed and every line that lands.
 */
type Row = LogRecord & { rank: number; when: string; haystack: string };

function row(record: LogRecord): Row {
  return {
    ...record,
    rank: rank(record.level),
    when: time(record.at),
    haystack: `${record.message} ${record.target} ${record.fields.map(fieldText).join(" ")}`.toLowerCase(),
  };
}

/** Newest first, ignoring one already held, trimmed to what the daemon keeps. */
function inserted(list: Row[], record: LogRecord): Row[] {
  const found = list.findIndex((r) => r.seq <= record.seq);
  if (list[found]?.seq === record.seq) return list;
  const next = list.slice();
  next.splice(found < 0 ? list.length : found, 0, row(record));
  if (next.length > LOG_RING) next.length = LOG_RING;
  return next;
}

/** Many at once — one sort and one render — with a `seq` seen twice kept once. */
function merged(records: LogRecord[]): Row[] {
  return [...new Map(records.map((r) => [r.seq, r])).values()]
    .map(row)
    .sort((a, b) => b.seq - a.seq)
    .slice(0, LOG_RING);
}

export function Logs(props: { transport?: FeedTransport | undefined; title?: string }) {
  const [min, setMin] = createSignal<LogLevel>("trace");
  const [match, setMatch] = createSignal("");
  const [live, setLive] = createSignal<Row[]>([]);
  // Pause freezes what is shown, not what is kept: the list somebody is
  // reading does not move under the pointer, and Resume shows the current one.
  const [frozen, setFrozen] = createSignal<Row[]>();
  const [held, setHeld] = createSignal(0);
  // What the feed delivered since it last opened, folded into that open's
  // snapshot — the lines that landed while it was in flight.
  let sinceOpen: LogRecord[] = [];

  const feed = useFeed<{ log: LogRecord }>(
    "/api/logs/events",
    {
      log: (record) => {
        if (sinceOpen.length < LOG_RING) sinceOpen.push(record);
        setLive((list) => inserted(list, record));
        if (frozen()) setHeld((n) => n + 1);
      },
    },
    props.transport,
  );

  const [seeded] = createResource(feed.opened, async () => {
    // Reset here rather than on `open`: the fetcher starts synchronously
    // with the signal, before any line of the new connection can arrive.
    sinceOpen = [];
    const snapshot = await api<LogSnapshot>("/api/logs");
    setLive(merged([...snapshot.records, ...sinceOpen]));
    return snapshot;
  });

  const rows = () => frozen() ?? live();
  const resume = () => {
    setFrozen(undefined);
    setHeld(0);
  };
  // `seq` is contiguous from 1, so what is not on screen — evicted before
  // the tab opened, missed while it fell behind — is exact, with no counter.
  const notShown = () => Math.max(0, (live()[0]?.seq ?? 0) - live().length);

  const shown = createMemo(() => {
    const floor = rank(min());
    const needle = match().trim().toLowerCase();
    return rows().filter((r) => r.rank >= floor && (!needle || r.haystack.includes(needle)));
  });

  /** What a download holds: what is on screen, oldest first. */
  const asText = () =>
    shown()
      .slice()
      .reverse()
      .map((r) =>
        [`${r.at} ${r.level.toUpperCase().padEnd(5)} ${r.target}: ${r.message}`, ...r.fields.map(fieldText)].join(" "),
      )
      .join("\n");

  const { local } = useSession();
  const serviceLog = () => {
    const snapshot = seeded.error ? undefined : seeded();
    if (!snapshot) return "the service's log";
    return snapshot.log_file ? `the service's log file, ${snapshot.log_file}` : "the service's own log";
  };

  return (
    <Section
      title={props.title ?? "Logs"}
      blurb={
        local()
          ? `What this service has said since it started. A restart empties it; everything earlier went to ${serviceLog()}.`
          : "What this appliance has said since it started. A restart empties it; everything earlier, and everything else on the box, is in the system journal."
      }
    >
      <Show when={seeded.error}>
        <Notice tone="bad">{refusalMessage(seeded.error)}</Notice>
      </Show>

      <Show when={notShown() > 0}>
        <Notice tone="warn">
          {count(notShown(), "line")} not shown — this is a window, not everything.{" "}
          {local() ? `The rest went to ${serviceLog()}.` : "The system journal has the rest."}
        </Notice>
      </Show>

      <div class="app-log__controls">
        <Select
          label="Show"
          value={min()}
          onValue={(level) => setMin(level as LogLevel)}
        >
          <For each={LOG_LEVELS}>
            {(level) => (
              <option value={level}>
                {level === "trace" ? "everything" : `${level} and above`}
              </option>
            )}
          </For>
        </Select>
        <Field
          label="Filter"
          value={match()}
          onValue={setMatch}
          placeholder="message, module or field"
        />
        <div class="app-actions">
          <Button onClick={() => (frozen() ? resume() : setFrozen(live()))}>
            {frozen() ? "Resume" : "Pause"}
          </Button>
          <Button
            onClick={() =>
              saveText(`log-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`, asText())
            }
          >
            Download
          </Button>
        </div>
      </div>

      <p class="app-muted app-log__status" role="status">
        <FeedStatus live={feed.live()} heard={feed.heard()} />
        <Show
          when={feed.live()}
          fallback={
            !feed.closed()
              ? " — the feed is reconnecting."
              : local()
                ? " — this connection may not read it; only the service's administrators may."
                : " — this session may no longer read it. Sign in again as an administrator."
          }
        >
          <Show when={seeded.error ? undefined : seeded()}>
            {(snapshot) => <> — capturing since {when(snapshot().started_at)}</>}
          </Show>
        </Show>
        <Show when={held() > 0}>
          {" · "}
          <Button tone="plain" onClick={resume}>
            {count(held(), "line")} since paused — show
          </Button>
        </Show>
      </p>

      <div class="app-log">
        <Show
          when={shown().length > 0}
          fallback={
            <p class="app-log__empty">
              {rows().length === 0
                ? `Nothing logged yet. A healthy ${local() ? "service" : "appliance"} is quiet — it writes when something fails or changes.`
                : "Nothing matches this filter."}
            </p>
          }
        >
          <For each={shown()}>
            {(r) => (
              <div class="app-log__line" title={`${r.target} · ${r.at}`}>
                <span class="app-log__when numeric">{r.when}</span>
                <span class={`app-log__level app-log__level--${r.level}`}>
                  {r.level.toUpperCase()}
                </span>
                <span class="app-log__text">
                  {r.message}
                  <For each={r.fields}>
                    {(field) => <span class="app-log__field"> {fieldText(field)}</span>}
                  </For>
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </Section>
  );
}
