import type { Ticket, TicketStatusCategory, WorklogEntry } from "../types";
import { adfToText } from "./adf";

export type RawJiraUser = {
  accountId?: string;
  name?: string;
  displayName?: string;
  emailAddress?: string;
  timeZone?: string;
};

export type RawJiraIssue = {
  id?: string;
  key: string;
  self?: string;
  fields?: {
    summary?: string;
    status?: {
      name?: string;
      statusCategory?: {
        key?: string;
        name?: string;
      };
    };
    assignee?: RawJiraUser | null;
    reporter?: RawJiraUser | null;
    priority?: { name?: string } | null;
    issuetype?: { name?: string } | null;
    project?: { key?: string; name?: string } | null;
    updated?: string;
    timetracking?: {
      timeSpentSeconds?: number;
      remainingEstimateSeconds?: number;
    } | null;
  };
};

export type RawJiraWorklog = {
  id: string;
  issueId?: string;
  started: string;
  timeSpentSeconds?: number;
  comment?: unknown;
  author?: RawJiraUser;
  updateAuthor?: RawJiraUser;
};

export type RawJiraSearchResponse = {
  issues?: RawJiraIssue[];
  nextPageToken?: string;
  warningMessages?: string[];
};

export type RawJiraWorklogPage = {
  startAt?: number;
  maxResults?: number;
  total?: number;
  worklogs?: RawJiraWorklog[];
};

export function normalizeStatusCategory(key?: string): TicketStatusCategory {
  if (key === "new") return "todo";
  if (key === "indeterminate") return "in-progress";
  if (key === "done") return "done";
  return "unknown";
}

export function normalizeIssue(raw: RawJiraIssue, baseUrl: string): Ticket {
  const fields = raw.fields ?? {};
  const assignee = fields.assignee ?? undefined;
  const reporter = fields.reporter ?? undefined;

  return {
    key: raw.key,
    summary: fields.summary ?? "(no summary)",
    status: fields.status?.name ?? "Unknown",
    statusCategory: normalizeStatusCategory(fields.status?.statusCategory?.key),
    issueType: fields.issuetype?.name,
    priority: fields.priority?.name,
    assignee: assignee
      ? {
          id: assignee.accountId ?? assignee.name ?? "",
          name: assignee.displayName ?? assignee.name ?? "Unknown",
        }
      : undefined,
    reporter: reporter
      ? {
          id: reporter.accountId ?? reporter.name ?? "",
          name: reporter.displayName ?? reporter.name ?? "Unknown",
        }
      : undefined,
    project: fields.project?.key
      ? {
          key: fields.project.key,
          name: fields.project.name ?? fields.project.key,
        }
      : undefined,
    updated: fields.updated,
    url: `${baseUrl}/browse/${encodeURIComponent(raw.key)}`,
    timeSpentSeconds: fields.timetracking?.timeSpentSeconds,
    remainingEstimateSeconds: fields.timetracking?.remainingEstimateSeconds,
  };
}

export function normalizeWorklog(
  raw: RawJiraWorklog,
  issueKey: string,
  issueSummary?: string,
): WorklogEntry {
  return {
    id: raw.id,
    issueKey,
    issueSummary,
    started: raw.started,
    seconds: raw.timeSpentSeconds ?? 0,
    comment: adfToText(raw.comment),
    authorId: raw.author?.accountId ?? raw.author?.name,
    authorName: raw.author?.displayName ?? raw.author?.name,
  };
}
