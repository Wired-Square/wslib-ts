import { expect, test } from "vitest";

import type { Pending } from "../src/index";
import { badge, rereadPacer, rereadsGoOn } from "../src/pending";

test("re-reads back off from the hint to 15 s, or to the hint when it is longer", () => {
  const nextWait = rereadPacer();
  const waits = [0, 1, 2, 3, 4].map(() => nextWait(5_000, 0));
  expect(waits).toEqual([5_000, 7_500, 11_250, 15_000, 15_000]);
  expect(rereadPacer()(20_000, 0)).toBe(20_000);
});

test("steady re-reads keep to the hint", () => {
  const nextWait = rereadPacer();
  const waits = [0, 1, 2, 3].map(() => nextWait(5_000, 0, true));
  expect(waits).toEqual([5_000, 5_000, 5_000, 5_000]);
});

test("a first unanswered call is re-read soon, and a second waits as it would have", () => {
  const nextWait = rereadPacer();
  expect(nextWait(5_000, 0, false, 1_500)).toBe(5_000);
  expect(nextWait(5_000, 1, false, 1_500)).toBe(1_500);
  expect(nextWait(5_000, 2, false, 1_500), "the recheck left the backoff alone").toBe(7_500);
  expect(nextWait(5_000, 1), "no recheck without asking for one").toBe(11_250);
});

test("three failed re-reads stop them, unless the third is a first unanswered call to recheck", () => {
  expect(rereadsGoOn(2, 0, 1_500)).toBe(true);
  expect(rereadsGoOn(3, 0, 1_500), "two refusals and a third").toBe(false);
  expect(rereadsGoOn(3, 1, 1_500), "two refusals, then the port closed").toBe(true);
  expect(rereadsGoOn(3, 2, 1_500), "the recheck has been made").toBe(false);
  expect(rereadsGoOn(3, 1, undefined), "no recheck without asking for one").toBe(false);
});

const pending: Pending<null> = {
  change: null,
  state: "pending",
  check_after_ms: 5_000,
  rollback: { in_ms: 180_000 },
  warnings: [],
};

test("a pending change counts down, unless this page is out of touch with it", () => {
  expect(badge(pending, 151_000, false)[1]).toBe("undone in 2:31");
  expect(badge(pending, 0, false)[1]).toBe("time up");
  expect(badge(pending, 151_000, true).slice(0, 2)).toEqual(["warn", "unknown"]);
  expect(badge(pending, 0, true)[1]).toBe("unknown");
  expect(
    badge({ ...pending, state: "settled", by: "operator", check_after_ms: null }, 0, true)[1],
    "an answer in a terminal state is not out of touch",
  ).toBe("kept");
});
