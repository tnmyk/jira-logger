import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 4000);
const AUTH = `Basic ${Buffer.from("dev@example.com:token").toString("base64")}`;

const TIME_ZONE = "Asia/Kolkata";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
}).format(new Date());

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const yesterday = addDays(today, -1);
const twoDaysAgo = addDays(today, -2);
const threeDaysAgo = addDays(today, -3);
const fourDaysAgo = addDays(today, -4);
const fiveDaysAgo = addDays(today, -5);

const at = (day, time) => `${day}T${time}:00.000+0530`;

const issues = [
  {
    key: "ABC-101",
    summary: "Fix OAuth callback race condition",
    status: "In progress",
    category: "indeterminate",
    issueType: "Task",
    project: "ABC",
    assignee: "Dev User",
    updated: at(today, "10:48"),
  },
  {
    key: "ABC-102",
    summary: "Billing retry job drops attempts after restart",
    status: "To Do",
    category: "new",
    issueType: "Bug",
    project: "ABC",
    assignee: "Dev User",
    updated: at(today, "09:12"),
  },
  {
    key: "ABC-103",
    summary: "Add audit trail for permission changes",
    status: "In review",
    category: "indeterminate",
    issueType: "Story",
    project: "ABC",
    assignee: "Mira Shah",
    updated: at(yesterday, "17:30"),
  },
  {
    key: "ABC-104",
    summary: "Remove legacy feature flag from onboarding",
    status: "In review",
    category: "indeterminate",
    issueType: "Task",
    project: "ABC",
    assignee: "Dev User",
    updated: at(yesterday, "14:05"),
  },
  {
    key: "ABC-105",
    summary: "Search results lose filter when navigating back",
    status: "In progress",
    category: "indeterminate",
    issueType: "Bug",
    project: "ABC",
    assignee: "Noah Kim",
    updated: at(twoDaysAgo, "16:20"),
  },
  {
    key: "ABC-106",
    summary: "Document webhook retry policy",
    status: "To Do",
    category: "new",
    issueType: "Task",
    project: "ABC",
    assignee: "Dev User",
    updated: at(twoDaysAgo, "11:04"),
  },
  {
    key: "ABC-107",
    summary: "Reduce cold start in ingestion worker",
    status: "In progress",
    category: "indeterminate",
    issueType: "Spike",
    project: "ABC",
    assignee: "Dev User",
    updated: at(threeDaysAgo, "15:45"),
  },
  {
    key: "ABC-108",
    summary: "Upgrade node runtime on reporting service",
    status: "To Do",
    category: "new",
    issueType: "Task",
    project: "OPS",
    assignee: "Dev User",
    updated: at(threeDaysAgo, "09:10"),
  },
  {
    key: "OPS-12",
    summary: "Rotate deploy credentials",
    status: "In progress",
    category: "indeterminate",
    issueType: "Task",
    project: "OPS",
    assignee: "Dev User",
    updated: at(fourDaysAgo, "18:02"),
  },
  {
    key: "OPS-13",
    summary: "Clean up stale preview environments",
    status: "To Do",
    category: "new",
    issueType: "Task",
    project: "OPS",
    assignee: "Dev User",
    updated: at(fourDaysAgo, "12:44"),
  },
  {
    key: "ADMIN-1",
    summary: "Team rituals and admin time",
    status: "In progress",
    category: "indeterminate",
    issueType: "Task",
    project: "ADMIN",
    assignee: "Dev User",
    updated: at(fiveDaysAgo, "08:30"),
  },
];

const initialWorklogs = [
  {
    id: "9001",
    issueKey: "ABC-101",
    started: at(today, "09:15"),
    seconds: 5400,
    comment: "Instrumented callback and added guard.",
  },
  {
    id: "9002",
    issueKey: "ABC-102",
    started: at(today, "13:00"),
    seconds: 3600,
    comment: "Reproduced restart failure.",
  },
  {
    id: "9003",
    issueKey: "ADMIN-1",
    started: at(today, "08:30"),
    seconds: 900,
    comment: "Daily standup.",
  },
  {
    id: "9004",
    issueKey: "ABC-103",
    started: at(yesterday, "15:30"),
    seconds: 7200,
    comment: "Reviewed audit model.",
  },
  {
    id: "9005",
    issueKey: "ABC-105",
    started: at(twoDaysAgo, "14:00"),
    seconds: 6300,
    comment: "Tracing router state.",
  },
];

