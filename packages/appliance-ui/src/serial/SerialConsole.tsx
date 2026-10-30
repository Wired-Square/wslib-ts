import { For, Match, Show, Switch, createSignal, onCleanup } from "solid-js";
import type { JSX } from "solid-js";
import { Button, Notice, Select } from "@wired-square/kit";

import { Scrollback } from "./ansi";
import type { Line } from "./ansi";
import { BAUDS, DEFAULT_BAUD, keyBytes, openLink, serialUrl } from "./link";
import type { ConsolePort, Link, LinkState, ShownEvent } from "./link";
import type { ConsoleUser, MonitorState } from "./wire";

export type SerialConsoleProps = ({ url: string } | { port: ConsolePort; baud?: number }) & {
  /** Names the port, in the heading and the console's accessible name. */
  label: string;
  readOnly?: boolean;
  /** A short caution above the console, such as that opening the port may reset the board. */
  warning?: JSX.Element;
};

/**
 * A shared `/ws/serial` console, opened on mount and closed on unmount. Given a
 * port rather than a URL it offers the bauds, and a new baud reopens it.
 */
export function SerialConsole(props: SerialConsoleProps) {
  const [baud, setBaud] = createSignal(("port" in props && props.baud) || DEFAULT_BAUD);
  const url = () => ("url" in props ? props.url : serialUrl(props.port, baud()));
  const heading = () => ("url" in props ? props.label : `${props.label} (requested ${baud()} baud)`);

  return (
    <div class="app-serial">
      <Show when={props.warning}>
        <Notice tone="warn">{props.warning}</Notice>
      </Show>
      <Show when={"port" in props}>
        <Select
          label="Baud"
          hint={
            "Changing it reopens the console. The first to open the port sets its baud; ESP32 boot messages are at 74880."
          }
          value={String(baud())}
          onValue={(v) => setBaud(Number(v))}
        >
          <For each={BAUDS}>{(b) => <option value={b}>{b}</option>}</For>
        </Select>
      </Show>
      <Show when={url()} keyed>
        {(opened) => <Pane url={opened} heading={heading()} label={props.label} readOnly={Boolean(props.readOnly)} />}
      </Show>
    </div>
  );
}

