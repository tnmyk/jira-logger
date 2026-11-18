import { describe, expect, it } from "vitest";
import { normalizeBaseUrl } from "../src/lib/jira/proxy";

describe("normalizeBaseUrl", () => {
  it("accepts an Atlassian Cloud site", () => {
    expect(normalizeBaseUrl("https://acme.atlassian.net/")).toBe(
      "https://acme.atlassian.net",
    );
  });

  it("accepts a local mock Jira over http", () => {
    expect(normalizeBaseUrl("http://localhost:4000")).toBe(
      "http://localhost:4000",
    );
    expect(normalizeBaseUrl("http://[::1]:4000")).toBe(
      "http://[::1]:4000",
    );
  });

  it("rejects non-Atlassian remote hosts", () => {
    expect(() => normalizeBaseUrl("https://example.com")).toThrow(
      /atlassian\.net/i,
    );
  });

  it("rejects plain http for remote hosts", () => {
    expect(() => normalizeBaseUrl("http://acme.atlassian.net")).toThrow(
      /https/i,
    );
  });

  it("rejects credentials and query strings", () => {
    expect(() =>
      normalizeBaseUrl("https://user:pass@acme.atlassian.net"),
    ).toThrow(/credentials/i);
    expect(() =>
      normalizeBaseUrl("https://acme.atlassian.net?x=1"),
    ).toThrow(/credentials/i);
  });

  it("rejects link-local metadata hosts", () => {
    expect(() => normalizeBaseUrl("http://169.254.169.254")).toThrow(
      /not allowed/i,
    );
  });
});
