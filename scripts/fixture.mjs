// Builds fixtures/consumer against the kit as an installed package: packed, so
// `files` is what ships, and copied into node_modules rather than linked, since
// vite treats a linked workspace as the app's own source and would prove
// nothing about the `solid` export condition. KIT_MODULES names another
// node_modules to take solid-js, vite and vite-plugin-solid from.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
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

  for (const name of ["@wired-square/kit", "@wired-square/tokens"]) {
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

  // The dev server's pre-bundler is esbuild, which compiles JSX for React: the
  // kit must be served as source and through vite-plugin-solid.
  const server = await createServer({ root: work, logLevel: "silent", server: { middlewareMode: true, ws: false } });
  try {
    const main = await server.transformRequest("/src/main.tsx");
    const kitImport = main?.code.match(/from\s+"([^"]*@wired-square[_/]kit[^"]*)"/)?.[1] ?? "";
    if (!/\/node_modules\/@wired-square\/kit\/src\/index\.ts/.test(kitImport)) {
      problems.push(`the dev server imports the kit from ${kitImport || "nowhere"}, not its source`);
    }
    const coreImports = await Promise.all(
      ["/src/main.tsx", "/node_modules/@wired-square/kit/src/ScreenBoundary.tsx"].map(
        async (url) => (await server.transformRequest(url))?.code.match(/from\s+"([^"]*@wired-square[_/]kit[^"]*core\.js[^"]*)"/)?.[1],
      ),
    );
    if (coreImports.some((url) => !/^\/node_modules\/@wired-square\/kit\/dist\/core\.js/.test(url ?? ""))) {
      problems.push(`the app and the kit's source import core from ${coreImports.join(" and ")}, not one dist/core.js`);
    }
    const notice = await server.transformRequest("/node_modules/@wired-square/kit/src/Notice.tsx");
    if (!/_\$template\(/.test(notice?.code ?? "") || /React|jsxDEV|jsx\(/.test(notice?.code ?? "")) {
      problems.push("the dev server did not compile the kit's TSX with Solid's transform");
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
  const css = assets.filter((file) => file.endsWith(".css")).map((file) => readFileSync(join(dist, "assets", file), "utf8"));
  if (!css.some((text) => text.includes(".app-notice") && text.includes("--app-accent"))) {
    problems.push("the built stylesheet is missing theme.css or kit.css");
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
  });
  for (const file of scripts) await import(pathToFileURL(join(dist, "assets", file)).href);
  const app = dom.window.document.getElementById("app");
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
} finally {
  rmSync(work, { recursive: true, force: true });
}

fail("consumer fixture", problems);
console.log("consumer fixture: built against the packed kit; core and tokens imported in plain node");
