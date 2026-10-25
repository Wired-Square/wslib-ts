/** A failure written for a person, or with `unanswered`, a request nothing answered. */
export class Refusal extends Error {
  readonly unanswered: boolean;

  constructor(message: string, options: { unanswered?: boolean } = {}) {
    super(message);
    this.name = "Refusal";
    this.unanswered = options.unanswered ?? false;
  }
}

/**
 * A `Refusal`'s own message, and a fixed sentence for anything else: any other
 * error's text was written for a console, and may carry anything at all.
 */
export function refusalMessage(error: unknown): string {
  if (error instanceof Refusal) return error.message;
  console.error("unexpected failure reaching a screen", error);
  return "something went wrong in this page";
}

export function unanswered(error: unknown): boolean {
  return error instanceof Refusal && error.unanswered;
}
