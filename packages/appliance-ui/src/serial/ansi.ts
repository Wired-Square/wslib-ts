import type { EchoSpan, Who } from "./wire";

export type Ink = "bad" | "good" | "warn" | "accent" | "muted";

export interface Run {
  text: string;
  ink?: Ink;
  bold?: boolean;
  /** Whose echoed input this is. */
  who?: Who;
  /** A marker the console added, not device output. */
  mark?: boolean;
}

export type Line = Run[];

const INK: Record<number, Ink> = {
  31: "bad",
  32: "good",
  33: "warn",
  34: "accent",
  35: "accent",
  36: "accent",
  90: "muted",
  91: "bad",
  92: "good",
  93: "warn",
  94: "accent",
  95: "accent",
  96: "accent",
};

// CSI (ESC [ … final), OSC (ESC ] … BEL or ESC \), or a two-byte escape.
const ESCAPE = /\x1b(?:\[([0-9;?]*)([@-~])|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/y;
const UNFINISHED = /\x1b(?:\[[0-9;?]*|\][^\x07\x1b]*\x1b?)?$/;

/**
 * Serial bytes as styled lines, a changed line replaced rather than edited so a
 * keyed list redraws only that one: SGR colour and bold are kept, every other
 * control sequence is dropped, and a bare CR starts the line again, as a
 * terminal's progress line does. Chunks may split a character or an escape.
 */
export class Scrollback {
  readonly lines: Line[] = [[]];
  private readonly keep: number;
  private readonly decoder = new TextDecoder();
  private carried = "";
  private ink: Ink | undefined;
  private bold = false;
  private returned = false;

  constructor(keep = 2000) {
    this.keep = keep;
  }

  /** Device output, `spans` of it marked as whose echo it is. */
  output(bytes: Uint8Array, spans: readonly EchoSpan[]): void {
    let at = 0;
    for (const span of spans) {
      if (span.start > at) this.write(bytes.subarray(at, span.start));
      this.write(bytes.subarray(span.start, span.start + span.len), span);
      at = span.start + span.len;
    }
    if (at < bytes.length) this.write(bytes.subarray(at));
  }

  /** Inline text of the console's own, marked as `who`'s. */
  note(text: string, who: Who): void {
    this.put(text, who, true);
  }

  write(chunk: Uint8Array | string, who?: Who): void {
    const text = this.carried + (typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true }));
    const unfinished = UNFINISHED.exec(text);
    const whole = unfinished ? text.slice(0, unfinished.index) : text;
    this.carried = unfinished ? unfinished[0] : "";

    let plain = "";
    for (let i = 0; i < whole.length; ) {
      const c = whole[i]!;
      if (c === "\x1b") {
        ESCAPE.lastIndex = i;
        const m = ESCAPE.exec(whole);
        this.put(plain, who);
        plain = "";
        if (!m) {
          i += 1;
          continue;
        }
        if (m[2] === "m") this.style(m[1] ?? "");
        i = ESCAPE.lastIndex;
        continue;
      }
      if (c === "\n" || c === "\r") {
        this.put(plain, who);
        plain = "";
        if (c === "\n") this.newLine();
        else this.returned = true;
      } else if (c >= " " || c === "\t") {
        plain += c;
      }
      i += 1;
    }
    this.put(plain, who);
  }

  private put(text: string, who?: Who, mark = false): void {
    if (!text) return;
    if (this.returned) {
      this.lines[this.lines.length - 1] = [];
      this.returned = false;
    }
    const line = this.lines[this.lines.length - 1]!;
    const last = line[line.length - 1];
    const same =
      last &&
      last.ink === this.ink &&
      Boolean(last.bold) === this.bold &&
      last.who?.by === who?.by &&
      Boolean(last.mark) === mark;
    this.lines[this.lines.length - 1] = same
      ? [...line.slice(0, -1), { ...last, text: last.text + text }]
      : [
          ...line,
          {
            text,
            ...(this.ink && { ink: this.ink }),
            ...(this.bold && { bold: true }),
            ...(who && { who: { by: who.by, colour: who.colour } }),
            ...(mark && { mark: true }),
          },
        ];
  }

  private newLine(): void {
    this.returned = false;
    this.lines.push([]);
    if (this.lines.length > this.keep) this.lines.splice(0, this.lines.length - this.keep);
  }

  private style(params: string): void {
    for (const p of (params || "0").split(";").map(Number)) {
      if (p === 0) {
        this.ink = undefined;
        this.bold = false;
      } else if (p === 1) this.bold = true;
      else if (p === 22) this.bold = false;
      else if (p === 39) this.ink = undefined;
      else if (Object.hasOwn(INK, p)) this.ink = INK[p];
      else if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) this.ink = undefined;
    }
  }
}
