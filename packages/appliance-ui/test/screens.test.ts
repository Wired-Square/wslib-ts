import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { TestContext } from "node:test";
import { STALE_PROOF } from "@wired-square/appliance-types";
import type { BrandingView, ListedUser, LocalIdentity, LogSnapshot } from "@wired-square/appliance-types";
import type { JSX } from "solid-js";

import type { FeedTransport } from "../src/follow.ts";
import type { ChromeProps } from "../src/shell/Chrome.tsx";
import type { ShellProps } from "../src/shell/Shell.tsx";
import type { Parting } from "../src/shell/session.ts";
import {
  BOUNDARY,
  admin,
  chooseFromMenu,
  click,
  consoleOperator,
  find,
  load,
  localAdmin,
  mount,
  setTick,
  settled,
  textOf,
  within,
} from "./mount.ts";
import type { Answer, Asked } from "./mount.ts";
import type { Element } from "./universal.ts";

const RESTARTING = "the daemon is restarting";
const restarting: Answer = () => Response.json({ error: RESTARTING }, { status: 503 });

test("A screen whose read is refused says so in place, with a retry, and leaves the shell standing", async () => {
  const { About } = await load<typeof import("../src/screens/About.tsx")>("/src/screens/About.tsx");
  const { BackupSettings } = await load<typeof import("../src/screens/BackupSettings.tsx")>(
    "/src/screens/BackupSettings.tsx",
  );
  for (const [name, screen] of [
    ["About", () => About()],
    ["BackupSettings", () => BackupSettings({ view: "schedule" })],
  ] as const) {
    const shown = textOf((await mount(screen, restarting)).root);
    assert.doesNotMatch(shown, new RegExp(BOUNDARY), name);
    assert.match(shown, new RegExp(`${RESTARTING}.*Try again`), name);
  }
});

/** `Shell` with `props` around `product`, with each request answered by `answer` or else a 404. */
async function shell(product: () => JSX.Element, answer: Answer, props: Partial<ShellProps> = {}) {
  const { createComponent, mergeProps } = await load<typeof import("solid-js")>("solid-js");
  const { Shell } = await load<typeof import("../src/shell/Shell.tsx")>("/src/shell/Shell.tsx");
  // No adopted stylesheets, as in a browser too old for them: the branding must still arrive.
  globalThis.document = {
    hidden: true,
    addEventListener() {},
    removeEventListener() {},
    documentElement: { style: { setProperty() {} } },
  } as unknown as Document;
  return mount(
    () =>
      createComponent(
        Shell,
        mergeProps(props, {
          get children(): JSX.Element {
            return product();
          },
        }),
      ),
    answer,
  );
}

/** What the shell's own boundary shows when its product throws `thrown`. */
async function shellCaught(thrown: () => unknown): Promise<string> {
  const { root } = await shell(
    () => {
      throw thrown();
    },
    (path) =>
      path === "/api/session"
        ? Response.json(admin)
        : path === "/api/onboarding"
          ? Response.json({ needed: false })
          : undefined,
  );
  const shown = textOf(root);
  assert.match(shown, /The interface hit an error\./);
  return shown;
}

test("The signed-out screens name the box in a pill under the product's name", async () => {
  const { root, asked } = await shell(
    () => "the product",
    (path) =>
      path === "/api/branding"
        ? Response.json({ build: "b1", app_name: "Widget Monitor", manufacturer: "", tokens: {}, tokens_dark: {}, hostname: "widget-1234" })
        : path === "/api/session"
          ? Response.json({ error: "sign in" }, { status: 401 })
          : path === "/api/onboarding"
            ? Response.json({ needed: false })
            : undefined,
    { controls: "the controls" },
  );
  const brand = find(root, (n) => n.props.class === "app-welcome__brand");
  const row = find(brand, (n) => n.props.class === "app-welcome__controls");
  const pill = find(row, (n) => n.props.class === "app-hostname");
  assert.equal(textOf(pill), "This box: widget-1234");
  assert.equal(textOf(row), "This box: widget-1234the controls");
  assert.match(textOf(root), /Sign in/);
  assert.doesNotMatch(textOf(root), /the product/);
  assert.ok(!asked.some((a) => a.path === "/api/onboarding"), "no slot needs the onboarding route");
});

test("With no slots, the console's account reaches the product, named in the masthead without account controls", async () => {
  const { createComponent } = await load<typeof import("solid-js")>("solid-js");
  const { Chrome } = await load<typeof import("../src/shell/Chrome.tsx")>("/src/shell/Chrome.tsx");
  const { root, asked } = await shell(
    () => createComponent(Chrome, { children: "the product" }),
    (path) => (path === "/api/session" ? Response.json(consoleOperator) : undefined),
  );
  const shown = textOf(root);
  assert.match(shown, /ops.*Operator.*the product/);
  assert.doesNotMatch(shown, /Sign out|Change password/);
  assert.deepEqual(
    asked.map((a) => a.path).filter((path) => path !== "/api/branding"),
    ["/api/session"],
  );
});

test("A report handed to useParting replaces the product inside a Shell until Continue finds nobody signed in, and outside one there is nobody to hand it to", async () => {
  const { useParting } = await load<typeof import("../src/shell/session.ts")>("/src/shell/session.ts");
  const heard: (Parting | undefined)[] = [];
  const product = () => {
    heard.push(useParting());
    return "the product";
  };

  await mount(product, () => undefined);
  assert.equal(heard[0], undefined);

  let signedIn = true;
  const { root } = await shell(
    product,
    (path) =>
      path === "/api/session"
        ? signedIn
          ? Response.json(admin)
          : Response.json({ error: "sign in" }, { status: 401 })
        : path === "/api/onboarding"
          ? Response.json({ needed: false })
          : undefined,
    { controls: "the controls" },
  );
  const parting = heard.at(-1);
  assert.ok(parting);
  let read = 0;
  parting({ erased: ["every account"], kept: [], warnings: ["the tailnet was left"] }, () => read++);
  await settled();
  const shown = textOf(root);
  assert.match(shown, /the controls.*This appliance was reset.*Erased: every account\..*the tailnet was left.*Continue/);
  assert.doesNotMatch(shown, /the product/);

  await click(root, "Continue");
  assert.equal(read, 1);
  assert.match(textOf(root), /This appliance was reset/, "the session still names the account the reset removed");

  signedIn = false;
  await click(root, "Continue");
  assert.equal(read, 1);
  assert.doesNotMatch(textOf(root), /This appliance was reset|the product/);
  assert.match(textOf(root), /Sign in/);
});

/**
 * What `Shell` with `props` shows nobody signed in, on a box with no account if
 * `needed`. One per test: two shells on a page answer each other's 401s.
 */
async function signedOut(needed: boolean, props: Partial<ShellProps>): Promise<string> {
  const answer: Answer = (path) =>
    path === "/api/session"
      ? Response.json({ error: "sign in" }, { status: 401 })
      : path === "/api/onboarding"
        ? Response.json({ needed })
        : undefined;
  return textOf((await shell(() => "the product", answer, props)).root);
}

