import { formatInTimeZone } from "date-fns-tz";
import { mapLimit } from "../async";
import { rangeBounds } from "../datetime";
import type { CreateWorklogInput, WorklogEntry, WorklogSummary } from "../types";
import { textToAdf } from "./adf";
import { ApiError } from "./errors";
import {
  normalizeWorklog,
  type RawJiraWorklog,
} from "./normalize";
import { getMyself, jiraFetch, type JiraContext } from "./proxy";
import { getIssueWorklogs, searchSummaryIssues } from "./search";

const STARTED_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{4}$/;

export async function createWorklog(
  context: JiraContext,
  input: CreateWorklogInput,
): Promise<WorklogEntry> {
  const issueKey = input.issueKey.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(issueKey)) {
    throw new ApiError("INVALID_INPUT", "Ticket key is not valid.", 400);
  }
  if (!Number.isInteger(input.seconds) || input.seconds <= 0 || input.seconds > 86400) {
    throw new ApiError("INVALID_INPUT", "Worklog duration must be between 1 second and 24 hours.", 400);
  }
  if (!STARTED_PATTERN.test(input.started)) {
    throw new ApiError("INVALID_INPUT", "Worklog start time is not valid.", 400);
  }

  const adjustEstimate = input.adjustEstimate === "auto" ? "auto" : "leave";
  const notifyUsers = input.notifyWatchers === true;
  const query = new URLSearchParams({
    adjustEstimate,
    notifyUsers: String(notifyUsers),
  });

  const body: Record<string, unknown> = {
    timeSpentSeconds: input.seconds,
    started: input.started,
  };

  const comment = textToAdf(input.comment ?? "");
  if (comment) body.comment = comment;

  const data = await jiraFetch<RawJiraWorklog>(
    context,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog?${query.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return normalizeWorklog(data, issueKey);
}

export async function getWorklogSummary(
  context: JiraContext,
  params: {
    from: string;
    to: string;
    timeZone?: string;
    accountId?: string;
  },
): Promise<WorklogSummary> {
  let timeZone = params.timeZone;
  let accountId = params.accountId;

  if (!timeZone || !accountId) {
    const myself = await getMyself(context);
    timeZone ||= myself.timeZone;
    accountId ||= myself.accountId;
  }

  if (!timeZone || !accountId) {
    throw new ApiError("JIRA_UNAVAILABLE", "Jira did not return a user timezone.", 502);
  }

  const { fromMs, toMs } = rangeBounds(params.from, params.to, timeZone);
  const jql = `worklogAuthor = currentUser() AND worklogDate >= "${params.from}" AND worklogDate <= "${params.to}" ORDER BY updated DESC`;
  const rawIssues = await searchSummaryIssues(context, jql);

  const seen = new Set<string>();
  const issues = rawIssues.filter((issue) => {
    if (seen.has(issue.key)) return false;
    seen.add(issue.key);
    return true;
  });

  const entriesByIssue = await mapLimit(issues, 4, async (issue) => {
    const rawWorklogs = await getIssueWorklogs(context, issue.key, fromMs, toMs);
    return rawWorklogs
      .filter((worklog) => {
        const authorId = worklog.author?.accountId ?? worklog.author?.name;
        return authorId === accountId;
      })
      .map((worklog) =>
        normalizeWorklog(worklog, issue.key, issue.fields?.summary),
      );
  });

  const entries = entriesByIssue.flat().sort((a, b) => {
    return new Date(b.started).getTime() - new Date(a.started).getTime();
  });

  const byDay: Record<string, number> = {};
  const byIssue: Record<string, number> = {};
  let totalSeconds = 0;

  for (const entry of entries) {
    totalSeconds += entry.seconds;
    byIssue[entry.issueKey] = (byIssue[entry.issueKey] ?? 0) + entry.seconds;
    const day = formatInTimeZone(new Date(entry.started), timeZone, "yyyy-MM-dd");
    byDay[day] = (byDay[day] ?? 0) + entry.seconds;
  }

  return { entries, byDay, byIssue, totalSeconds };
}

export async function deleteWorklog(
  context: JiraContext,
  input: {
    issueKey: string;
    id: string;
    adjustEstimate?: "leave" | "auto";
  },
): Promise<{ ok: true }> {
  const issueKey = input.issueKey.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(issueKey)) {
    throw new ApiError("INVALID_INPUT", "Ticket key is not valid.", 400);
  }
  if (!/^\d+$/.test(input.id)) {
    throw new ApiError("INVALID_INPUT", "Worklog id is not valid.", 400);
  }

  const [worklog, myself] = await Promise.all([
    jiraFetch<RawJiraWorklog>(
      context,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${input.id}`,
    ),
    getMyself(context),
  ]);

  const authorId = worklog.author?.accountId ?? worklog.author?.name;
  if (authorId !== myself.accountId) {
    throw new ApiError("JIRA_FORBIDDEN", "You can only delete your own worklogs.", 403);
  }

  const query = new URLSearchParams({
    adjustEstimate:
      input.adjustEstimate === "auto" ? "auto" : "leave",
    notifyUsers: "false",
  });

  await jiraFetch(
    context,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${input.id}?${query.toString()}`,
    { method: "DELETE" },
  );

  return { ok: true };
}
