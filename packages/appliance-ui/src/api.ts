/**
 * Talking to the appliance, and the one place a refusal becomes a thrown error.
 *
 * The daemon answers every refusal it *constructs* with an `ApiErrorBody` — one
 * shape to parse. **"Constructs" is the limit:** an input it cannot deserialise is
 * refused before any handler runs and comes back as `text/plain`.
 *
 * So the parse is attempted and its failure is an ordinary outcome. A client doing
 * `(await response.json()).error` throws a `SyntaxError` from its error path,
 * turning "you sent a number where a string goes" into something that reads like
 * the appliance fell over.
 */
import type { ApiErrorBody, ClockSkew } from "@wired-square/appliance-types";
import { Refusal } from "@wired-square/kit/core";

/**
 * A request the appliance refused, or a response that never arrived.
 *
 * `status` is 0 for a fetch that failed outright — no network, TLS refused,
 * the daemon restarting — for most bodies cut off before they were read in
 * full (`api` says which), and for a proxy's bare 502 or 504, which is the same
 * thing seen from behind a proxy. That is a different thing from any refusal and
 * a screen usually says so differently, which is why it is not folded into a 503.
 *
 * A kit `Refusal`, so the kit renders its message, and `unanswered` when
 * `status` is 0. It is not one a screen raised itself: test for that as
 * `!(error instanceof ApiError)`.
 */
export class ApiError extends Refusal {
  readonly status: number;

  /**
   * Whether `message` came out of an `ApiErrorBody`.
   *
   * `false` means the appliance refused this in a way its own error contract
   * does not cover, and the message is whatever text came back. Worth
   * distinguishing because such a message is written for a developer reading a
   * terminal rather than for an operator reading a screen.
   */
  readonly fromErrorBody: boolean;

  /** How far the box's clock is off, on a code refused for it. */
  readonly clockSkew: ClockSkew | undefined;

  constructor(status: number, message: string, fromErrorBody: boolean, clockSkew?: ClockSkew) {
    super(message, { unanswered: status === 0 });
    this.name = "ApiError";
    this.status = status;
    this.fromErrorBody = fromErrorBody;
    this.clockSkew = clockSkew;
  }
}

/** Whether a failure is the session being gone — a 401 — which shows sign-in. */
export function unauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

const unauthenticatedListeners = new Set<() => void>();

/**
 * Hear every 401 `api` or `download` is answered with, whichever screen asked:
 * a session that expired or was revoked under an open tab is otherwise noticed
 * by nobody. The shell listens; the return value stops listening.
 */
export function onUnauthenticated(listener: () => void): () => void {
  unauthenticatedListeners.add(listener);
  return () => unauthenticatedListeners.delete(listener);
}

const UNANSWERED = "nothing answered — it may be restarting, or unreachable from here";

const ANSWER_WAIT_MS = 60_000;
const UPLOAD_WAIT_MS = 10 * 60_000;

/**
 * A fresh `signal` for each call that uploads a bundle, whose answer may take
 * minutes to begin over a slow link.
 */
export const slowAnswer = () => AbortSignal.timeout(UPLOAD_WAIT_MS);

/**
 * Rethrow `error` with `means` in place of the fixed "nothing answered" sentence
 * when it is the transport failure — for the requests whose success is what
 * takes the connection away: an address change, a Wi-Fi join, a reset that
 * re-addresses the box. Anything else is rethrown as it was.
 */
export function unansweredMeans(error: unknown, means: string): never {
  if (error instanceof ApiError && error.status === 0) {
    throw new ApiError(0, means, false);
  }
  throw error;
}

/**
 * A path the appliance serves, `/api/…` included, resolved against
 * `document.baseURI`, so the page works under whatever base path the daemon
 * serves it at. `api`, `download` and the shell already do this; a link or an
 * `EventSource` of a product's own needs it.
 */
export function fromBase(path: string): string {
  const base = globalThis.document?.baseURI;
  return base ? new URL(path.replace(/^\/+/, ""), base).href : path;
}

/** The request header the session's second secret travels in, both ways. */
export const SESSION_HEADER = "appliance-session";

/** The query parameter carrying the secret on a `GET` that can't set a header. */
export const SESSION_QUERY = "appliance_session";

/** Where the app keeps the session's second secret; `keep(undefined)` forgets it. */
export interface SessionStore {
  read(): string | undefined;
  keep(secret: string | undefined): void;
}

let session: SessionStore | undefined;

