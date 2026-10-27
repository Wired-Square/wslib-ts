/**
 * What the appliance daemon's serving contract asks of an app's vite config.
 * The app adds Solid's plugin itself:
 *
 *     export default defineConfig(applianceVite({ plugins: [solid()] }));
 */
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { constants, gzip } from "node:zlib";

import { mergeConfig } from "vite";
import type { Plugin, ProxyOptions, UserConfig } from "vite";

/** What gzip shrinks; anything else is left to the daemon's own compression. */
const COMPRESSIBLE = /\.(?:html|js|mjs|css|svg|json|map|txt|xml|wasm)$/;

const gzipped = promisify(gzip);

/**
 * Writes a `.gz` beside each compressible file in the output directory, public
 * files included, which the daemon sends in place of compressing that file per
 * request. A file gzip would not make smaller gets none, and loses any `.gz`
 * beside it, one from `public/` included.
 */
function precompress(): Plugin {
  return {
    name: "appliance-precompress",
    apply: "build",
    writeBundle: {
      order: "post",
      sequential: true,
      async handler({ dir }) {
        if (!dir) return;
        const entries = await readdir(dir, { recursive: true, withFileTypes: true });
        await Promise.all(
          entries
            .filter((entry) => entry.isFile() && COMPRESSIBLE.test(entry.name))
            .map(async (entry) => {
              const path = join(entry.parentPath, entry.name);
              const plain = await readFile(path);
              const gz = await gzipped(plain, { level: constants.Z_BEST_COMPRESSION });
              await (gz.length < plain.length ? writeFile(`${path}.gz`, gz) : rm(`${path}.gz`, { force: true }));
            }),
        );
      },
    },
  };
}

/** The `<base href>` the daemon would give the page, for a dev server serving at `/`, vite's default. */
function devBase(): Plugin {
  return {
    name: "appliance-dev-base",
    apply: "serve",
    transformIndexHtml: () => [{ tag: "base", attrs: { href: "/" }, injectTo: "head-prepend" }],
  };
}

/**
 * `extra` merged with what the daemon needs, by vite's `mergeConfig`, which
 * concatenates arrays: `plugins` given here join this wrapper's.
 *
 * `base: "./"` references the assets relative to the page, which the daemon
 * serves with a `<base href>` naming its base path, so one build runs at `/`
 * or under `/apps/<name>/`. `vite build` also writes a `.gz` beside each
 * compressible file, which the daemon sends to a browser that takes gzip, for
 * every file except `index.html`.
 */
export function applianceVite(extra: UserConfig = {}): UserConfig {
  return mergeConfig({ base: "./", plugins: [precompress(), devBase()] }, extra);
}

/**
 * The dev-server proxy to a development stand-in for the console in front of
 * the app's socket.
 *
 * Both `/api` and `/healthz` are proxied: a health check that falls through to
 * the SPA gets a 200 and reports the daemon up forever.
 *
 * A product that serves its own HTTPS passes its own listener, such as
 * `https://localhost:8443`; `secure: false` accepts the certificate it signed
 * for itself, in this proxy only. **Run that dev server over https**
 * (`server.https`): the session cookie is `Secure`, and a browser drops it on
 * an `http://` origin, so a sign-in answers 200 and then never happened.
 *
 * The browser's `Host` is passed through unchanged, so the backend sees the
 * name and port the page is on: a passkey binds to them.
 */
export function applianceProxy(target = "http://127.0.0.1:8080"): Record<"/api" | "/healthz", ProxyOptions> {
  const to = { target, changeOrigin: false, secure: false };
  return { "/api": to, "/healthz": to };
}
