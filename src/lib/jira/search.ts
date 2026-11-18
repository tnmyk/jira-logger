import type { SearchResponse, Ticket } from "../types";
import { ApiError } from "./errors";
import {
  normalizeIssue,
  type RawJiraIssue,
  type RawJiraSearchResponse,
  type RawJiraWorklog,
  type RawJiraWorklogPage,
} from "./normalize";
import { jiraFetch, type JiraContext } from "./proxy";

const SEARCH_FIELDS = [
  "summary",
  "status",
  "assignee",
  "reporter",
  "priority",
  "issuetype",
  "project",
  "updated",
  "timetracking",
];

const SUMMARY_FIELDS = ["summary", "project"];

export type SearchParams = {
  jql: string;
  nextPageToken?: string;
  maxResults?: number;
};

export async function searchIssues(
  context: JiraContext,
  params: SearchParams,
): Promise<SearchResponse> {
  const jql = params.jql.trim();
  if (!jql) {
    throw new ApiError("INVALID_INPUT", "JQL cannot be empty.", 400);
  }
  if (jql.length > 5000) {
    throw new ApiError("INVALID_INPUT", "JQL is too long.", 400);
  }

  const maxResults = Math.min(Math.max(params.maxResults ?? 50, 1), 100);
  const body: Record<string, unknown> = {
    jql,
    maxResults,
    fields: SEARCH_FIELDS,
  };
  if (params.nextPageToken) body.nextPageToken = params.nextPageToken;

  const data = await jiraFetch<RawJiraSearchResponse>(
    context,
    "/rest/api/3/search/jql",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return {
    issues: (data.issues ?? []).map((issue) => normalizeIssue(issue, context.baseUrl)),
    nextPageToken: data.nextPageToken,
    warningMessages: data.warningMessages,
  };
}

export async function getIssue(context: JiraContext, key: string): Promise<Ticket> {
  const normalizedKey = key.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(normalizedKey)) {
    throw new ApiError("INVALID_INPUT", "Ticket key is not valid.", 400);
  }

  const query = new URLSearchParams({
    fields: SEARCH_FIELDS.join(","),
  });

  const data = await jiraFetch<RawJiraIssue>(
    context,
    `/rest/api/3/issue/${encodeURIComponent(normalizedKey)}?${query.toString()}`,
  );

  return normalizeIssue(data, context.baseUrl);
}

export async function getIssueWorklogs(
  context: JiraContext,
  key: string,
  fromMs: number,
  toMs: number,
): Promise<RawJiraWorklog[]> {
  const worklogs: RawJiraWorklog[] = [];
  let startAt = 0;
  const maxResults = 100;

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(maxResults),
      startedAfter: String(fromMs),
      startedBefore: String(toMs),
    });

    const data = await jiraFetch<RawJiraWorklogPage>(
      context,
      `/rest/api/3/issue/${encodeURIComponent(key)}/worklog?${query.toString()}`,
    );

    const pageItems = data.worklogs ?? [];
    worklogs.push(...pageItems);

    const total = data.total ?? 0;
    startAt += pageItems.length;
    if (pageItems.length === 0 || startAt >= total || startAt >= 2000) break;
  }

  return worklogs;
}

export async function searchSummaryIssues(
  context: JiraContext,
  jql: string,
): Promise<RawJiraIssue[]> {
  const issues: RawJiraIssue[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const body: Record<string, unknown> = {
      jql,
      maxResults: 100,
      fields: SUMMARY_FIELDS,
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const data = await jiraFetch<RawJiraSearchResponse>(
      context,
      "/rest/api/3/search/jql",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    issues.push(...(data.issues ?? []));
    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }

  return issues;
}
