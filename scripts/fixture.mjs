// Builds fixtures/consumer against the kit and appliance-ui as installed
// packages: packed, so `files` is what ships, and copied into node_modules
// rather than linked, since vite treats a linked workspace as the app's own
// source and would prove nothing about the `solid` export condition.
// KIT_MODULES names another node_modules to take solid-js, vite,
// vite-plugin-solid and, if it has one, uqr from.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";

import { fail } from "./files.mjs";

const repo = resolve(import.meta.dirname, "..");
const fixture = join(repo, "fixtures/consumer");
const deps = process.env.KIT_MODULES ?? join(repo, "node_modules");
const { build, createServer } = await import(pathToFileURL(join(deps, "vite/dist/node/index.js")).href);
// Real path: vite 6 refuses to serve a file whose resolved path lies outside a symlinked root, as macOS's tmpdir is.
const work = realpathSync(mkdtempSync(join(tmpdir(), "kit-consumer-")));
const problems = [];

try {
  for (const entry of ["package.json", "index.html", "vite.config.ts", "src"]) {
    cpSync(join(fixture, entry), join(work, entry), { recursive: true });
  }
  const modules = join(work, "node_modules");
  mkdirSync(join(modules, "@wired-square"), { recursive: true });
  for (const dep of ["solid-js", "vite", "vite-plugin-solid"]) {
    symlinkSync(join(deps, dep), join(modules, dep), "dir");
  }
  mkdirSync(join(modules, "@tauri-apps"));
  symlinkSync(join(repo, "node_modules/@tauri-apps/api"), join(modules, "@tauri-apps/api"), "dir");
  symlinkSync(join(existsSync(join(deps, "uqr")) ? deps : join(repo, "node_modules"), "uqr"), join(modules, "uqr"), "dir");

  for (const name of ["@wired-square/kit", "@wired-square/tokens", "@wired-square/mcp-bridge", "@wired-square/appliance-types", "@wired-square/appliance-ui"]) {
    const tarball = execFileSync("npm", ["pack", "--silent", "--pack-destination", work, "-w", name], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    mkdirSync(join(modules, name));
    execFileSync("tar", ["-xzf", join(work, tarball), "-C", join(modules, name), "--strip-components", "1"]);
  }

  const plain = `
    const { Refusal, unanswered } = await import("@wired-square/kit/core");
    const refusal = new Refusal("x", { unanswered: true });
    process.stdout.write(String(refusal instanceof Error && refusal.message === "x" && unanswered(refusal)));
  `;
  if (execFileSync("node", ["--input-type=module", "-e", plain], { cwd: work, encoding: "utf8" }) !== "true") {
    problems.push("plain node imported @wired-square/kit/core, but its Refusal misbehaved");
  }

  const tokens = `
    const { light, dark } = await import("@wired-square/tokens");
    const { default: json } = await import("@wired-square/tokens/tokens.json", { with: { type: "json" } });
    process.stdout.write(String(Object.keys(json).length === Object.keys(light).length && json["--app-bg"].dark === dark["--app-bg"]));
  `;
  if (execFileSync("node", ["--input-type=module", "-e", tokens], { cwd: work, encoding: "utf8" }) !== "true") {
    problems.push("plain node imported @wired-square/tokens and its tokens.json, but they disagree");
  }
  if (!existsSync(join(modules, "@wired-square/tokens/dist/tokens.d.ts"))) problems.push("the packed tokens carry no types");

  const bridge = `
    globalThis.window = new EventTarget();
    const { DOM_OPS, DOM_OP_CLASS } = await import("@wired-square/mcp-bridge/dom-ops");
    const { REQUEST_EVENT, startHarnessBridge } = await import("@wired-square/mcp-bridge/tauri-bridge");
    process.stdout.write(String(DOM_OPS.length === 6 && DOM_OP_CLASS.query === "read" && REQUEST_EVENT === "harness:request" && typeof startHarnessBridge === "function"));
  `;
  if (execFileSync("node", ["--input-type=module", "-e", bridge], { cwd: work, encoding: "utf8" }) !== "true") {
    problems.push("plain node imported @wired-square/mcp-bridge's entry points, but they misbehaved");
  }
  for (const entry of ["dom-ops", "tauri-bridge"]) {
    if (!existsSync(join(modules, `@wired-square/mcp-bridge/dist/${entry}.d.ts`))) problems.push(`the packed mcp-bridge's ${entry} carries no types`);
  }

  const constants = `
    const { ROLE_LADDER, TOKEN_PREFIX } = await import("@wired-square/appliance-types");
    process.stdout.write(String(ROLE_LADDER.includes("admin") && TOKEN_PREFIX === "--app-"));
  `;
  if (execFileSync("node", ["--input-type=module", "-e", constants], { cwd: work, encoding: "utf8" }) !== "true") {
    problems.push("plain node imported @wired-square/appliance-types, but its constants are wrong");
  }
  // NodeNext, the strictest resolution a consumer can use: the .d.ts files must import each other with an extension.
  writeFileSync(
    join(work, "appliance-types.ts"),
    `import { ROLE_LADDER, type AppLink, type Role } from "@wired-square/appliance-types";
    export const typed: [Role, AppLink] = [ROLE_LADDER[0], { name: "console", href: "/" }];\n`,
  );
  try {
    execFileSync(join(repo, "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--module", "nodenext", "appliance-types.ts"], { cwd: work, encoding: "utf8" });
  } catch (error) {
    problems.push(`the packed appliance-types does not typecheck under NodeNext:\n${error.stdout}`);
  }

  const applianceVite = `
    const { applianceProxy, applianceVite } = await import("@wired-square/appliance-ui/vite");
    const config = applianceVite({ plugins: [{ name: "app" }] });
    process.stdout.write(String(config.base === "./" && config.plugins.at(-1).name === "app" && "/healthz" in applianceProxy()));
  `;
  if (execFileSync("node", ["--input-type=module", "-e", applianceVite], { cwd: work, encoding: "utf8" }) !== "true") {
    problems.push("plain node imported @wired-square/appliance-ui/vite, but it misbehaved");
  }
  if (!existsSync(join(modules, "@wired-square/appliance-ui/dist/vite.d.ts"))) problems.push("the packed appliance-ui's vite carries no types");

  // The dev server's pre-bundler is esbuild, which compiles JSX for React: the
  // kit and appliance-ui must be served as source and through vite-plugin-solid.
  const server = await createServer({ root: work, logLevel: "silent", server: { middlewareMode: true, ws: false } });
  try {
    const main = await server.transformRequest("/src/main.tsx");
    const kitImport = main?.code.match(/from\s+"([^"]*@wired-square[_/]kit[^"]*)"/)?.[1] ?? "";
    if (!/\/node_modules\/@wired-square\/kit\/src\/index\.ts/.test(kitImport)) {
      problems.push(`the dev server imports the kit from ${kitImport || "nowhere"}, not its source`);
    }
    const uiImport = main?.code.match(/from\s+"([^"]*@wired-square[_/]appliance-ui[^"]*)"/)?.[1] ?? "";
    if (!/\/node_modules\/@wired-square\/appliance-ui\/src\/index\.ts/.test(uiImport)) {
      problems.push(`the dev server imports appliance-ui from ${uiImport || "nowhere"}, not its source`);
    }
    const coreImports = await Promise.all(
      ["/src/main.tsx", "/node_modules/@wired-square/kit/src/ScreenBoundary.tsx"].map(
        async (url) => (await server.transformRequest(url))?.code.match(/from\s+"([^"]*@wired-square[_/]kit[^"]*core\.js[^"]*)"/)?.[1],
      ),
    );
    if (coreImports.some((url) => !/^\/node_modules\/@wired-square\/kit\/dist\/core\.js/.test(url ?? ""))) {
      problems.push(`the app and the kit's source import core from ${coreImports.join(" and ")}, not one dist/core.js`);
    }
    for (const [owner, url] of [
      ["the kit", "/node_modules/@wired-square/kit/src/Notice.tsx"],
      ["appliance-ui", "/node_modules/@wired-square/appliance-ui/src/screens/OutboundTrust.tsx"],
    ]) {
      const code = (await server.transformRequest(url))?.code ?? "";
      if (!/_\$template\(/.test(code) || /React|jsxDEV|jsx\(/.test(code)) {
        problems.push(`the dev server did not compile ${owner}'s TSX with Solid's transform`);
      }
    }
    await server.waitForRequestsIdle();
    const { optimized, discovered } = server.environments.client.depsOptimizer.metadata;
    if ([...Object.keys(optimized), ...Object.keys(discovered)].some((id) => id.startsWith("@wired-square/appliance-ui"))) {
      problems.push("the dev server pre-bundles appliance-ui, outside Solid's transform");
    }
  } finally {
    // Vite 6 never settles close() while the pre-transforms of main.tsx's imports are in flight.
    await server.waitForRequestsIdle();
    await server.close();
  }

  await build({ root: work, logLevel: "warn" });
  const dist = join(work, "dist");
  const html = readFileSync(join(dist, "index.html"), "utf8");
  if (/<style/i.test(html) || /\sstyle=/i.test(html)) problems.push("the built HTML carries a <style> or a style= attribute");
  const assets = readdirSync(join(dist, "assets"));
  const fonts = assets.filter((file) => /\.(woff2?|ttf|otf|eot)$/.test(file));
  if (fonts.length) problems.push(`fonts were bundled: ${fonts.join(", ")}`);
  const scripts = assets.filter((file) => file.endsWith(".js"));
  if (!scripts.some((file) => assets.includes(`${file}.gz`))) problems.push("applianceVite wrote no .gz beside the built script");
  const css = assets.filter((file) => file.endsWith(".css")).map((file) => readFileSync(join(dist, "assets", file), "utf8"));
  if (!css.some((text) => text.includes(".app-notice") && text.includes("--app-accent"))) {
    problems.push("the built stylesheet is missing theme.css or kit.css");
  }
  if (!css.some((text) => text.includes(".app-masthead") && text.includes(".app-qr") && text.includes("--app-qr-dark:"))) {
    problems.push("the built stylesheet is missing appliance-ui's shell.css or appliance.css, or kit's appliance tokens");
  }
  if (css.some((text) => /@font-face|url\(/.test(text))) problems.push("the built stylesheet loads a font or a URL");
  if (scripts.some((file) => /createElement\(["']style["']\)/.test(readFileSync(join(dist, "assets", file), "utf8")))) {
    problems.push("the built script injects a <style>");
  }

  // Run the bundle: a kit compiled for React, or a second solid-js, renders nothing that reacts.
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ""), { url: "http://localhost/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    fetch: async () => Response.json([]),
  });
  for (const file of scripts) await import(pathToFileURL(join(dist, "assets", file)).href);
  const app = dom.window.document.getElementById("app");
  for (let waited = 0; waited < 2000 && !app.textContent.includes("No authorities yet"); waited += 20) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const press = [...app.querySelectorAll("button")].find((b) => b.textContent === "Press");
  press?.click();
  press?.click();
  if (!app.querySelector(".app-section") || !app.querySelector(".app-scheme-picker")) {
    problems.push("the built app did not render the kit's components");
  } else if (!app.textContent.includes("Pressed 2 times")) {
    problems.push("the built app's kit components do not react to the app's signal");
  }
  if (!app.textContent.includes("Refused through core") || !app.textContent.includes("Recognised by core")) {
    problems.push("a Refusal from core and one from the root are not one class in the built app");
  }
  if (!app.textContent.includes("Trusted authorities") || !app.textContent.includes("No authorities yet")) {
    problems.push("the built app's appliance-ui Settings did not render its fetched section");
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

fail("consumer fixture", problems);
console.log(
  "consumer fixture: built against the packed kit and appliance-ui; core, tokens, mcp-bridge, appliance-types and appliance-ui/vite imported in plain node",
);
