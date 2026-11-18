export type Deployment = "cloud";
export type AppView = "today" | "week" | "search";

export type Connection = {
  baseUrl: string;
  deployment: Deployment;
  email: string;
  token: string;
  accountId: string;
  displayName: string;
  timeZone: string;
};

export type Profile = {
  baseUrl: string;
  accountId: string;
  displayName: string;
  emailAddress?: string;
  timeZone?: string;
};

export type TicketStatusCategory = "todo" | "in-progress" | "done" | "unknown";

export type Ticket = {
  key: string;
  summary: string;
  status: string;
  statusCategory: TicketStatusCategory;
  issueType?: string;
  priority?: string;
  assignee?: {
    id: string;
    name: string;
  };
  reporter?: {
    id: string;
    name: string;
  };
  project?: {
    key: string;
    name: string;
  };
  updated?: string;
  url: string;
  timeSpentSeconds?: number;
  remainingEstimateSeconds?: number;
};

export type SearchResponse = {
  issues: Ticket[];
  nextPageToken?: string;
  warningMessages?: string[];
};

export type WorklogEntry = {
  id: string;
  issueKey: string;
  issueSummary?: string;
  started: string;
  seconds: number;
  comment?: string;
  authorId?: string;
  authorName?: string;
};

export type WorklogSummary = {
  entries: WorklogEntry[];
  byDay: Record<string, number>;
  byIssue: Record<string, number>;
  totalSeconds: number;
};

export type Preferences = {
  defaultJql: string;
  startTime: string;
  quickDurations: number[];
  weekStart: "monday" | "sunday";
  adjustEstimate: "leave" | "auto";
  notifyWatchers: boolean;
  targetMinutesPerDay: number;
  showWeekends: boolean;
  defaultDurationMinutes: number;
  defaultComment: string;
};

export type FixedTicket = {
  key: string;
  minutes: number;
  comment?: string;
};

export type Favorites = {
  pins: string[];
  fixed: FixedTicket[];
};

export type CreateWorklogInput = {
  issueKey: string;
  seconds: number;
  started: string;
  comment?: string;
  adjustEstimate?: "leave" | "auto";
  notifyWatchers?: boolean;
};

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "JIRA_AUTH"
  | "JIRA_FORBIDDEN"
  | "JIRA_NOT_FOUND"
  | "JIRA_RATE_LIMIT"
  | "JIRA_UNAVAILABLE"
  | "JIRA_VALIDATION"
  | "NETWORK"
  | "UNKNOWN";

export type ApiErrorPayload = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    jiraErrors?: Record<string, string>;
    retryAfterSeconds?: number;
  };
};
