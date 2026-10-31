import assert from "node:assert/strict";
import { test } from "node:test";

import { applianceProxy, applianceVite } from "../src/vite.ts";

test("applianceVite serves relative to the page and runs the app's plugins after its own", () => {
  const config = applianceVite({ plugins: [{ name: "app" }] });
  assert.equal(config.base, "./");
  assert.deepEqual(
    config.plugins?.map((plugin) => (plugin as { name: string }).name),
    ["appliance-precompress", "appliance-dev-base", "app"],
  );
});

test("applianceProxy sends the API, the health check and the sockets to the stand-in", () => {
  const proxy = applianceProxy("https://localhost:8443");
  assert.deepEqual(Object.keys(proxy), ["/api", "/healthz", "/ws"]);
  assert.equal(proxy["/ws"].ws, true);
  assert.equal(proxy["/api"].ws, undefined);
  assert.equal(proxy["/ws"].target, "https://localhost:8443");
});
