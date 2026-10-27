/**
 * The gate: which of starting, a factory reset's report, unreachable, the first
 * account, sign-in and the product to show, and the session every one of them
 * reads.
 *
 * Neither sign-in nor the product renders until the session is known — a
 * sign-in form flashed at somebody already signed in is worse than a blank
 * moment. After that the screen stays put through an outage, with a bar
 * across the top: a five-second restart must not cost a half-filled form, and
 * a screen whose success takes the connection away — an address change — must
 * keep saying where to go. Nothing inside the product can blank the page: a
 * thrown render is a bug, and the right response is to say so and offer a
 * retry, not a white screen with a stack trace in the console.
 */
import type { BrandingView, Caller, Onboarding, ResetReport } from "@wired-square/appliance-types";
import { Button, Notice, Refusal, Section, applyTheme, createAction, refusalMessage } from "@wired-square/kit";
import {
  ErrorBoundary,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import type { JSX } from "solid-js";

import { ApiError, api, fromBase, onUnauthenticated, unauthenticated } from "../api";
import { ResetDone } from "./ResetDone";
import { startProbe } from "./probe";
import { PartingContext, SessionContext, useSession } from "./session";
import type { Me, Session } from "./session";

/**
 * Every slot but `controls` and `help` is for a host that signs its own
 * accounts in. Behind a console none of those is given: the console signs
 * somebody in before a request arrives.
 */
export interface ShellProps {
  /**
   * Beside the box's name on the signed-out screens, as `Chrome`'s `controls`
   * are: a `SchemePicker`, say.
   */
  controls?: JSX.Element;

  /** Beneath the signed-out card — the product's locked-out hint. */
  help?: JSX.Element;

  /**
   * The sign-in card in place of the signed-out one — `<SignIn />` for a
   * product that serves its own HTTPS; it calls `useSession().refresh()` once
   * signed in.
   */
  signIn?: JSX.Element;

  /**
   * What a box with no accounts shows, calling `useSession().refresh()` once
   * the first is made. Given this or `unclaimed`, the shell asks the host's
   * `GET /api/onboarding`; a host that answers it 404, as one behind a console
   * does, offers no first account, so one bundle serves both.
   */
  firstAccount?: JSX.Element;

  /** What a box with no accounts shows when there is no `firstAccount`. */
  unclaimed?: JSX.Element;

  /**
   * The product, rendered once somebody is signed in — `useSession().me()`
   * is never `null` inside it. Mount `Shell` at the root, above any
   * `Suspense`: a boundary over it would swap the whole page for its fallback
   * on every re-ask of the session.
   */
  children: JSX.Element;
}

/**
 * How often the shell probes the daemon, and how long any of its asks may
 * take: a box whose plug was pulled answers nothing at all, and a request
 * left to the browser's own patience would hold the next probe off for a
 * quarter of an hour.
 */
const POLL_MS = 5_000;

const withinPoll = () => ({ signal: AbortSignal.timeout(POLL_MS) });

/**
 * Who is signed in and whether the box has an account, as one answer, so the
 * gate never shows a screen that is right for half of it.
 */
interface Answer {
  user: Me | null;
  needed: boolean;
}

/** What asking came to: an answer, or the daemon not there. */
type Asked = Answer | { failed: unknown };

export function Shell(props: ShellProps) {
  // Public, because the sign-in card is rendered before there is a session.
  // The first answer is the page's: its build is taken as the one this page's
  // JavaScript was served with, and its tokens are applied, as are those of
  // each answer adopted after it. Branding is
  // decoration, so a daemon that will not say is `undefined` here rather than
  // a thrown resource. Not `api`: the probe needs its ETag.
  let brandingTag: string | undefined;
  const [branding, { mutate: setBranding }] = createResource<BrandingView | undefined>(async () => {
    try {
      const response = await fetch(fromBase("/api/branding"), {
        credentials: "same-origin",
        ...withinPoll(),
      });
      if (!response.ok) return undefined;
      const got = (await response.json()) as BrandingView;
      brandingTag = response.headers.get("etag") ?? undefined;
      applyTheme(got.tokens, got.tokens_dark);
      return got;
    } catch {
      return undefined;
    }
  });

  const onboards = "firstAccount" in props || "unclaimed" in props;
  // `GET /api/session` is `Viewer`, so a 401 is the ordinary signed-out state
  // rather than a failure. Anything else is the daemon not there, and is an
  // answer rather than a thrown resource, so no read of it can throw.
  const [asked, { refetch }] = createResource<Asked>(async () => {
    try {
      const [user, onboarding] = await Promise.all([
        api<Caller>("/api/session", withinPoll()).then(
          (caller) => {
            if ("local" in caller) {
              throw new Refusal(
                "this page reached the appliance over a control endpoint, which signs nobody in",
              );
            }
            return caller;
          },
          (error: unknown) => {
            if (unauthenticated(error)) return null;
            throw error;
          },
        ),
        onboards
          ? api<Onboarding>("/api/onboarding", withinPoll()).catch(notOffered)
          : { needed: false },
      ]);
      return { user, needed: onboarding.needed };
    } catch (error) {
      return { failed: error };
    }
  });

  // The last answer that said, kept through an outage.
  const known = createMemo<Answer | undefined>((last) => {
    const answer = asked();
    return answer && "user" in answer ? answer : last;
  });
  const failed = () => {
    const answer = asked();
    return answer && "failed" in answer ? answer.failed : undefined;
  };
  // A local answer: asking again cannot change it. An `ApiError` is a `Refusal` too, and can.
  const refused = () => {
    const why = failed();
    return why instanceof Refusal && !(why instanceof ApiError);
  };
  // Nor a 403 from `/api/session`: the caller was named, and this app gives it no role.
  const roleless = () => {
    const why = failed();
    return why instanceof ApiError && why.status === 403;
  };
  const final = () => refused() || roleless();

  // Not while one is in flight: the later ask would supersede the earlier and
  // drop its answer — a sign-out's, say — on the floor, and an ask's own 401
  // reaches the listener below, which would otherwise ask again for ever.
  const reask = () => {
    if (!asked.loading) void refetch();
  };

  const session: Session = {
    branding,
    me: () => known()?.user ?? null,
    local: () => undefined,
    refresh: () => void refetch(),
  };

  const [parting, setParting] = createSignal<{ report: ResetReport; onRead?: () => void }>();
  // Kept until the session answers that nobody is signed in: until then
  // `known()` is still the account the reset removed, and the product would remount.
  const reading = createAction();
  const read = () =>
    reading.run(async () => {
      const left = parting();
      if (left?.onRead) {
        setParting({ report: left.report });
        left.onRead();
      }
      await refetch();
      if (!known()?.user) setParting(undefined);
    });

  // A session that expired, or was revoked by another administrator, is heard
  // from the first `api` request it refuses.
  onCleanup(onUnauthenticated(reask));

  onCleanup(
    startProbe(
      {
        busy: () => asked.loading || branding.loading,
        page: branding,
        tag: () => brandingTag,
        rendered: () => known() !== undefined,
        adopt: (got) => {
          applyTheme(got.tokens, got.tokens_dark);
          setBranding(got);
        },
        reload: () => location.reload(),
        failed: () => Boolean(failed()) && !final(),
        reask,
      },
      POLL_MS,
      fromBase("/api/branding"),
    ),
  );

  // Only the first answers are waited for; a refetch keeps its branch until it
  // lands, so a sign-out does not pass through "Starting…".
  const starting = () =>
    [asked, branding].some((r) => r.state === "unresolved" || r.state === "pending");

  const retry = () => (
    <Button tone="plain" pending={asked.loading} onClick={reask}>
      Retry now
    </Button>
  );

  return (
    <SessionContext.Provider value={session}>
      <Show when={known() && !final() && failed()}>
        {(why) => (
          <Notice tone="bad" class="app-away">
            {refusalMessage(why())} — retrying every few seconds.
            {retry()}
          </Notice>
        )}
      </Show>
      <Switch>
        <Match when={starting()}>
          <main class="app-centred app-muted">Starting…</main>
        </Match>
        {/* Ahead of the product, which `known()` still picks until the session answers. */}
        <Match when={parting()}>
          {(left) => (
            <Welcome controls={props.controls}>
              <ResetDone
                report={left().report}
                pending={reading.pending()}
                onContinue={() => void read()}
              />
            </Welcome>
          )}
        </Match>
        <Match when={refused()}>
          <Trouble
            why={refusalMessage(failed())}
            note="A client reaching it that way provides its own session."
            action={null}
          />
        </Match>
        <Match when={roleless()}>
          <Trouble
            why={refusalMessage(failed())}
            note="This app gives you no role. Reload this page once its administrator gives you one."
            action={null}
          />
        </Match>
        <Match when={!known()}>
          <Trouble why={refusalMessage(failed())} note="Retrying every few seconds." action={retry()} />
        </Match>
        <Match when={known()?.needed}>
          <Welcome controls={props.controls}>{productsOr(props.firstAccount, () => props.unclaimed)}</Welcome>
        </Match>
        <Match when={!known()?.user}>
          <Welcome controls={props.controls}>{productsOr(props.signIn, () => <SignedOut help={props.help} />)}</Welcome>
        </Match>
        <Match when={known()?.user}>
          <ErrorBoundary
            fallback={(error, reset) => (
              <Trouble
                why="The interface hit an error."
                note={error instanceof Refusal ? error.message : String(error)}
                action={<Button onClick={reset}>Try again</Button>}
              />
            )}
          >
            <PartingContext.Provider value={(report, onRead) => setParting({ report, onRead })}>
              {props.children}
            </PartingContext.Provider>
          </ErrorBoundary>
        </Match>
      </Switch>
    </SessionContext.Provider>
  );
}

function notOffered(error: unknown): Onboarding {
  if (error instanceof ApiError && error.status === 404) return { needed: false };
  throw error;
}

/** The product's slot, read once — each read of its getter builds another copy — or else this package's default. */
function productsOr(slot: JSX.Element | undefined, fallback: () => JSX.Element) {
  return slot === undefined ? fallback() : slot;
}

/** Nobody signed in, where the front door is what signs somebody in. */
function SignedOut(props: { help?: JSX.Element }) {
  return (
    <Section title="Signed out">
      <p class="app-muted">Sign in to whatever this app is served through, then reload this page.</p>
      {props.help}
    </Section>
  );
}

/** A whole-page stop: what went wrong, and the one thing to do about it. */
function Trouble(props: { why: string; note: string; action: JSX.Element }) {
  return (
    <main class="app-centred">
      <div class="app-trouble">
        <p class="app-trouble__why" role="alert">
          {props.why}
        </p>
        <p class="app-muted">{props.note}</p>
        {props.action}
      </div>
    </main>
  );
}

/** The appliance's name over a card, for the screens shown signed out. */
function Welcome(props: { controls?: JSX.Element; children: JSX.Element }) {
  return (
    <main class="app-centred">
      <div class="app-welcome">
        <Brand class="app-welcome__brand">
          <div class="app-welcome__controls">
            <Hostname />
            {props.controls}
          </div>
        </Brand>
        {props.children}
      </div>
    </main>
  );
}

/** The logo, name and maker; all but the name hidden where the daemon sends none. */
export function Brand(props: { class: string; children?: JSX.Element }) {
  const { branding } = useSession();
  return (
    <div class={props.class}>
      <img src={fromBase("/api/branding/logo")} alt="" onError={(e) => (e.currentTarget.hidden = true)} />
      <div>
        <h1>{branding()?.app_name}</h1>
        <Show when={branding()?.manufacturer}>{(who) => <p class="app-muted">{who()}</p>}</Show>
      </div>
      {props.children}
    </div>
  );
}

/** The box's hostname as a pill, where the daemon sends one. */
export function Hostname() {
  const { branding } = useSession();
  return (
    <Show when={branding()?.hostname}>
      {(name) => (
        <span class="app-hostname">
          <span class="app-visually-hidden">This box: </span>
          {name()}
        </span>
      )}
    </Show>
  );
}
