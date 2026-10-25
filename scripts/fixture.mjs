// Builds fixtures/consumer against the kit as an installed package: packed, so
// `files` is what ships, and copied into node_modules rather than linked, since
// vite treats a linked workspace as the app's own source and would prove
// nothing about the `solid` export condition.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";
import { build, createServer } from "vite";

import { fail } from "./files.mjs";

const repo = resolve(import.meta.dirname, "..");
const fixture = join(repo, "fixtures/consumer");
const work = mkdtempSync(join(tmpdir(), "kit-consumer-"));
const problems = [];

try {
  for (const entry of ["package.json", "index.html", "vite.config.ts", "src"]) {
    cpSync(join(fixture, entry), join(work, entry), { recursive: true });
  }
  const modules = join(work, "node_modules");
  mkdirSync(join(modules, "@wired-square"), { recursive: true });
  for (const dep of ["solid-js", "vite", "vite-plugin-solid"]) {
    symlinkSync(join(repo, "node_modules", dep), join(modules, dep), "dir");
  }

  const tarball = execFileSync("npm", ["pack", "--silent", "--pack-destination", work, "-w", "@wired-square/kit"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  const kit = join(modules, "@wired-square/kit");
  mkdirSync(kit);
  execFileSync("tar", ["-xzf", join(work, tarball), "-C", kit, "--strip-components", "1"]);

  // The dev server's pre-bundler is esbuild, which compiles JSX for React: the
  // kit must be served as source and through vite-plugin-solid.
  const server = await createServer({ root: work, logLevel: "silent", server: { middlewareMode: true, ws: false } });
  try {
    const main = await server.transformRequest("/src/main.tsx");
    const kitImport = main?.code.match(/from\s+"([^"]*@wired-square[_/]kit[^"]*)"/)?.[1] ?? "";
    if (!/\/node_modules\/@wired-square\/kit\/src\/index\.ts/.test(kitImport)) {
      problems.push(`the dev server imports the kit from ${kitImport || "nowhere"}, not its source`);
    }
    const notice = await server.transformRequest("/node_modules/@wired-square/kit/src/Notice.tsx");
    if (!/_\$template\(/.test(notice?.code ?? "") || /React|jsxDEV|jsx\(/.test(notice?.code ?? "")) {
      problems.push("the dev server did not compile the kit's TSX with Solid's transform");
    }
  } finally {
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
} finally {
  rmSync(work, { recursive: true, force: true });
}

fail("consumer fixture", problems);
console.log("consumer fixture: built and ran against the packed kit, with no helper");
