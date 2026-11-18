import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "../src/lib/duration";

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("90m")).toBe(5400);
  });

  it("parses hours and minutes", () => {
    expect(parseDuration("1h 30m")).toBe(5400);
    expect(parseDuration("1h30m")).toBe(5400);
  });

  it("parses decimal hours", () => {
    expect(parseDuration("1.5")).toBe(5400);
    expect(parseDuration("0.5")).toBe(1800);
  });

  it("parses h:mm", () => {
    expect(parseDuration("1:30")).toBe(5400);
    expect(parseDuration("0:45")).toBe(2700);
  });

  it("rejects invalid durations", () => {
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("25h")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(5400)).toBe("1h 30m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(1800)).toBe("30m");
    expect(formatDuration(0)).toBe("0m");
  });
});