test("The shell's signed-out card points at whatever serves the app, naming no console, with the product's help beneath", async () => {
  const shown = await signedOut(false, { help: "the help" });
  assert.match(shown, /Signed out.*Sign in to whatever this app is served through.*the help/);
  assert.doesNotMatch(shown, /console/);
});

/** How often `Shell` asks for the session over three probes of a daemon that is up, while `/api/session` answers `session`. */
async function sessionAsksWhile(session: Answer) {
  const branding = { build: "b1", app_name: "Widget Monitor", manufacturer: "", tokens: {}, tokens_dark: {}, hostname: "widget-1234" };
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    const mounted = await shell(() => "the product", (path, init) =>
      path === "/api/branding" ? Response.json(branding) : session(path, init),
    );
    (globalThis.document as { hidden: boolean }).hidden = false;
    for (let probe = 0; probe < 3; probe++) {
      mock.timers.tick(5_000);
      await settled();
    }
    return { shown: textOf(mounted.root), asks: mounted.asked.filter((a) => a.path === "/api/session").length };
  } finally {
    mock.timers.reset();
  }
}

test("A session refused 403 is final: the server's sentence and when to reload, and never asked again", async () => {
  const sentence = "admin has no role on this appliance";
  const roleless = await sessionAsksWhile((path) =>
    path === "/api/session" ? Response.json({ error: sentence }, { status: 403 }) : undefined,
  );
  assert.match(
    roleless.shown,
    new RegExp(`${sentence}.*This app gives you no role\\. Reload this page once its administrator gives you one\\.`),
  );
  assert.doesNotMatch(roleless.shown, /front door/);
  assert.doesNotMatch(roleless.shown, /Retry/);
  assert.equal(roleless.asks, 1);

  const away = await sessionAsksWhile((path) => (path === "/api/session" ? restarting(path, {}) : undefined));
  assert.match(away.shown, /Retrying every few seconds/);
  assert.ok(away.asks > 1, "an outage is asked again");
});

test("A session nothing answered, or refused 500, is not final: an ApiError is a Refusal, but not a local one", async () => {
  const unanswered = (): Response => {
    throw new TypeError("the network went away");
  };
  for (const [name, session] of [
    ["unanswered", unanswered],
    ["500", () => Response.json({ error: "the store is locked" }, { status: 500 })],
  ] as const) {
    const answered = await sessionAsksWhile((path) => (path === "/api/session" ? session() : undefined));
    assert.match(answered.shown, /Retrying every few seconds/, name);
    assert.ok(answered.asks > 1, `${name} is asked again`);
  }
});