function Pane(props: { url: string; heading: string; label: string; readOnly: boolean }) {
  const screen = new Scrollback();
  const encoder = new TextEncoder();
  const [lines, setLines] = createSignal<readonly Line[]>([[]]);
  const [link, setLink] = createSignal<LinkState>({ is: "connecting" });
  const [monitor, setMonitor] = createSignal<{ state: MonitorState; label: string; message?: string }>();
  const [me, setMe] = createSignal<{ name: string; writes: boolean }>();
  const [people, setPeople] = createSignal<readonly ConsoleUser[]>([]);
  const [refused, setRefused] = createSignal<string>();
  const [typingOn, setTypingOn] = createSignal(false);
  let pane: HTMLPreElement | undefined;
  let current: Link | undefined;
  let everOpened = false;

  const paused = () => monitor()?.state === "paused";
  const mayType = () => link().is === "open" && Boolean(me()?.writes) && !props.readOnly;
  const typing = () => mayType() && typingOn() && !paused();

  const show = (paint: () => void) => {
    const following = pane ? pane.scrollHeight - pane.scrollTop - pane.clientHeight < 24 : true;
    paint();
    setLines(screen.lines.slice());
    if (following && pane) pane.scrollTop = pane.scrollHeight;
  };

  const heard = (event: ShownEvent) => {
    switch (event.type) {
      case "attached":
        return setMe(event);
      case "state":
        if (event.state !== "paused") setRefused(undefined);
        return setMonitor(event);
      case "participants":
        return setPeople(event.participants);
      case "input":
        return show(() => screen.note(event.marker, event));
      case "refused":
        return setRefused(event.message);
      case "error":
        return show(() => screen.write(`\r\n\x1b[31m[serial: error — ${event.message}]\x1b[0m\r\n`));
    }
  };

  const connect = () => {
    current = openLink(props.url, {
      state: (state) => {
        if (state.is === "open") {
          setRefused(undefined);
          if (everOpened) show(() => screen.mark("— reconnected —"));
          everOpened = true;
        }
        setLink(state);
      },
      output: (bytes, spans) => show(() => screen.output(bytes, spans)),
      event: heard,
    });
  };
  connect();
  onCleanup(() => current?.close());

  const send = (text: string) => {
    if (!typing() || !current?.send(encoder.encode(text))) return false;
    setRefused(undefined);
    return true;
  };
  const key = (event: KeyboardEvent) => {
    const bytes = keyBytes(event);
    if (bytes !== undefined && send(bytes)) event.preventDefault();
  };
  const paste = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text");
    if (text && send(text)) event.preventDefault();
  };

  const state = () => (link().is === "open" ? (monitor()?.label ?? "Connected") : undefined);

  return (
    <div class="app-console">
      <div class="app-console__head">
        <span>{props.heading}</span>
        <span
          class={`app-console__state app-console__state--${paused() ? "paused" : link().is}`}
          role="status"
          title={monitor()?.message}
        >
          <Switch>
            <Match when={state()}>
              {(shown) => (
                <>
                  {shown()}
                  <Show when={paused() && monitor()?.message}>{(progress) => <> ({progress()})</>}</Show>
                </>
              )}
            </Match>
            <Match when={link().is === "connecting"}>Connecting…</Match>
            <Match when={link().is === "retrying"}>Dropped, reconnecting</Match>
            <Match when={link().is === "unreachable"}>Not connected</Match>
          </Switch>
        </span>
        <Show when={mayType()}>
          <Button
            tone="plain"
            disabled={paused()}
            onClick={() => {
              setTypingOn(!typingOn());
              if (typingOn()) pane?.focus();
            }}
          >
            {typingOn() ? "Stop typing" : "Type"}
          </Button>
        </Show>
      </div>
      <Show when={link().is === "unreachable"}>
        <Notice tone="bad">
          The serial console didn't connect. Check that you are signed in, then try again.{" "}
          <Button tone="plain" onClick={connect}>
            Try again
          </Button>
        </Notice>
      </Show>
      <Show when={people().length > 0}>
        <ul class="app-console__users" aria-label="Attached">
          <For each={people()}>
            {(who) => (
              <li class={`app-console__who--${who.colour}`}>
                {who.name}
                <span class="app-muted">
                  {who.via === "local" ? (who.name === me()?.name ? " (you)" : "") : " (relayed)"}
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <p class="app-console__hint app-muted">
        <Switch
          fallback={
            "Keys and pastes go to the port, Tab and Escape included; Shift+Tab leaves. Everyone attached sees what you send."
          }
        >
          <Match when={link().is !== "open"}>Input is off until the console connects.</Match>
          <Match when={props.readOnly}>Read-only.</Match>
          <Match when={!me()?.writes}>Read-only: this session can watch but not type.</Match>
          <Match when={paused()}>
            Input is off while the port is paused, as for a flash. It comes back when the pause ends.
          </Match>
          <Match when={!typingOn()}>Input is off. Choose Type to send keys and pastes to the port.</Match>
        </Switch>
      </p>
      <pre
        class="app-console__screen"
        ref={pane}
        tabindex="0"
        aria-label={`Serial console for ${props.label}`}
        onKeyDown={key}
        onPaste={paste}
      >
        <For each={lines()}>
          {(line) => (
            <span>
              <For each={line}>
                {(run) => (
                  <span
                    classList={{
                      [`app-console__ink--${run.ink}`]: Boolean(run.ink) && !run.who,
                      [`app-console__who--${run.who?.colour}`]: Boolean(run.who),
                      "app-console__ink--bold": Boolean(run.bold),
                      "app-console__mark": Boolean(run.mark),
                    }}
                    title={run.who?.by}
                  >
                    {run.text}
                  </span>
                )}
              </For>
              {"\n"}
            </span>
          )}
        </For>
      </pre>
      <Show when={refused()}>
        {(message) => (
          <p class="app-console__refusal" role="status">
            {refusal(message())}
          </p>
        )}
      </Show>
    </div>
  );
}

const REFUSALS: [RegExp, string][] = [
  [/paused/i, "Not sent while the port is paused."],
  [/no active reader/i, "Not sent: nothing is reading this port, so input can't be sent."],
];

function refusal(message: string): JSX.Element {
  const known = REFUSALS.find(([pattern]) => pattern.test(message));
  return known ? (
    known[1]
  ) : (
    <>
      Not sent. <small class="app-muted">{message}</small>
    </>
  );
}
