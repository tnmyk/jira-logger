import { loadConnection } from "./storage";
import type {
  ApiErrorCode,
  ApiErrorPayload,
  Connection,
  CreateWorklogInput,
  Profile,
  SearchResponse,
  WorklogEntry,
  WorklogSummary,
} from "./types";

export class ApiClientError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;
  jiraErrors?: Record<string, string>;
  retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    status = 500,
    options?: {
      details?: unknown;
      jiraErrors?: Record<string, string>;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = options?.details;
    this.jiraErrors = options?.jiraErrors;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function authHeader(connection: Pick<Connection, "email" | "token">): string {
  return `Basic ${toBase64(`${connection.email}:${connection.token}`)}`;
}

function headersFor(
  connection: Pick<Connection, "baseUrl" | "email" | "token">,
): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: authHeader(connection),
    "X-Jira-Base-Url": connection.baseUrl,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = undefined;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiClientError(
        "JIRA_UNAVAILABLE",
        "Jira returned a non-JSON response. Check the site URL and token.",
        response.status,
      );
    }
  }

  if (!response.ok) {
    const payload = data as Partial<ApiErrorPayload> | undefined;
    const error = payload?.error;
    throw new ApiClientError(
      error?.code ?? "UNKNOWN",
      error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      {
        details: error?.details,
        jiraErrors: error?.jiraErrors,
        retryAfterSeconds: error?.retryAfterSeconds,
      },
    );
  }

  return data as T;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  connectionOverride?: Pick<Connection, "baseUrl" | "email" | "token">,
): Promise<T> {
  const connection = connectionOverride ?? loadConnection();
  if (!connection) {
    throw new ApiClientError("JIRA_AUTH", "Connect your Jira account first.", 401);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        ...headersFor(connection),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiClientError(
      "NETWORK",
      "Could not reach the local Jira proxy. Is the Astro dev server running?",
      0,
    );
  }

  return parseResponse<T>(response);
}

export async function validateConnection(input: {
  baseUrl: string;
  email: string;
  token: string;
}): Promise<Profile> {
  const trimmed = {
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
    email: input.email.trim(),
    token: input.token.trim(),
  };

  if (!trimmed.baseUrl || !trimmed.email || !trimmed.token) {
    throw new ApiClientError("INVALID_INPUT", "Jira URL, email, and API token are required.", 400);
  }

  try {
    const url = new URL(trimmed.baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new ApiClientError("INVALID_INPUT", "Enter a valid Jira URL.", 400);
  }

  return request<Profile>(
    "/api/jira/validate",
    { method: "POST", body: JSON.stringify({}) },
    {
      baseUrl: trimmed.baseUrl,
      email: trimmed.email,
      token: trimmed.token,
    },
  );
}

export async function searchJql(
  jql: string,
  nextPageToken?: string,
  maxResults = 50,
): Promise<SearchResponse> {
  return request<SearchResponse>("/api/jira/search", {
    method: "POST",
    body: JSON.stringify({
      jql,
      nextPageToken: nextPageToken || undefined,
      maxResults,
    }),
  });
}

export async function getIssue(key: string): Promise<{ issue: SearchResponse["issues"][number] }> {
  return request<{ issue: SearchResponse["issues"][number] }>(
    `/api/jira/issue?key=${encodeURIComponent(key)}`,
    { method: "GET" },
  );
}

export async function createWorklog(input: CreateWorklogInput): Promise<WorklogEntry> {
  return request<WorklogEntry>("/api/jira/worklogs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getWorklogSummary(
  from: string,
  to: string,
  connection: Pick<Connection, "timeZone" | "accountId">,
): Promise<WorklogSummary> {
  const params = new URLSearchParams({
    from,
    to,
    timeZone: connection.timeZone,
    accountId: connection.accountId,
  });

  return request<WorklogSummary>(`/api/jira/worklogs/summary?${params.toString()}`, {
    method: "GET",
  });
}

export async function deleteWorklog(
  issueKey: string,
  id: string,
  adjustEstimate: "leave" | "auto" = "leave",
): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/jira/worklogs/delete", {
    method: "POST",
    body: JSON.stringify({ issueKey, id, adjustEstimate }),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
