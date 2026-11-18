import { describe, expect, it } from "vitest";
import { normalizeIssue } from "../src/lib/jira/normalize";

describe("normalizeIssue", () => {
  it("normalizes a Cloud issue", () => {
    const issue = normalizeIssue(
      {
        key: "ABC-123",
        fields: {
          summary: "Fix auth flow",
          status: {
            name: "In progress",
            statusCategory: { key: "indeterminate" },
          },
          assignee: {
            accountId: "account-1",
            displayName: "Dev User",
          },
          project: { key: "ABC", name: "Example" },
          issuetype: { name: "Task" },
          updated: "2026-11-07T09:00:00.000+0000",
          timetracking: { timeSpentSeconds: 3600, remainingEstimateSeconds: 7200 },
        },
      },
      "https://example.atlassian.net",
    );

    expect(issue).toMatchObject({
      key: "ABC-123",
      summary: "Fix auth flow",
      status: "In progress",
      statusCategory: "in-progress",
      assignee: { id: "account-1", name: "Dev User" },
      project: { key: "ABC", name: "Example" },
      url: "https://example.atlassian.net/browse/ABC-123",
      timeSpentSeconds: 3600,
      remainingEstimateSeconds: 7200,
    });
  });

  it("handles missing fields", () => {
    const issue = normalizeIssue({ key: "ABC-1" }, "https://example.atlassian.net");
    expect(issue.summary).toBe("(no summary)");
    expect(issue.statusCategory).toBe("unknown");
  });
});
