import { test } from "node:test";

test("the entry points load", async () => {
  await Promise.all([import("../src/index.ts"), import("../src/testing/index.ts"), import("../src/testing/setup.ts"), import("../src/vite.ts")]);
});