/**
 * Carry the secret `store` holds on every request to the page base's `api/` and
 * `ws/`, keeping each one handed back; `undefined` stops carrying one.
 */
export function carrySession(store: SessionStore | undefined): void {
  session = store;
}

const pageBase = () => new URL("./", globalThis.document?.baseURI ?? "http://localhost/");

function guarded(url: string | URL): boolean {
  const base = pageBase();
  const at = new URL(url, base);
  return at.host === base.host && ["api/", "ws/"].some((under) => at.pathname.startsWith(base.pathname + under));
}

/** `url` with the secret in its query, for an `EventSource`, a `WebSocket` or a link of the app's own. */
export function withSession(url: string): string {
  const secret = session?.read();
  if (!secret || !guarded(url)) return url;
  const carrying = new URL(url, pageBase());
  carrying.searchParams.set(SESSION_QUERY, secret);
  return carrying.href;
}

/** `fetch`, carrying the secret to a guarded `url`; a 401 without a new one forgets it. */
export async function fetchWithSession(url: string | URL, init: RequestInit): Promise<Response> {
  const store = session;
  if (!store || !guarded(url)) return fetch(url, init);
  const headers = new Headers(init.headers);
  const secret = store.read();
  if (secret) headers.set(SESSION_HEADER, secret);
  const response = await fetch(url, { ...init, headers });
  const handed = response.headers.get(SESSION_HEADER);
  if (handed) store.keep(handed);
  else if (response.status === 401) store.keep(undefined);
  return response;
}

/**
 * Like `RequestInit`, but `body` is the value to send rather than a string,
 * or a `FormData` sent as it is.
 *
 * The serialising is here so that every call site is one object literal, and so
 * that `Content-Type` cannot be forgotten at one of them.
 */
export interface ApiInit extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * One request to the appliance, resolving to its parsed body.
 *
 * `T` is the wire type the route answers with, and it should be the generated
 * one rather than be written out here. The body going the other way has a
 * generated type too, and `satisfies` is how to use it — it checks the literal
 * without widening what is sent:
 *
 *     import type { PinPeer } from "@wired-square/appliance-ui";
 *
 *     await api<TrustedCert>("/api/tls/pins", {
 *       method: "POST",
 *       body: { url, expect_sha256 } satisfies PinPeer,
 *     });
 *
 * **A 204 resolves to `null`**, so a call to a route that answers one asks for
 * `api<null>`, and so does a 202 with no body.
 * Returning `undefined` typed as the caller's `T` is the shorter lie: routes that
 * change something answer 204 with no body.
 *
 * `credentials: "same-origin"` is what carries the session cookie. It is the
 * default for a same-origin request and stated anyway, because the browser half
 * and the API are same-origin in production and *not* during development, where
 * vite proxies.
 *
 * **A call whose answer has not begun within a minute fails**; the body is not
 * timed. A `signal` in `init` replaces that wait. A body cut off, by that
 * `signal` or by the connection dropping, fails the call the same way; a
 * refusal's keeps its status unless that `signal` cut it off and it is not a 401.
 *
 * @throws {ApiError} for any non-2xx answer, and for a request whose answer
 * never began — no connection, or no headers within the wait — or whose body
 * was cut off.
 * @throws {SyntaxError} for a 2xx answer, other than 204 or 205, whose body is
 * not JSON — an empty one included.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const response = await send(path, init);

  // 204 is the appliance's answer for "done, and there is nothing to tell you".
  // 205 is not used today; it is here because both are defined as bodiless.
  if (response.status === 204 || response.status === 205) {
    return null as unknown as T;
  }
  const text = await unansweredIfCutOff(response.text());
  // 202 is "accepted, under way", which says nothing more.
  if (response.status === 202 && text === "") return null as unknown as T;
  return JSON.parse(text) as T;
}

/**
 * A body whose bytes stopped arriving — the signal fired, or the connection
 * dropped — is unanswered, as `send` says of a fetch cut off before its headers.
 */
async function unansweredIfCutOff<T>(read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch {
    throw new ApiError(0, UNANSWERED, false);
  }
}

/**
 * Make the request and hand back a response that was not a refusal.
 *
 * Shared by [`api`] and [`download`], which differ only in what they do with
 * the bytes: two copies of this would be two places for the credentials mode,
 * the JSON header or the unanswered sentence to drift.
 */
