import { afterEach, expect, test, vi } from "vitest";

import { DateModeToggle, DateModes, When, formatWhen, useDateModes } from "../src/index";
import { button, mount } from "../src/testing";

const at = new Date(Date.UTC(2027, 3, 15, 5, 13, 36));

afterEach(() => {
  vi.unstubAllEnvs();
});

test("formatWhen lays a time out in UTC or the local zone, in the locale given", () => {
  expect(formatWhen(at, "utc", { locale: "en-AU" })).toBe("15 Apr 2027, 05:13:36 UTC");
  vi.stubEnv("TZ", "Australia/Brisbane");
  expect(formatWhen(at, "local", { locale: "en-AU" })).toBe("15 Apr 2027, 15:13:36 AEST");
});

test("formatWhen's relative wording is the largest whole unit, unless the app words it itself", () => {
  const now = at.getTime();
  const relative = (seconds: number) => formatWhen(new Date(now + seconds * 1000), "relative", { locale: "en-AU", now });
  expect(relative(0)).toBe("now");
  expect(relative(5 * 60 + 59)).toBe("in 5 minutes");
  expect(relative(-3 * 3_600 - 120)).toBe("3 hours ago");
  expect(relative(-10 * 86_400)).toBe("last week");
  expect(relative(400 * 86_400)).toBe("next year");

  const countdown = vi.fn((when: Date, from: number) => `${(when.getTime() - from) / 1000}s left`);
  expect(formatWhen(new Date(now + 45_000), "relative", { now, relative: countdown })).toBe("45s left");
});

test("When follows the DateModes above it, which the toggle cycles, ticking only while relative", () => {
  vi.useFakeTimers({ now: at.getTime() - 5_000 });
  const relative = (when: Date, now: number) => `${Math.round((when.getTime() - now) / 1000)}s`;
  const root = mount(() => (
    <DateModes initial="utc" locale="en-AU" relative={relative}>
      <DateModeToggle />
      <When at={at} />
      <When at={new Date(at.getTime() + 60_000)} />
    </DateModes>
  ));
  const time = root.querySelector("time")!;
  expect(time.getAttribute("datetime")).toBe("2027-04-15T05:13:36.000Z");
  expect([button("UTC").textContent, time.textContent]).toEqual(["UTC", "15 Apr 2027, 05:13:36 UTC"]);
  expect(vi.getTimerCount()).toBe(0);

  button("UTC").click();
  expect(time.textContent).toMatch(/^15 Apr 2027, \d\d:13:36 \S+$/);
  expect(vi.getTimerCount()).toBe(0);

  button("Local").click();
  expect(time.textContent).toBe("5s");
  vi.advanceTimersByTime(2_000);
  expect(time.textContent).toBe("3s");
  expect(root.querySelectorAll("time")[1]!.textContent).toBe("63s");
  expect(vi.getTimerCount(), "one clock for every When").toBe(1);

  button("Relative").click();
  expect(button("UTC")).toBeTruthy();
  expect(vi.getTimerCount()).toBe(0);
});

test("a When with no DateModes above it shows local time", () => {
  const root = mount(() => <When at={at} />);
  expect(root.textContent).toBe(formatWhen(at, "local"));
});

test("useDateModes gives what When reads, so a search filter formats a time the same way", () => {
  vi.useFakeTimers({ now: at.getTime() - 5_000 });
  const relative = (when: Date, now: number) => `${Math.round((when.getTime() - now) / 1000)}s`;
  const Filter = () => {
    const { mode, now, locale, relative } = useDateModes();
    return <output>{formatWhen(at, mode(), { now: now(), locale, relative })}</output>;
  };
  const root = mount(() => (
    <DateModes initial="relative" locale="en-AU" relative={relative}>
      <Filter />
      <When at={at} />
    </DateModes>
  ));
  expect(root.querySelector("output")!.textContent).toBe("5s");
  vi.advanceTimersByTime(1_000);
  expect(root.querySelector("output")!.textContent).toBe(root.querySelector("time")!.textContent);
  expect(root.querySelector("output")!.textContent).toBe("4s");

  const bare = mount(() => <Filter />);
  expect(bare.textContent).toBe(formatWhen(at, "local"));
});
