import { ApiError, api, fromBase, withSession } from "../api";
import type { ConsoleEvent, EchoSpan } from "./wire";

export const DEFAULT_BAUD = 115200;
export const BAUDS = [115200, 74880, 57600, 38400, 19200, 9600] as const;

export interface ConsolePort {
  path: string;
  serialNumber: string | null;
}

/** The app's own `/ws/serial`, from the page's base; the baud is sent only when it isn't the default. */
export function serialUrl(port: ConsolePort, baud: number, page = fromBase("/ws/serial")): string {
  const url = new URL(page);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("address", port.path);
  if (port.serialNumber) url.searchParams.set("usb_serial", port.serialNumber);
  if (baud !== DEFAULT_BAUD) url.searchParams.set("baud", String(baud));
  return url.href;
}

/**
 * A console is `open` once the back end says it is attached. `unreachable` is
 * one the back end refused, by refusing the upgrade or by closing before
 * attaching, or whose session no longer holds, with its `error` message when it
 * sent one; a retry would not change that. One that was attached and then
 * dropped is `retrying`, and redials only once the session is answered for.
 */
export type LinkState =
  | { is: "connecting" }
  | { is: "open" }
  | { is: "retrying"; inMs: number }
  | { is: "unreachable"; message?: string };

export type ShownEvent = Exclude<ConsoleEvent, { type: "spans" }>;

export interface LinkEvents {
  state: (state: LinkState) => void;
  output: (bytes: Uint8Array, spans: readonly EchoSpan[]) => void;
  event: (event: ShownEvent) => void;
}

export interface Link {
  close: () => void;
  /** False when the console isn't open. */
  send: (bytes: Uint8Array<ArrayBuffer>) => boolean;
}

type Socket = Pick<WebSocket, "binaryType" | "close" | "onmessage" | "onclose" | "send" | "readyState">;

const OPEN = 1;

const FIRST_RETRY_MS = 1000;
const LAST_RETRY_MS = 15000;
const SESSION_WAIT_MS = 5000;

/** The status `GET /api/session` answers with, 0 when nothing answered. */
function sessionStatus(): Promise<number> {
  return api("/api/session", { signal: AbortSignal.timeout(SESSION_WAIT_MS) }).then(
    () => 200,
    (error) => (error instanceof ApiError ? error.status : 0),
  );
}

interface LinkDeps {
  socket?: (url: string) => Socket;
  session?: () => Promise<number>;
}

/**
 * A `spans` event names whose echo is in the binary frame after it. A redial waits for a shown tab, then asks for the
 * session: a 401 or 403 is `unreachable`, no answer or a 5xx waits longer, and any other answer dials.
 */
export function openLink(
  url: string,
  on: LinkEvents,
  { socket = (url) => new WebSocket(url), session = sessionStatus }: LinkDeps = {},
): Link {
  let retryMs = FIRST_RETRY_MS;
  let closed = false;
  let current: Socket | undefined;
  let spans: readonly EchoSpan[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unpark = () => {};

  const retry = () => {
    on.state({ is: "retrying", inMs: retryMs });
    timer = setTimeout(redial, retryMs);
    retryMs = Math.min(retryMs * 2, LAST_RETRY_MS);
  };

  const redial = async () => {
    if (globalThis.document?.hidden) {
      const shown = () => {
        if (document.hidden) return;
        unpark();
        void redial();
      };
      document.addEventListener("visibilitychange", shown);
      unpark = () => document.removeEventListener("visibilitychange", shown);
      return;
    }
    const status = await session();
    if (closed) return;
    if (status === 401 || status === 403) on.state({ is: "unreachable" });
    else if (status === 0 || status >= 500) retry();
    else dial();
  };

  const dial = () => {
    on.state({ is: "connecting" });
    const ws = socket(withSession(url));
    current = ws;
    ws.binaryType = "arraybuffer";
    let attached = false;
    let error: string | undefined;
    ws.onmessage = (event: MessageEvent) => {
      const data = event.data as ArrayBuffer | string;
      if (typeof data !== "string") {
        on.output(new Uint8Array(data), spans);
        spans = [];
        return;
      }
      const parsed = parse(data);
      if (parsed?.type === "spans") spans = parsed.spans;
      else if (parsed) {
        if (parsed.type === "attached" && !attached) {
          attached = true;
          retryMs = FIRST_RETRY_MS;
          on.state({ is: "open" });
        }
        if (parsed.type === "error") error = parsed.message;
        on.event(parsed);
      }
    };
    ws.onclose = () => {
      spans = [];
      if (closed) return;
      if (attached) retry();
      else on.state(error === undefined ? { is: "unreachable" } : { is: "unreachable", message: error });
    };
  };

  dial();
  return {
    close: () => {
      closed = true;
      clearTimeout(timer);
      unpark();
      current?.close();
    },
    send: (bytes) => {
      if (current?.readyState !== OPEN) return false;
      current.send(bytes);
      return true;
    },
  };
}

function parse(text: string): ConsoleEvent | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const KEYS: Record<string, string> = {
  Enter: "\r",
  Tab: "\t",
  Backspace: "\x7f",
  Escape: "\x1b",
  ArrowUp: "\x1b[A",
  ArrowDown: "\x1b[B",
  ArrowRight: "\x1b[C",
  ArrowLeft: "\x1b[D",
  Home: "\x1b[H",
  End: "\x1b[F",
  Delete: "\x1b[3~",
};

/**
 * What a terminal sends for a key, or nothing for one it doesn't (Cmd shortcuts, bare modifiers). Shift+Tab is
 * never sent, so a keyboard can always leave the console.
 */
export function keyBytes(
  key: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey">,
): string | undefined {
  if (key.metaKey || (key.shiftKey && key.key === "Tab")) return undefined;
  if (key.ctrlKey) {
    const code = key.key.length === 1 ? key.key.toUpperCase().charCodeAt(0) : 0;
    return code >= 0x40 && code <= 0x5f ? String.fromCharCode(code - 0x40) : undefined;
  }
  return KEYS[key.key] ?? (key.key.length === 1 && !key.altKey ? key.key : undefined);
}
