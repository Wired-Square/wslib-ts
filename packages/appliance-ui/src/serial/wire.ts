/**
 * The text frames `/ws/serial` sends, generated from the back end's types by
 * `scripts/serial-console-sync.mjs`; device output arrives as binary frames.
 */
import type { Participant } from "./generated/Participant";
import type { Span } from "./generated/Span";

export type { ConsoleEvent } from "./generated/ConsoleEvent";
export type { MonitorState } from "./generated/MonitorState";
export type { RefusalReason } from "./generated/RefusalReason";

export type EchoSpan = Span;
export type ConsoleUser = Participant;

/** Who typed something, in the colour (0–5) the back end gave them. */
export type Who = Pick<Span, "by" | "colour">;