let worklogs = structuredClone(initialWorklogs);

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/__reset" && request.method === "POST") {
    worklogs = structuredClone(initialWorklogs);
    return json(response, 200, { ok: true });
  }

  if (path === "/__state") {
    return json(response, 200, {
      worklogs: worklogs.length,
      entries: worklogs,
    });
  }

  if (request.headers.authorization !== AUTH) {
    return json(response, 401, { errorMessages: ["Unauthorized"] });
  }

  if (path === "/rest/api/3/myself") {
    return json(response, 200, {
      accountId: "mock-account",
      displayName: "Dev User",
      emailAddress: "dev@example.com",
      timeZone: "Asia/Kolkata",
    });
  }

  if (path === "/rest/api/3/search/jql" && request.method === "POST") {
    const body = await readBody(request);
    const jql = String(body.jql || "");
    const selected = filterIssues(jql);
    return json(response, 200, {
      issues: selected.map(toJiraIssue),
      warningMessages: jql.includes("warn") ? ["Mock warning"] : undefined,
    });
  }

  const issueMatch = path.match(/^\/rest\/api\/3\/issue\/([A-Z][A-Z0-9_]+-\d+)$/);
  if (issueMatch && request.method === "GET") {
    const issue = issues.find((item) => item.key === issueMatch[1]);
    if (!issue) return json(response, 404, { errorMessages: ["Issue not found"] });
    return json(response, 200, toJiraIssue(issue));
  }

  const worklogListMatch = path.match(
    /^\/rest\/api\/3\/issue\/([A-Z][A-Z0-9_]+-\d+)\/worklog$/,
  );
  if (worklogListMatch) {
    const issueKey = worklogListMatch[1];
    if (request.method === "GET") {
      const after = Number(url.searchParams.get("startedAfter") || 0);
      const before = Number(url.searchParams.get("startedBefore") || Infinity);
      const matching = worklogs
        .filter((entry) => entry.issueKey === issueKey)
        .filter((entry) => {
          const time = new Date(entry.started).getTime();
          return time >= after && time <= before;
        })
        .map(toJiraWorklog);
      return json(response, 200, {
        startAt: 0,
        maxResults: 100,
        total: matching.length,
        worklogs: matching,
      });
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      const issue = issues.find((item) => item.key === issueKey);
      if (!issue) return json(response, 404, { errorMessages: ["Issue not found"] });
      const entry = {
        id: String(9100 + worklogs.length),
        issueKey,
        started: body.started,
        seconds: body.timeSpentSeconds,
        comment: adfText(body.comment),
      };
      worklogs = [entry, ...worklogs];
      return json(response, 201, toJiraWorklog(entry));
    }
  }

  const worklogMatch = path.match(
    /^\/rest\/api\/3\/issue\/([A-Z][A-Z0-9_]+-\d+)\/worklog\/(\d+)$/,
  );
  if (worklogMatch && request.method === "DELETE") {
    const [, issueKey, id] = worklogMatch;
    const entry = worklogs.find(
      (item) => item.issueKey === issueKey && item.id === id,
    );
    if (!entry) return json(response, 404, { errorMessages: ["Worklog not found"] });
    worklogs = worklogs.filter((item) => item !== entry);
    response.writeHead(204);
    response.end();
    return;
  }

  if (worklogMatch && request.method === "GET") {
    const [, issueKey, id] = worklogMatch;
    const entry = worklogs.find(
      (item) => item.issueKey === issueKey && item.id === id,
    );
    if (!entry) return json(response, 404, { errorMessages: ["Worklog not found"] });
    return json(response, 200, toJiraWorklog(entry));
  }

  return json(response, 404, { errorMessages: [`Mock route not found: ${path}`] });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock Jira listening on http://localhost:${PORT}`);
});

function filterIssues(jql) {
  let result = issues;

  if (/statusCategory\s*!=\s*Done/i.test(jql)) {
    result = result.filter((issue) => issue.category !== "done");
  }

  const keyEquals = jql.match(/key\s*=\s*([A-Z][A-Z0-9_]+-\d+)/i);
  if (keyEquals) {
    result = result.filter((issue) => issue.key === keyEquals[1].toUpperCase());
  }

  const textMatch = jql.match(/text\s*~\s*"([^"]+)"/i);
  if (textMatch) {
    const term = textMatch[1].toLowerCase();
    result = result.filter(
      (issue) =>
        issue.key.toLowerCase().includes(term) ||
        issue.summary.toLowerCase().includes(term),
    );
  }

  const keyMatch = jql.match(/key\s+in\s+\(([^)]+)\)/i);
  if (keyMatch) {
    const keys = keyMatch[1]
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""));
    result = result.filter((issue) => keys.includes(issue.key));
  }

  if (/worklogAuthor/i.test(jql)) {
    const keys = new Set(worklogs.map((entry) => entry.issueKey));
    result = result.filter((issue) => keys.has(issue.key));
  }

  return [...result].sort(
    (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
  );
}

function toJiraIssue(issue) {
  return {
    key: issue.key,
    fields: {
      summary: issue.summary,
      status: {
        name: issue.status,
        statusCategory: { key: issue.category },
      },
      issuetype: { name: issue.issueType },
      project: { key: issue.project, name: issue.project },
      assignee: {
        accountId: issue.assignee === "Dev User" ? "mock-account" : "other-account",
        displayName: issue.assignee,
      },
      updated: issue.updated,
      timetracking: {
        remainingEstimateSeconds: 7200,
      },
    },
  };
}

function toJiraWorklog(entry) {
  return {
    id: entry.id,
    started: entry.started,
    timeSpentSeconds: entry.seconds,
    comment: entry.comment
      ? {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: entry.comment }],
            },
          ],
        }
      : undefined,
    author: {
      accountId: "mock-account",
      displayName: "Dev User",
    },
  };
}

function adfText(node) {
  if (!node || typeof node !== "object") return undefined;
  const parts = [];
  if (typeof node.text === "string") parts.push(node.text);
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const text = adfText(child);
      if (text) parts.push(text);
    }
  }
  return parts.join(" ").trim() || undefined;
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
