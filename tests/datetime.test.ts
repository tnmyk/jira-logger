import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStarted,
  rangeBounds,
  startOfWeekInZone,
  todayInZone,
} from "../src/lib/datetime";

afterEach(() => {
  vi.useRealTimers();
});

describe("Jira time formatting", () => {
  it("creates a started timestamp with the Jira timezone offset", () => {
    expect(buildStarted("2026-11-07", "09:00", "Asia/Kolkata")).toBe(
      "2026-11-07T09:00:00.000+0530",
    );
  });

  it("creates a UTC timestamp", () => {
    expect(buildStarted("2026-11-07", "09:00", "UTC")).toBe(
      "2026-11-07T09:00:00.000+0000",
    );
  });

  it("rejects a DST gap", () => {
    expect(() =>
      buildStarted("2026-03-08", "02:30", "America/New_York"),
    ).toThrow(/does not exist/i);
  });

  it("builds epoch bounds for a date range", () => {
    const { fromMs, toMs } = rangeBounds("2026-11-02", "2026-11-08", "UTC");
    expect(new Date(fromMs).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(new Date(toMs).toISOString()).toBe("2026-11-08T23:59:59.999Z");
  });

  it("uses the Jira timezone for today and week start", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T20:00:00.000Z"));

    expect(todayInZone("UTC")).toBe("2026-11-07");
    expect(todayInZone("Asia/Kolkata")).toBe("2026-11-08");
    expect(startOfWeekInZone("Asia/Kolkata", "monday")).toBe("2026-11-02");
  });
});
