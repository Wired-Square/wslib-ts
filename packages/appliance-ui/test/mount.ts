/**
 * Screens mounted under the browser's reactive core onto `universal.ts`'s
 * plain objects, with `fetch` answered by each test: what an operator sees,
 * and what a click sends. Importing this starts the vite server the screens
 * are loaded through.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { after, afterEach, before } from "node:test";
import type { LocalIdentity, User } from "@wired-square/appliance-types";
import type { JSX } from "solid-js";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import solidPlugin from "vite-plugin-solid";

import type { Me } from "../src/shell/session.ts";
import { admin as controlSocket, signedIn } from "../src/testing/sessions.ts";
import type { Element } from "./universal.ts";

let vite: ViteDevServer;
before(async () => {
  vite = await createServer({
    configFile: false,
    logLevel: "silent",
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [solidPlugin({ hot: false, solid: { generate: "universal", moduleName: "/test/universal.ts" } })],
    ssr: { noExternal: ["solid-js"], resolve: { conditions: ["browser"], externalConditions: ["browser"] } },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
});
after(() => vite.close());

globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
} as unknown as typeof MutationObserver;

// A screen left mounted keeps its timers, a shell's probe among them, and they keep the run alive.
const mounted: (() => void)[] = [];
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

export const load = <T>(path: string) => vite.ssrLoadModule(path) as Promise<T>;

export type Answer = (path: string, init: RequestInit) => Response | undefined;
export type Asked = { path: string; method: string; body: unknown }[];

export const admin: User = signedIn.me();

export const localAdmin: LocalIdentity = controlSocket.local();

export const consoleOperator: Me = { id: "c-17", username: "ops", role: "operator" };

export const BOUNDARY = "the shell's boundary caught";

/** Once nothing more is moving: every fetch answered and every effect run. */
export async function settled() {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * `screen` mounted untracked, as JSX mounts a component, inside `me`'s
 * session, or `local`'s, and under an `ErrorBoundary` standing for the shell's,
 * beside a `ProofHost`,
 * with each request answered by `answer` or else a 404; and every request it
 * made.
 */
export async function mount(
  screen: () => JSX.Element,
  answer: Answer,
  local: () => LocalIdentity | undefined = () => undefined,
  me: Me | null = admin,
) {
  const { Element, render } = await load<typeof import("./universal.ts")>("/test/universal.ts");
  const { ErrorBoundary, createComponent, untrack } = await load<typeof import("solid-js")>("solid-js");
  const { SessionProvider } = await load<typeof import("../src/shell/session.ts")>("/src/shell/session.ts");
  const { ProofHost } = await load<typeof import("../src/parts/withProof.tsx")>("/src/parts/withProof.tsx");
  const asked: Asked = [];
  globalThis.fetch = async (input, init = {}) => {
    const path = String(input);
    asked.push({
      path,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return answer(path, init) ?? Response.json({ error: `nothing answers ${path}` }, { status: 404 });
  };
  const root = new Element("root");
  const unmount = render(
    () =>
      createComponent(SessionProvider, {
        value: { branding: () => undefined, me: () => (local() ? null : me), local, refresh: () => {} },
        get children() {
          return [
            createComponent(ErrorBoundary, {
              fallback: (error: unknown) => `${BOUNDARY} ${String(error)}`,
              get children() {
                return untrack(screen);
              },
            }),
            createComponent(ProofHost, {}),
          ];
        },
      }) as unknown as Element,
    root,
  );
  mounted.push(unmount);
  await settled();
  return { root, asked };
}

export const textOf = (node: Element): string =>
  node.tag === "#text" ? node.text : node.children.map(textOf).join("");

export function* within(node: Element): Generator<Element> {
  yield node;
  for (const child of node.children) yield* within(child);
}

export function find(root: Element, matches: (node: Element) => boolean): Element {
  const found = [...within(root)].find(matches);
  assert.ok(found, "no such element");
  return found;
}

export const tickbox = (root: Element, label: string) =>
  find(
    find(root, (n) => n.tag === "label" && textOf(n).trim().startsWith(label)),
    (n) => n.tag === "input",
  );

/** A click on the tickbox: as in a browser, the box moves before the screen hears of it. */
export async function setTick(root: Element, label: string, checked: boolean) {
  const box = tickbox(root, label);
  box.props.checked = checked;
  (box.props.onChange as (e: unknown) => void)({ currentTarget: { checked } });
  await settled();
}

/** `item` chosen from the `Menu` named `menu`, opened and shut as the platform's popover would. */
export async function chooseFromMenu(root: Element, menu: string, item: string) {
  const named = (n: Element) => n.props["aria-label"] === menu;
  const panel = find(root, (n) => n.props.role === "menu" && named(n));
  const toggle = panel.props.onToggle as (e: { newState: string }) => void;
  Object.assign(panel, { style: {} });
  Object.assign(find(root, (n) => n.tag === "button" && named(n)), {
    getBoundingClientRect: () => ({ top: 0, bottom: 0, right: 0 }),
  });
  const window = globalThis.window;
  globalThis.window = { innerHeight: 800, addEventListener() {}, removeEventListener() {} } as unknown as typeof globalThis.window;
  try {
    toggle({ newState: "open" });
    await settled();
    await click(root, item);
    toggle({ newState: "closed" });
    await settled();
  } finally {
    globalThis.window = window;
  }
}

/** A click on the button `verb` names: as in a browser, a disabled one hears nothing. */
export async function click(root: Element, verb: string) {
  const named = (n: Element) => textOf(n) === verb || n.props["aria-label"] === verb;
  const button = find(root, (n) => n.tag === "button" && named(n));
  if (!button.props.disabled) (button.props.onClick as () => void)();
  await settled();
}

/** The dialog `ProofHost` holds open: the last under `root`, since the host follows the screen. */
export function proofDialog(root: Element): Element {
  const dialog = [...within(root)].filter((n) => n.tag === "dialog").at(-1);
  assert.ok(dialog, "no proof is being asked for");
  return dialog;
}

/** `value` typed into the open proof dialog's field that `matches`, its password by default, and the dialog sent. */
export async function prove(
  root: Element,
  value: string,
  matches = (n: Element) => n.props.autocomplete === "current-password",
) {
  const dialog = proofDialog(root);
  for (let at: Element | undefined = find(dialog, (n) => n.tag === "input" && matches(n)); at; at = at.parent) {
    (at.props.onInput as ((e: unknown) => void) | undefined)?.({ target: { value }, currentTarget: at });
  }
  await settled();
  (find(dialog, (n) => n.tag === "form").props.onSubmit as (event: { preventDefault(): void }) => void)({
    preventDefault() {},
  });
  await settled();
}