async function send(path: string, init: ApiInit): Promise<Response> {
  const { body, headers, ...rest } = init;
  const sending = body !== undefined;
  // A form goes as the browser frames it, boundary and all.
  const form = body instanceof FormData;

  // Through `Headers` rather than an object spread. `HeadersInit` is three
  // shapes — a `Headers`, an array of pairs, a record — and spreading the first
  // two produces something that is not headers at all, silently and only for a
  // caller that happened to pass one.
  const sent = new Headers(headers);
  if (sending && !form) sent.set("content-type", "application/json");

  const waiting = new AbortController();
  const timer = rest.signal ? undefined : setTimeout(() => waiting.abort(), ANSWER_WAIT_MS);
  const request: RequestInit = {
    credentials: "same-origin",
    ...rest,
    headers: sent,
    signal: rest.signal ?? waiting.signal,
  };
  if (sending) request.body = form ? body : JSON.stringify(body);

  let response: Response;
  try {
    response = await fetchWithSession(fromBase(path), request);
  } catch {
    // Nothing was refused — nothing was answered. `fetch` rejects only for a
    // transport failure or an abort, so this is the appliance being unreachable
    // rather than saying no, and the two read differently on a screen.
    throw new ApiError(0, UNANSWERED, false);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const refused = await refusal(response, request.signal);
    if (unauthenticated(refused)) for (const listener of unauthenticatedListeners) listener();
    throw refused;
  }
  return response;
}

/**
 * Turn a refused response into the error a screen can render.
 *
 * Read as text first and parsed after, rather than `response.json()` in a
 * `try`: the body is read exactly once either way, and this way the text is
 * still in hand when the parse fails, which is the case that needs it.
 *
 * A body the caller's `signal` cut off is unanswered, except a 401's, which the
 * shell must still hear; one lost any other way keeps the status, which was a
 * real answer.
 */
async function refusal(response: Response, signal: RequestInit["signal"]): Promise<ApiError> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    if (signal?.aborted && response.status !== 401) return new ApiError(0, UNANSWERED, false);
  }

  try {
    const body = JSON.parse(text) as Partial<ApiErrorBody>;
    if (typeof body?.error === "string" && body.error !== "") {
      const clockSkew = body.clock_skew as ClockSkew | undefined;
      return new ApiError(response.status, body.error, true, clockSkew);
    }
  } catch {
    // Not JSON, which is a documented possibility rather than a surprise. See
    // the module doc.
  }

  // A bare 502 or 504 is a proxy's — vite's, in development — for an appliance
  // that gave no answer; the appliance's own 502 carried a body and returned
  // above.
  if (response.status === 502 || response.status === 504) {
    return new ApiError(0, UNANSWERED, false);
  }

  return new ApiError(
    response.status,
    text.trim() || `the request was refused, with nothing said about why (${response.status})`,
    false,
  );
}

/**
 * Fetch a file the appliance serves and save it under the name it chose.
 *
 * The same request [`api`] makes, with the bytes saved rather than parsed. The
 * refusal path is the same one too, so a screen renders the appliance's own
 * sentence rather than a generic one — doing it by hand instead is wrong twice,
 * and has been: `refusalMessage` renders only an `ApiError`'s message, so a
 * daemon's sentence gets replaced by the fallback in exactly the form whose
 * wording somebody wrote a test to guarantee.
 *
 * `fallbackName` is used when the response carries no `Content-Disposition` this
 * can read. The header the appliance writes is built from values it filtered
 * itself, so there is no quoting to unpick here and nothing has to be right
 * about a specification.
 *
 * `init` takes the same shape [`api`] does, because a file is not always a
 * `GET`: taking a backup is a `POST` carrying the passphrase, and the answer is
 * still bytes to save.
 */
export async function download(
  path: string,
  fallbackName: string,
  init: ApiInit = {},
): Promise<void> {
  const response = await send(path, init);
  save(
    await unansweredIfCutOff(response.blob()),
    filename(response.headers.get("content-disposition")) ?? fallbackName,
  );
}

/** Save text the browser already holds under `name` — a log export, say. */
export function saveText(name: string, text: string): void {
  save(new Blob([text], { type: "text/plain" }), name);
}

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  } finally {
    // Revoked a minute later, not synchronously: a click starts the download
    // asynchronously, and Firefox cancels it if the URL is revoked before it has
    // begun — which the next task turn does not guarantee either. In a
    // `finally` so a click that throws does not leak the object URL for the
    // life of the document.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** The filename out of a `Content-Disposition`, when it carries a plain one. */
function filename(disposition: string | null): string | undefined {
  return disposition?.match(/filename="([^"]+)"/)?.[1];
}