test("A product's sign-in replaces the standard one, help and all", async () => {
  const shown = await signedOut(false, { help: "the help", signIn: "the product's sign-in" });
  assert.match(shown, /the product's sign-in/);
  assert.doesNotMatch(shown, /Sign in|the help/);
});

for (const [slot, needed] of [["signIn", false], ["firstAccount", true]] as const) {
  test(`A product's controls show beside the box's name over its ${slot}`, async () => {
    const shown = await signedOut(needed, { controls: "the controls", [slot]: "the product's screen" });
    assert.match(shown, /the controls.*the product's screen/);
  });
}

test("Without a first-account slot the shell never asks whether the box has an account", async () => {
  assert.match(await signedOut(true, {}), /Signed out/);
});

test("A host that does not serve onboarding offers no first account, and the shell stands", async () => {
  const answer: Answer = (path) =>
    path === "/api/session" ? Response.json({ error: "sign in" }, { status: 401 }) : undefined;
  const shown = textOf(
    (await shell(() => "the product", answer, { firstAccount: "the first account", signIn: "the sign-in" })).root,
  );
  assert.match(shown, /the sign-in/);
  assert.doesNotMatch(shown, /the first account|Retrying/);
});

test("The kit's sign-in posts the credentials to the session and asks again who is signed in", async () => {
  const { createComponent } = await load<typeof import("solid-js")>("solid-js");
  const { SignIn } = await load<typeof import("../src/shell/SignIn.tsx")>("/src/shell/SignIn.tsx");
  let signedIn = false;
  const { root, asked } = await shell(
    () => "the product",
    (path, init) => {
      if (path === "/api/session" && init?.method === "POST") {
        signedIn = true;
        return Response.json(admin);
      }
      return path === "/api/session"
        ? signedIn
          ? Response.json(admin)
          : Response.json({ error: "sign in" }, { status: 401 })
        : undefined;
    },
    {
      get signIn() {
        return createComponent(SignIn, { help: "the help" });
      },
    },
  );
  assert.match(textOf(root), /Sign in.*Username.*Password.*the help/);
  const form = find(root, (n) => n.tag === "form");
  (form.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
  await settled();
  assert.ok(asked.some((a) => a.path === "/api/session" && a.method === "POST"), JSON.stringify(asked));
  assert.match(textOf(root), /the product/);
});

test("A box with no accounts shows a product's unclaimed when it has no first account", async () => {
  const shown = await signedOut(true, { unclaimed: "the product's restore" });
  assert.match(shown, /the product's restore/);
  assert.doesNotMatch(shown, /Signed out/);
});

test("A product's first account is shown in place of its unclaimed", async () => {
  const shown = await signedOut(true, { firstAccount: "the product's first account", unclaimed: "the product's restore" });
  assert.match(shown, /the product's first account/);
  assert.doesNotMatch(shown, /restore|Sign/);
});

for (const [slot, needed] of [["signIn", false], ["firstAccount", true], ["unclaimed", true]] as const) {
  test(`A product's ${slot} is built once per showing`, async () => {
    let built = 0;
    const shown = await signedOut(needed, {
      get [slot]() {
        built += 1;
        return `the product's ${slot}`;
      },
    });
    assert.match(shown, new RegExp(`the product's ${slot}`));
    assert.equal(built, 1);
  });
}

/** `Chrome` with `props`, for an account its host signs in itself. */
async function chrome(props: Partial<ChromeProps> = {}) {
  const { createComponent } = await load<typeof import("solid-js")>("solid-js");
  const { Chrome } = await load<typeof import("../src/shell/Chrome.tsx")>("/src/shell/Chrome.tsx");
  const { root } = await mount(
    () => createComponent(Chrome, { ...props, children: "the product" }),
    () => undefined,
  );
  return root;
}

test("Chrome offers a host's account its sign-out, and change-password only with the product's form, which can close it", async () => {
  const bare = textOf(await chrome());
  assert.match(bare, /Sign out/);
  assert.doesNotMatch(bare, /Change password/);

  const { Button } = await load<typeof import("@wired-square/kit")>("@wired-square/kit");
  const product = await chrome({
    changePassword: (close) => Button({ onClick: close, children: "the product's password form" }),
  });
  await click(product, "Change password…");
  assert.match(textOf(product), /the product's password form/);
  await click(product, "the product's password form");
  assert.doesNotMatch(textOf(product), /the product's password form/);
});

test("Chrome's wide change-password is a glyph named by its words, which are also its tooltip", async () => {
  const root = await chrome({ changePassword: () => "the product's password form" });
  const glyph = find(root, (n) => n.tag === "button" && n.props["aria-label"] === "Change password…");
  assert.equal(glyph.props.title, "Change password…");
  assert.equal(glyph.props["aria-haspopup"], "dialog");
  assert.match(String(glyph.props.class), /\bapp-btn--plain\b/);
  assert.match(String(glyph.props.class), /\bapp-btn--icon\b/);
  assert.equal(textOf(glyph), "");
  assert.deepEqual(glyph.children.map((n) => n.tag), ["svg"]);
});

test("Chrome scrolls a strip to its selected tab on mount and again whenever the selection moves", async () => {
  const { Element } = await load<typeof import("./universal.ts")>("/test/universal.ts");
  const { createComponent } = await load<typeof import("solid-js")>("solid-js");
  const { Chrome } = await load<typeof import("../src/shell/Chrome.tsx")>("/src/shell/Chrome.tsx");
  const strip ={ scrollLeft: 0, getBoundingClientRect: () => ({ left: 0, right: 300 }) };
  let at = { left: 340, right: 400 };
  const tab = { closest: () => strip, getBoundingClientRect: () => at };
  let moved = () => {};
  let watched: MutationObserverInit | undefined;
  let asked: string | undefined;
  const observer = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    constructor(callback: () => void) {
      moved = callback;
    }
    observe(_: unknown, init: MutationObserverInit) {
      watched = init;
    }
    disconnect() {}
  } as unknown as typeof MutationObserver;
  const querySelector = Element.prototype.querySelector;
  Element.prototype.querySelector = (selector: string) => {
    asked = selector;
    return tab;
  };
  try {
    await mount(() => createComponent(Chrome, { children: "the product" }), () => undefined);
    assert.equal(asked, '.app-tablist :is([aria-selected="true"], [aria-current="page"])');
    assert.equal(strip.scrollLeft, 100);
    assert.deepEqual(watched?.attributeFilter, ["aria-selected", "aria-current"]);

    at = { left: -50, right: 10 };
    moved();
    assert.equal(strip.scrollLeft, 50);
  } finally {
    Element.prototype.querySelector = querySelector;
    globalThis.MutationObserver = observer;
  }
});

const SWITCHER = "https://box.local/api/switcher";
const apps = [
  { name: "Console", href: "/" },
  { name: "Hello", href: "/apps/hello/" },
  { name: "Hello there", href: "/apps/hello-there/" },
];

/** `Chrome` at `pathname` behind the console's proxy, branded Hello by Acme, with `/api/switcher` answered by `answer`. */
const unswitched = { document: globalThis.document, location: globalThis.location };

async function switching(t: TestContext, pathname: string, answer: () => Response) {
  const assigned: string[] = [];
  t.after(() => Object.assign(globalThis, unswitched));
  Object.assign(globalThis, {
    document: { baseURI: "https://box.local/apps/hello/" },
    location: { origin: "https://box.local", pathname, assign: (href: string) => assigned.push(href) },
  });
  const { createComponent } = await load<typeof import("solid-js")>("solid-js");
  const { Chrome } = await load<typeof import("../src/shell/Chrome.tsx")>("/src/shell/Chrome.tsx");
  const { SessionProvider } = await load<typeof import("../src/shell/session.ts")>("/src/shell/session.ts");
  const branding = { app_name: "Hello", manufacturer: "Acme" } as BrandingView;
  const { root, asked } = await mount(
    () =>
      createComponent(SessionProvider, {
        value: { branding: () => branding, me: () => admin, local: () => undefined, refresh: () => {} },
        get children() {
          return createComponent(Chrome, { children: "the product" });
        },
      }),
    (path) => (path === SWITCHER ? answer() : undefined),
  );
  return { root, asked, assigned };
}

const switchAsks = (asked: Asked) => asked.filter((a) => a.path === SWITCHER).length;

const brandOf = (root: Element) => find(root, (n) => String(n.props.class).startsWith("app-masthead__brand"));

const isSwitcher = (n: Element) => n.props["aria-label"] === "Hello, Acme, switch app";

/** The switcher's items as rendered when its menu opens, and once they have settled, opened and shut as the platform's popover would. */
async function openSwitcher(root: Element) {
  const panel = find(root, (n) => n.props.role === "menu" && isSwitcher(n));
  const toggle = panel.props.onToggle as (e: { newState: string }) => void;
  Object.assign(panel, { style: {} });
  Object.assign(find(root, (n) => n.tag === "button" && isSwitcher(n)), {
    getBoundingClientRect: () => ({ top: 0, bottom: 0, right: 0 }),
  });
  const items = () => [...within(panel)].filter((n) => n.props.role === "menuitem");
  const window = globalThis.window;
  globalThis.window = { innerHeight: 800, addEventListener() {}, removeEventListener() {} } as unknown as typeof globalThis.window;
  try {
    toggle({ newState: "open" });
    const opened = items();
    await settled();
    return { opened, settled: items() };
  } finally {
    toggle({ newState: "closed" });
    await settled();
    globalThis.window = window;
  }
}

const described = (item: Element) =>
  `${find(item, (n) => n.tag === "img").props.src} ${textOf(item)}${item.props["aria-current"] === "page" ? " (current)" : ""}`;

/** The switcher's items, after choosing the `choosing`th. */
async function switcherItems(root: Element, choosing?: number) {
  const { settled: items } = await openSwitcher(root);
  if (choosing !== undefined) (items[choosing]?.props.onClick as () => void)();
  return items.map(described);
}

test("Chrome asks for the switcher at the origin root, not the app's base, on mount and on each open", async (t) => {
  const { root, asked } = await switching(t, "/apps/hello/x", () => Response.json(apps));
  assert.deepEqual(
    asked.filter((a) => a.path.endsWith("/api/switcher")),
    [{ path: SWITCHER, method: "GET", body: undefined }],
  );
  await openSwitcher(root);
  await openSwitcher(root);
  assert.equal(switchAsks(asked), 3);
});

test("Given links, the brand is the switcher's button, named for its words", async (t) => {
  const { root } = await switching(t, "/apps/hello/x", () => Response.json(apps.slice(0, 1)));
  const brand = brandOf(root);
  assert.equal(brand.props.class, "app-masthead__brand app-switcher");
  const trigger = find(brand, (n) => n.tag === "button" && isSwitcher(n));
  assert.equal(trigger.props["aria-haspopup"], "menu");
  assert.equal(textOf(trigger), "HelloAcme");
  assert.equal(find(trigger, (n) => n.tag === "img").props.src, "https://box.local/apps/hello/api/branding/logo");
  assert.equal([...within(brand)].find((n) => n.tag === "h1"), undefined);
});

test("The switcher's and the account's triggers carry the kit's chevron, kept out of their names", async (t) => {
  const { root } = await switching(t, "/apps/hello/x", () => Response.json(apps));
  const triggers = [...within(root)].filter((n) => n.tag === "button" && n.props["aria-haspopup"] === "menu");
  assert.deepEqual(
    triggers.map((n) => [n.props["aria-label"], find(n, (c) => c.props.class === "app-menu__chevron").props["aria-hidden"]]),
    [
      ["Hello, Acme, switch app", "true"],
      ["admin, Admin, account", "true"],
    ],
  );
});

test("Chrome's switcher lists every app it is answered with its icon, the console first, and marks the longest href the path is under", async (t) => {
  const atConsole = await switching(t, "/", () => Response.json(apps));
  assert.deepEqual(await switcherItems(atConsole.root), [
    "/api/branding/logo Console (current)",
    "/apps/hello/api/branding/logo Hello",
    "/apps/hello-there/api/branding/logo Hello there",
  ]);

  const inApp = await switching(t, "/apps/hello/x", () => Response.json(apps));
  assert.deepEqual((await switcherItems(inApp.root)).map((item) => item.split(" ").slice(1).join(" ")), [
    "Console",
    "Hello (current)",
    "Hello there",
  ]);
});

test("At an app's root without its trailing slash, the switcher marks that app, and choosing the console loads it", async (t) => {
  const { root, assigned } = await switching(t, "/apps/hello", () => Response.json(apps));
  assert.deepEqual((await switcherItems(root, 0)).map((item) => item.split(" ").slice(1).join(" ")), [
    "Console",
    "Hello (current)",
    "Hello there",
  ]);
  assert.deepEqual(assigned, ["/"]);
});

test("Reopening the switcher lists an app installed since, keeping the items that were already there", async (t) => {
  let answered = apps.slice(0, 2);
  const { root } = await switching(t, "/", () => Response.json(answered));
  answered = apps;
  const { opened, settled: after } = await openSwitcher(root);
  assert.deepEqual(opened.map(textOf), ["Console", "Hello"]);
  assert.deepEqual(after.map(textOf), ["Console", "Hello", "Hello there"]);
  assert.equal(after[0], opened[0]);
  assert.equal(after[1], opened[1]);
});

test("Choosing an app from the switcher loads its href, and choosing the current one does nothing", async (t) => {
  const { root, assigned } = await switching(t, "/apps/hello/x", () => Response.json(apps));
  for (const item of [2, 1, 0]) await switcherItems(root, item);
  assert.deepEqual(assigned, ["/apps/hello-there/", "/"]);
});

test("With no links the brand is the plain block, and nothing else changed, for a refusal, no answer, or a body that is not a list", async (t) => {
  const { onUnauthenticated } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  let signedOut = 0;
  const stop = onUnauthenticated(() => signedOut++);
  try {
    const masthead = textOf((await switching(t, "/", () => Response.json([]))).root);
    for (const [why, answer] of [
      ["none", () => Response.json([])],
      ["401", () => Response.json({ error: "sign in" }, { status: 401 })],
      ["no answer", () => Response.error()],
      ["not JSON", () => new Response("<html>")],
      ["not a list", () => Response.json({ name: "Console", href: "/" })],
    ] as const) {
      const { root } = await switching(t, "/", answer);
      const brand = brandOf(root);
      assert.equal(brand.props.class, "app-masthead__brand", why);
      assert.equal(textOf(find(brand, (n) => n.tag === "h1")), "Hello", why);
      assert.equal([...within(brand)].find((n) => n.tag === "button"), undefined, why);
      assert.equal(textOf(root), masthead, why);
      assert.doesNotMatch(textOf(root), new RegExp(BOUNDARY), why);
    }
    assert.match(masthead, /^HelloAcme.*admin.*Sign out.*the product/);
    assert.equal(signedOut, 0);
  } finally {
    stop();
  }
});

test("The shell's boundary words a refusal that reaches it as its own sentence", async () => {
  const { ApiError } = await load<typeof import("../src/api.ts")>("/src/api.ts");
  const { Refusal } = await load<typeof import("@wired-square/kit/core")>("@wired-square/kit/core");
  for (const refusal of [new ApiError(503, RESTARTING, true), new Refusal(RESTARTING)]) {
    const shown = await shellCaught(() => refusal);
    assert.match(shown, new RegExp(RESTARTING), refusal.name);
    assert.doesNotMatch(shown, /ApiError|Refusal/, refusal.name);
  }
});

test("The shell's boundary does not claim a programming error changed nothing", async () => {
  const shown = await shellCaught(() => new TypeError("tls is undefined"));
  assert.match(shown, /TypeError: tls is undefined/);
  assert.doesNotMatch(shown, /nothing was changed/);
});

/** `Logs`, with the motion preference its pulse reads. */
async function loadLogs() {
  globalThis.matchMedia = (() => ({ matches: true })) as unknown as typeof matchMedia;
  return (await load<typeof import("../src/screens/Logs.tsx")>("/src/screens/Logs.tsx")).Logs;
}

/**
 * `Logs` in `local`'s session, or else an appliance's, over a feed that opens on
 * `snapshot` or is refused.
 */
async function logs(snapshot: LogSnapshot, feed: "opens" | "refused", local?: LocalIdentity): Promise<string> {
  const Logs = await loadLogs();
  const transport: FeedTransport = (_url, on) => {
    setImmediate(() => (feed === "opens" ? on.onOpen() : on.onClose(403)));
    return () => {};
  };
  const answer: Answer = (path) => (path === "/api/logs" ? Response.json(snapshot) : undefined);
  return textOf((await mount(() => Logs({ transport }), answer, () => local)).root);
}

/** A ring holding only `seq` 5, so four lines are not shown. */
const missingFour = (logFile: string | null): LogSnapshot => ({
  started_at: "2026-10-03T00:00:00Z",
  records: [{ seq: 5, at: "2026-10-03T00:00:01Z", level: "info", target: "widgets", message: "polled", fields: [] }],
  log_file: logFile,
});

const empty: LogSnapshot = { started_at: "2026-10-03T00:00:00Z", records: [], log_file: null };

test("Logs points a local session at the service's log file, by its path", async () => {
  const shown = await logs(missingFour("/Library/Logs/widgets.log"), "opens", localAdmin);
  const file = String.raw`the service's log file, /Library/Logs/widgets\.log\.`;
  assert.match(shown, new RegExp(`What this service has said since it started\\. .*everything earlier went to ${file}`));
  assert.match(shown, new RegExp(`4 lines not shown — this is a window, not everything\\. The rest went to ${file}`));
  assert.doesNotMatch(shown, /journal|appliance|\bbox\b/);
});

test("Logs points a local session whose snapshot names no file at the service's own log", async () => {
  const shown = await logs(missingFour(null), "opens", localAdmin);
  assert.match(shown, /everything earlier went to the service's own log\./);
  assert.match(shown, /The rest went to the service's own log\./);
  assert.doesNotMatch(shown, /journal|log file/);
});

test("Logs points an appliance session, whose snapshot names no file, at the system journal", async () => {
  const shown = await logs(missingFour(null), "opens");
  assert.match(shown, /everything else on the box, is in the system journal\./);
  assert.match(shown, /4 lines not shown — this is a window, not everything\. The system journal has the rest\./);
  assert.doesNotMatch(shown, /log file|service/);
});

test("Logs words an empty ring and a refused feed for a local session and for an appliance", async () => {
  const local = await logs(empty, "refused", localAdmin);
  assert.match(local, /Nothing logged yet\. A healthy service is quiet/);
  assert.match(local, /this connection may not read it; only the service's administrators may\./);
  assert.doesNotMatch(local, /appliance|Sign in/);

  const appliance = await logs(empty, "refused");
  assert.match(appliance, /Nothing logged yet\. A healthy appliance is quiet/);
  assert.match(appliance, /this session may no longer read it\. Sign in again as an administrator\./);
});

test("Logs claims no own log for a local session whose snapshot was never fetched", async () => {
  const shown = await logs(missingFour("/Library/Logs/widgets.log"), "refused", localAdmin);
  assert.match(shown, /everything earlier went to the service's log\./);
  assert.doesNotMatch(shown, /own log|log file/);
});

test("Logs and the audit log take the title a product's navigation gives them", async () => {
  const Logs = await loadLogs();
  const { AuditLog } = await load<typeof import("../src/screens/AuditLog.tsx")>("/src/screens/AuditLog.tsx");
  const transport: FeedTransport = () => () => {};
  const heading = async (screen: () => JSX.Element) =>
    textOf(find((await mount(screen, () => undefined)).root, (n) => n.tag === "h2"));
  assert.equal(await heading(() => Logs({ transport })), "Logs");
  assert.equal(await heading(() => Logs({ transport, title: "Since restart" })), "Since restart");
  assert.equal(await heading(() => AuditLog({})), "Audit log");
  assert.equal(await heading(() => AuditLog({ title: "Audit trail" })), "Audit trail");
});

test("Logs' status line carries its own class for its spacing", async () => {
  const Logs = await loadLogs();
  const { root } = await mount(() => Logs({ transport: () => () => {} }), () => undefined);
  const status = find(root, (n) => n.tag === "p" && n.props.role === "status");
  assert.match(String(status.props.class), /\bapp-log__status\b/);
});

const CAPS_LOCK = "Caps Lock is on";

/** `event` bubbling out of `input` to its field, with Caps Lock `on` or off. */
async function capsLock(
  input: Element,
  event: "onKeyDown" | "onKeyUp" | "onPointerDown" | "onFocusIn" | "onFocusOut",
  on: boolean,
) {
  (input.parent!.props[event] as (e: unknown) => void)({
    getModifierState: (key: string) => key === "CapsLock" && on,
  });
  await settled();
}

/** What `input`'s `aria-describedby` points at, read aloud. */
const describing = (root: Element, input: Element) =>
  String(input.props["aria-describedby"] ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => textOf(find(root, (n) => n.props.id === id)))
    .join(" | ");

test("Every password field of the first account, change-password and a password asked again warns of Caps Lock", async () => {
  const { FirstAccount } = await load<typeof import("../src/screens/FirstAccount.tsx")>(
    "/src/screens/FirstAccount.tsx",
  );
  const { PasswordSettings } = await load<typeof import("../src/screens/PasswordSettings.tsx")>(
    "/src/screens/PasswordSettings.tsx",
  );
  const { PasswordAgain } = await load<typeof import("../src/parts/PasswordAgain.tsx")>(
    "/src/parts/PasswordAgain.tsx",
  );
  for (const [name, screen, fields] of [
    ["FirstAccount", () => FirstAccount({ appName: "Widgets", onDone() {} }), 2],
    ["PasswordSettings", () => PasswordSettings({}), 3],
    ["PasswordAgain", () => PasswordAgain({ value: "", onValue() {} }), 1],
  ] as const) {
    const { root } = await mount(screen, () => undefined);
    const inputs = [...within(root)].filter((n) => n.tag === "input" && n.props.type === "password");
    assert.equal(inputs.length, fields, name);
    for (const input of inputs) {
      await capsLock(input, "onFocusIn", true);
      await capsLock(input, "onKeyDown", true);
      assert.match(describing(root, input), new RegExp(CAPS_LOCK), name);
    }
  }
});

/** `event` from `control`, holding `value`, bubbling through every handler above it. */
async function bubble(control: Element, event: "onInput" | "onChange", value: string) {
  for (let at: Element | undefined = control; at; at = at.parent) {
    (at.props[event] as ((e: unknown) => void) | undefined)?.({ target: { value }, currentTarget: at });
  }
  await settled();
}

/** The two inputs of a `NewPassword` under `scope`, typed into in order. */
async function typeNewPassword(scope: Element, value: string, again: string) {
  const [first, second] = [...within(scope)].filter((n) => n.tag === "input" && n.props.autocomplete === "new-password");
  await bubble(first!, "onInput", value);
  await bubble(second!, "onInput", again);
}

test("A new password says the mismatch only once the second is typed, and is ready only when both match and are not empty", async () => {
  const { NewPassword, createNewPassword } = await load<typeof import("../src/parts/NewPassword.tsx")>(
    "/src/parts/NewPassword.tsx",
  );
  const password = createNewPassword();
  const { root } = await mount(
    () => NewPassword({ of: password, label: "New password", hint: "At least 12 characters." }),
    () => undefined,
  );
  const inputs = [...within(root)].filter((n) => n.tag === "input");
  assert.equal(inputs.length, 2);
  const mismatch = () => [...within(root)].some((n) => textOf(n) === "This does not match the new password.");

  assert.deepEqual([password.matches(), password.ready(), mismatch()], [true, false, false], "both empty");
  await bubble(inputs[0]!, "onInput", "correct horse");
  assert.deepEqual([password.ready(), mismatch()], [false, false], "the second not typed yet");
  await bubble(inputs[1]!, "onInput", "correct");
  assert.deepEqual([password.ready(), mismatch()], [false, true]);
  assert.equal(inputs[1]!.props["aria-invalid"], "true");
  await bubble(inputs[1]!, "onInput", "correct horse");
  assert.deepEqual([password.ready(), mismatch()], [true, false]);
});

const member = { ...admin, id: "2", username: "member", role: "operator" } as const;
const owner = { ...admin, id: "3", username: "owner", role: "hostadmin" } as const;

/**
 * `AccountSettings` with `props`, over three accounts and the member's role in
 * widgets, with any other request answered by `answer`.
 */
async function accounts(
  props: Parameters<typeof import("../src/screens/AccountSettings.tsx").AccountSettings>[0],
  answer: Answer = () => undefined,
) {
  const { AccountSettings } = await load<typeof import("../src/screens/AccountSettings.tsx")>(
    "/src/screens/AccountSettings.tsx",
  );
  const granted = [{ user_id: member.id, app: "widgets", role: "operator" }];
  const none = { totp: false, passkeys: 0, totp_required: false };
  const listed: ListedUser[] = [
    { ...admin, ...none },
    { ...member, ...none, totp: true, passkeys: 2 },
    { ...owner, ...none, passkeys: 1, totp_required: true },
  ];
  return mount(
    () => AccountSettings(props),
    (path, init) =>
      path === "/api/users" && init.method === undefined
        ? Response.json(listed)
        : path === "/api/app-roles"
          ? Response.json(granted)
          : answer(path, init),
  );
}

const glyphs = (root: Element, username: string) =>
  [...within(find(root, (n) => n.tag === "td" && textOf(n).startsWith(username)))]
    .filter((n) => n.props.role === "img")
    .map((n) => [n.props["aria-label"], n.props.title]);

test("A row draws its account's second factors, labelled, and draws none for a console's caller", async () => {
  const { root } = await accounts({ me: admin });
  assert.deepEqual(glyphs(root, "admin"), []);
  assert.deepEqual(glyphs(root, "member"), [
    ["TOTP is on", "TOTP is on"],
    ["2 passkeys", "2 passkeys"],
  ]);
  const required = "Must set up TOTP at the next sign-in with a password";
  assert.deepEqual(glyphs(root, "owner"), [
    ["1 passkey", "1 passkey"],
    [required, required],
  ]);

  const asserted = await accounts({ me: { id: "c-1", username: "ops", role: "admin" } });
  assert.match(textOf(asserted.root), /member/);
  assert.deepEqual(glyphs(asserted.root, "member"), []);
});

const menus = (root: Element) =>
  [...within(root)].filter((n) => n.props.role === "menu").map((n) => n.props["aria-label"]);

test("Your own row has no menu", async () => {
  const { root } = await accounts({ me: admin });
  assert.match(textOf(root), /admin.*You/);
  assert.deepEqual(menus(root), ["Actions for member"]);
});

test("A caller is offered the roles up to their own, and a menu on the rows holding one", async () => {
  const options = async (me: typeof admin | typeof owner) => {
    const { root } = await accounts({ me });
    await click(root, "Add account…");
    return [...within(find(root, (n) => n.tag === "dialog"))].filter((n) => n.tag === "option").map(textOf);
  };
  assert.deepEqual(await options(admin), ["Viewer", "Operator", "Admin"]);
  assert.deepEqual(await options(owner), ["Viewer", "Operator", "Admin", "Host admin"]);

  assert.deepEqual(menus((await accounts({ me: owner })).root), ["Actions for admin", "Actions for member"]);
});

test("A role per app is a column only when the host names its apps", async () => {
  const bare = await accounts({ me: admin });
  assert.doesNotMatch(textOf(bare.root), /widgets/);
  assert.ok(!bare.asked.some((a) => a.path === "/api/app-roles"));

  const { root } = await accounts({ me: admin, apps: ["widgets"] });
  assert.ok(find(root, (n) => n.tag === "th" && textOf(n) === "widgets"));
  assert.equal(find(root, (n) => n.props["aria-label"] === "member's role in widgets").props.value, "operator");
  assert.equal(find(root, (n) => n.props["aria-label"] === "admin's role in widgets").props.value, "");
  assert.ok(![...within(root)].some((n) => n.props["aria-label"] === "owner's role in widgets"), "a host admin is Admin");
});

test("A refused role in an app shows the role held again, and None sends a null", async () => {
  let refused = true;
  const { root, asked } = await accounts({ me: admin, apps: ["widgets"] }, (_, init) =>
    init.method !== "PUT"
      ? undefined
      : refused
        ? Response.json({ error: "that role is not this app's" }, { status: 403 })
        : new Response(null, { status: 204 }),
  );
  // As in a browser, the select shows the choice before the screen hears of it.
  const choose = async (role: string) => {
    const select = { value: role };
    const named = (n: Element) => n.props["aria-label"] === "member's role in widgets";
    (find(root, named).props.onChange as (e: unknown) => void)({ currentTarget: select });
    await settled();
    return select.value;
  };

  assert.equal(await choose("admin"), "operator");
  assert.match(textOf(root), /that role is not this app's/);
  refused = false;
  assert.equal(await choose(""), "");
  assert.deepEqual(
    asked.filter((a) => a.method === "PUT").map((a) => [a.path, a.body]),
    [
      ["/api/users/2/apps/widgets", { role: "admin" }],
      ["/api/users/2/apps/widgets", { role: null }],
    ],
  );
});

const pills = (root: Element) => [...within(root)].filter((n) => n.props.role === "tab").map(textOf);

const selectedPill = (root: Element) =>
  textOf(find(root, (n) => n.props.role === "tab" && n.props["aria-selected"] === true));

test("A viewer sees their own three views and no Accounts, and no account list is asked for", async () => {
  const viewer = { ...admin, id: "5", username: "viewer", role: "viewer" } as const;
  const { root, asked } = await accounts({ me: viewer, view: "accounts" });
  assert.deepEqual(pills(root), ["Passkeys", "Password", "2FA"]);
  assert.equal(selectedPill(root), "Passkeys", "a view it is not offered opens Passkeys");
  assert.doesNotMatch(textOf(root), /Everybody who can sign in|Add account/);
  assert.ok(!asked.some((a) => a.path === "/api/users"));
});

test("An admin sees four views, and a view id it does not know opens Accounts", async () => {
  for (const view of ["add", "sign-in", undefined]) {
    const { root } = await accounts({ me: admin, view });
    assert.deepEqual(pills(root), ["Passkeys", "Password", "2FA", "Accounts"]);
    assert.equal(selectedPill(root), "Accounts", String(view));
  }
  const { root } = await accounts({ me: admin, view: "two-step" });
  assert.equal(selectedPill(root), "2FA");
});

test("SecuritySettings is the three views alone, opening on Passkeys", async () => {
  const { SecuritySettings } = await load<typeof import("../src/screens/SecuritySettings.tsx")>(
    "/src/screens/SecuritySettings.tsx",
  );
  const { root } = await mount(() => SecuritySettings({ view: "accounts" }), () => undefined);
  assert.deepEqual(pills(root), ["Passkeys", "Password", "2FA"]);
  assert.equal(selectedPill(root), "Passkeys");
});

test("Adding an account sends it, says so, and returns to the list", async () => {
  const { root, asked } = await accounts({ me: admin }, (path, init) =>
    path === "/api/users" && init.method === "POST" ? Response.json({ ...member, id: "4", username: "newcomer" }) : undefined,
  );
  await click(root, "Add account…");
  const dialog = find(root, (n) => n.tag === "dialog");
  await bubble(find(dialog, (n) => n.tag === "input" && n.props.autocomplete === "off"), "onInput", "newcomer");
  await typeNewPassword(dialog, "correct horse battery", "correct horse battery");
  await bubble(find(dialog, (n) => n.tag === "select"), "onChange", "operator");
  await typeOwnPassword(dialog, "the administrator's own");
  (find(dialog, (n) => n.tag === "form").props.onSubmit as (event: { preventDefault(): void }) => void)({
    preventDefault() {},
  });
  await settled();
  assert.ok(![...within(root)].some((n) => n.tag === "dialog"), "the dialog closed");
  const listed = asked.filter((a) => a.path === "/api/users" && a.method === "GET");
  assert.equal(listed.length, 2, "the list read again");

  assert.deepEqual(asked.filter((a) => a.method === "POST"), [
    {
      path: "/api/users",
      method: "POST",
      body: {
        username: "newcomer",
        password: "correct horse battery",
        role: "operator",
        proof: { password: "the administrator's own" },
      },
    },
  ]);
  assert.match(textOf(root), /The account newcomer was created\./);
  assert.match(textOf(root), /Everybody who can sign in/);
  assert.doesNotMatch(textOf(root), /Add an account/);
});

test("An administrator's reset asks for the new password twice and sends nothing until the two match", async () => {
  const { AccountSettings } = await load<typeof import("../src/screens/AccountSettings.tsx")>(
    "/src/screens/AccountSettings.tsx",
  );
  const member = { ...admin, id: "2", username: "member" };
  const { root, asked } = await mount(
    () => AccountSettings({ me: admin }),
    (path, init) =>
      path === "/api/users"
        ? Response.json([admin, member])
        : init.method === "PUT"
          ? new Response(null, { status: 204 })
          : undefined,
  );
  await chooseFromMenu(root, "Actions for member", "Reset password…");
  const dialog = find(root, (n) => n.tag === "dialog");
  const reset = () => find(dialog, (n) => n.tag === "button" && textOf(n) === "Reset password");
  const sent = () => asked.filter((a) => a.method === "PUT");

  assert.equal([...within(dialog)].filter((n) => n.tag === "input" && n.props.autocomplete === "new-password").length, 2);
  assert.equal(reset().props.disabled, true, "nothing typed");
  await typeNewPassword(dialog, "correct horse battery", "correct horse");
  assert.equal(reset().props.disabled, true, "the two differ");
  assert.deepEqual(sent(), []);

  await typeNewPassword(dialog, "correct horse battery", "correct horse battery");
  assert.equal(reset().props.disabled, true, "no proof of the administrator yet");
  await typeOwnPassword(dialog, "the administrator's own");
  assert.equal(reset().props.disabled, false);
  await click(root, "Reset password");
  assert.deepEqual(sent(), [
    {
      path: "/api/users/2/password",
      method: "PUT",
      body: { password: "correct horse battery", proof: { password: "the administrator's own" } },
    },
  ]);
});

test("A row's glyphs follow requiring TOTP enrolment, removing a passkey and resetting the password", async () => {
  const { AccountSettings } = await load<typeof import("../src/screens/AccountSettings.tsx")>(
    "/src/screens/AccountSettings.tsx",
  );
  const none = { totp: false, passkeys: 0, totp_required: false };
  let theirs: ListedUser = { ...member, ...none, totp: true, passkeys: 2 };
  const { root } = await mount(
    () => AccountSettings({ me: admin }),
    (path, init) => {
      if (path === "/api/users") return Response.json([{ ...admin, ...none }, theirs]);
      if (path === "/api/users/2/passkeys") {
        return Response.json([{ id: "k1", name: "Key", host: "box.local", created_at: "2026-10-01T00:00:00Z", last_used_at: null }]);
      }
      if (init.method === undefined) return undefined;
      if (path === "/api/users/2/require-totp") theirs = { ...theirs, totp: false, totp_required: true };
      if (path === "/api/users/2/passkeys/k1/remove") theirs = { ...theirs, passkeys: theirs.passkeys - 1 };
      if (path === "/api/users/2/password") theirs = { ...theirs, totp: false, passkeys: 0 };
      return new Response(null, { status: 204 });
    },
  );
  const required = "Must set up TOTP at the next sign-in with a password";
  const proved = async (item: string, verb: string, typed = async (_: Element) => {}) => {
    await chooseFromMenu(root, "Actions for member", item);
    const dialog = find(root, (n) => n.tag === "dialog");
    await typed(dialog);
    await typeOwnPassword(dialog, "the administrator's own");
    await click(dialog, verb);
    await settled();
    return glyphs(root, "member").map(([label]) => label);
  };

  assert.deepEqual(await proved("Require TOTP enrolment…", "Require enrolment"), ["2 passkeys", required]);
  assert.deepEqual(await proved("Passkeys…", "Remove passkey"), ["1 passkey", required]);
  const reset = (dialog: Element) => typeNewPassword(dialog, "correct horse battery", "correct horse battery");
  assert.deepEqual(await proved("Reset password…", "Reset password", reset), [required]);
});

test("Choosing Accounts reads the list again, so your own row follows a change made in another view", async () => {
  const { AccountSettings } = await load<typeof import("../src/screens/AccountSettings.tsx")>(
    "/src/screens/AccountSettings.tsx",
  );
  const none = { totp: false, passkeys: 0, totp_required: false };
  let mine: ListedUser = { ...admin, ...none };
  const { root, asked } = await mount(
    () => AccountSettings({ me: admin }),
    (path) => (path === "/api/users" ? Response.json([mine]) : undefined),
  );
  const listed = () => asked.filter((a) => a.path === "/api/users").length;
  assert.equal(listed(), 1);

  await click(root, "2FA");
  mine = { ...mine, totp: true };
  assert.equal(listed(), 1, "not while another view is chosen");
  await click(root, "Accounts");
  assert.equal(listed(), 2);
  assert.deepEqual(glyphs(root, "admin").map(([label]) => label), ["TOTP is on"]);
});

/** The acting account's own password, as `FactorProofField` asks it while its TOTP is off. */
async function typeOwnPassword(scope: Element, value: string) {
  await bubble(find(scope, (n) => n.tag === "input" && n.props.autocomplete === "current-password"), "onInput", value);
}

const backupSettings = () =>
  load<typeof import("../src/screens/BackupSettings.tsx")>("/src/screens/BackupSettings.tsx");

test("Backup is the views Take, Restore and Schedule: the one a host routes, else Take", async () => {
  const { BackupSettings } = await backupSettings();
  const { root } = await mount(() => BackupSettings({}), () => undefined);
  assert.deepEqual(
    [...within(root)].filter((n) => n.props.role === "tab").map(textOf),
    ["Take", "Restore", "Schedule"],
  );
  assert.match(textOf(root), /Take a backup/);
  await click(root, "Restore");
  assert.match(textOf(root), /Restore from a backup/);
  assert.doesNotMatch(textOf(root), /Take a backup/);
  await click(root, "Schedule");
  assert.match(textOf(root), /Scheduled backups/);

  const routed = await mount(() => BackupSettings({ view: "restore" }), () => undefined);
  assert.match(textOf(routed.root), /Restore from a backup/);
});

/** A product section a take offers to leave out when `offered` says so. */
const optional = (offered: () => boolean | Promise<boolean>) => [
  { name: "node", label: "Node", hint: "this box's node", optional: offered },
];

const hasTick = (root: Element, label: string) =>
  [...within(root)].some((n) => n.tag === "label" && textOf(n).trim().startsWith(label));

const PASSPHRASE = "a passphrase long enough to be one";

/** Type the passphrase and, when asked, a password into Take, submit it, and return every take sent. */
async function take(root: Element, sent: Asked, password: boolean) {
  const input = (autocomplete: string) => find(root, (n) => n.tag === "input" && n.props.autocomplete === autocomplete);
  await bubble(input("new-password"), "onInput", PASSPHRASE);
  if (password) await bubble(input("current-password"), "onInput", "hunter2");
  await submit(root);
  return sent.filter((a) => a.path === "/api/backup").map((a) => a.body);
}

async function submit(root: Element) {
  (find(root, (n) => n.tag === "form").props.onSubmit as (event: { preventDefault(): void }) => void)({
    preventDefault() {},
  });
  await settled();
}

test("An optional section has a tick at take only when the product offers it, and a local session is never asked, nor for a password", async () => {
  const { BackupSettings } = await backupSettings();
  for (const [said, shown] of [
    [() => true, true],
    [async () => true, true],
    [() => false, false],
    [() => Promise.reject(new Error("the daemon will not say")), false],
  ] as const) {
    const { root } = await mount(() => BackupSettings({ sections: optional(said) }), () => undefined);
    assert.equal(hasTick(root, "Node"), shown, String(said));
    assert.doesNotMatch(textOf(root), new RegExp(BOUNDARY));
  }

  let asked = 0;
  const local = await mount(
    () => BackupSettings({ sections: optional(() => (asked++, true)) }),
    () => undefined,
    () => localAdmin,
  );
  assert.equal(hasTick(local.root, "Node"), false);
  assert.equal(asked, 0);
  assert.doesNotMatch(textOf(local.root), /Your password/);
  assert.deepEqual(await take(local.root, local.asked, false), [{ passphrase: PASSPHRASE }]);
});

test("A local caller that arrives after Take is mounted stops it asking for a password or what to leave out", async () => {
  const { BackupSettings } = await backupSettings();
  const { createSignal } = await load<typeof import("solid-js")>("solid-js");
  const [local, setLocal] = createSignal<LocalIdentity>();
  const { root, asked } = await mount(() => BackupSettings({ sections: optional(() => true) }), () => undefined, local);
  assert.match(textOf(root), /Your password/);
  await setTick(root, "Node", false);

  setLocal(localAdmin);
  await settled();
  assert.doesNotMatch(textOf(root), /Your password/);
  assert.equal(hasTick(root, "Node"), false);
  assert.deepEqual(await take(root, asked, false), [{ passphrase: PASSPHRASE }]);
});

const header = {
  format: "appliance-backup",
  version: 2,
  created_at: "2026-09-29T00:00:00Z",
  source_host: "widget-01",
  contains: {
    accounts: 0,
    settings: 0,
    trusted_certs: 1,
    trusted_cas: 0,
    serving_certificate: false,
    ssh_keys: 0,
    host: true,
    app: {},
  },
};

const inspected: Answer = (path) =>
  path === "/api/backup/inspect" ? Response.json({ header, warnings: [], blocked: {} }) : undefined;

/** Choose a file on Restore and Check it with the passphrase. */
async function check(root: Element) {
  const file = { name: "backup.json", size: 1, text: async () => JSON.stringify({ header }) };
  (find(root, (n) => n.props.type === "file").props.onChange as (e: unknown) => void)({
    currentTarget: { files: [file] },
  });
  await settled();
  await bubble(find(root, (n) => n.tag === "input" && n.props.autocomplete === "off"), "onInput", PASSPHRASE);
  await submit(root);
}

test("A local caller that arrives after Check offers only the application half", async () => {
  const { BackupSettings } = await backupSettings();
  const { createSignal } = await load<typeof import("solid-js")>("solid-js");
  const [local, setLocal] = createSignal<LocalIdentity>();
  const { root } = await mount(() => BackupSettings({ view: "restore" }), inspected, local);
  await check(root);
  assert.equal(hasTick(root, "Hostname"), true);

  setLocal(localAdmin);
  await settled();
  assert.equal(hasTick(root, "Hostname"), false);
  assert.equal(hasTick(root, "Pinned certificates"), true);
});

test("A take sends leave_out with an optional section's tick cleared, and none with it left", async () => {
  const { BackupSettings } = await backupSettings();
  const { root, asked } = await mount(() => BackupSettings({ sections: optional(() => true) }), () => undefined);
  const sent = { passphrase: PASSPHRASE, password: "hunter2" };
  assert.deepEqual(await take(root, asked, true), [sent]);
  await setTick(root, "Node", false);
  assert.deepEqual((await take(root, asked, true)).at(-1), { ...sent, leave_out: ["node"] });
  await setTick(root, "Node", true);
  assert.deepEqual((await take(root, asked, true)).at(-1), sent);
});

const consoleAdmin = { ...consoleOperator, role: "admin" } as const;

test("Behind a console Backup is Take and Restore of the application half, and asks no password", async () => {
  const { BackupSettings } = await backupSettings();
  const { root, asked } = await mount(
    () => BackupSettings({ sections: optional(() => true) }),
    inspected,
    () => undefined,
    consoleAdmin,
  );
  assert.deepEqual(
    [...within(root)].filter((n) => n.props.role === "tab").map(textOf),
    ["Take", "Restore"],
  );
  assert.doesNotMatch(textOf(root), /Your password/);
  assert.equal(hasTick(root, "Node"), false);
  assert.deepEqual(await take(root, asked, false), [{ passphrase: PASSPHRASE }]);

  await click(root, "Restore");
  await check(root);
  assert.equal(hasTick(root, "Pinned certificates"), true);
  assert.equal(hasTick(root, "Hostname"), false);
  assert.doesNotMatch(textOf(root), /Your password/);
});

test("A take refused for a stale proof sends a console's caller to re-authenticate there", async () => {
  const { BackupSettings } = await backupSettings();
  const stale = `${STALE_PROOF} in the last 5 minutes`;
  const refused: Answer = (path) =>
    path === "/api/backup" ? Response.json({ error: stale }, { status: 403 }) : undefined;
  const behind = await mount(() => BackupSettings({}), refused, () => undefined, consoleAdmin);
  await take(behind.root, behind.asked, false);
  assert.match(textOf(behind.root), new RegExp(`${stale}. Re-authenticate in the console, then try again.`));

  const own = await mount(() => BackupSettings({}), refused);
  await take(own.root, own.asked, true);
  assert.match(textOf(own.root), new RegExp(stale));
  assert.doesNotMatch(textOf(own.root), /console/);
});

test("A take refused for a wrong password shows the daemon's sentence", async () => {
  const { BackupSettings } = await backupSettings();
  const wrong = "that password is not this account's";
  const { root, asked } = await mount(
    () => BackupSettings({}),
    (path) => (path === "/api/backup" ? Response.json({ error: wrong }, { status: 403 }) : undefined),
  );
  assert.equal((await take(root, asked, true)).length, 1);
  assert.match(textOf(root), new RegExp(wrong));
});
