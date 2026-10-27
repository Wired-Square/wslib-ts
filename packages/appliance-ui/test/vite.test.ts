import assert from "node:assert/strict";
import { test } from "node:test";

import { applianceVite } from "../src/vite.ts";

test("applianceVite serves relative to the page and runs the app's plugins after its own", () => {
  const config = applianceVite({ plugins: [{ name: "app" }] });
  assert.equal(config.base, "./");
  assert.deepEqual(
    config.plugins?.map((plugin) => (plugin as { name: string }).name),
    ["appliance-precompress", "appliance-dev-base", "app"],
  );
});
