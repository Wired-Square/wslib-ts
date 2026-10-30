/**
 * The text frames `/ws/serial` sends, by the back end's serde names; device
 * output arrives as binary frames. A stand-in for the back end's generated
 * types: everything else imports them from here, so the swap is one file.
 */

export type MonitorState = "resolving" | "opening" | "reading" | "backoff" | "tty_missing" | "paused";

/** Who typed something, in the colour (0–5) the back end gave them. */
export interface Who {
  by: string;
  colour: number;
}

/** Output bytes `start..start + len` of the next binary frame are `by`'s echoed input. */
export interface EchoSpan extends Who {
  start: number;
  len: number;
}

export type ConsoleVia = "controller" | "local";

export interface ConsoleUser {
  name: string;
  via: ConsoleVia;
  colour: number;
}

export type ConsoleEvent =
  | { type: "attached"; name: string; writes: boolean }
  | { type: "state"; state: MonitorState; label: string; message?: string }
  | { type: "spans"; spans: EchoSpan[] }
  | ({ type: "input"; marker: string } & Who)
  | { type: "participants"; participants: ConsoleUser[] }
  | { type: "refused"; message: string }
  | { type: "error"; message: string };
