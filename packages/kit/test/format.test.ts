import { afterEach, expect, test, vi } from "vitest";

import { count, day, size } from "../src/format";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("count is singular only for exactly one, and takes an irregular plural", () => {
  expect([count(1, "device"), count(0, "device"), count(2, "device")]).toEqual(["1 device", "0 devices", "2 devices"]);
  expect([count(-1, "device"), count(1.5, "device")]).toEqual(["-1 devices", "1.5 devices"]);
  expect([count(1, "person", "people"), count(2, "person", "people")]).toEqual(["1 person", "2 people"]);
});

test("size steps from bytes to GiB, and dashes a missing size", () => {
  expect([size(null), size(undefined)]).toEqual(["—", "—"]);
  expect(size(1023)).toBe("1023 B");
  expect(size(1536)).toBe("2 KiB");
  expect(size(1.5 * 1024 ** 2)).toBe("1.5 MiB");
  expect(size(1024 ** 3 - 1)).toBe("1024.0 MiB");
  expect(size(1024 ** 3)).toBe("1.0 GiB");
  expect(size(2.5 * 1024 ** 3)).toBe("2.5 GiB");
});

test("day shows a date-only string as written west of UTC, and a timestamp in the local zone", () => {
  vi.stubEnv("TZ", "America/Los_Angeles");
  expect(day("2026-10-31")).toBe(new Date(2026, 9, 31).toLocaleDateString());
  expect(day("2026-10-31T02:00:00Z")).toBe(new Date(2026, 9, 30).toLocaleDateString());
  expect(day(null)).toBe("—");
});
