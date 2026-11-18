import { ApiError } from "./errors";

export type JiraContext = {
  baseUrl: string;
  authorization: string;
};

const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
]);

export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ApiError("INVALID_INPUT", "Jira URL is not valid.", 400);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ApiError("INVALID_INPUT", "Jira URL must use http or https.", 400);
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new ApiError(
      "INVALID_INPUT",
      "Jira URL must not include credentials, query strings, or fragments.",
      400,
    );
  }

  const hostname = url.hostname.toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

  if (BLOCKED_HOSTS.has(hostname)) {
    throw new ApiError("INVALID_INPUT", "That host is not allowed.", 400);
  }

  if (!isLocal && !hostname.endsWith(".atlassian.net")) {
    throw new ApiError(
      "INVALID_INPUT",
      "Use your Atlassian Cloud site URL, ending in .atlassian.net.",
      400,
    );
  }

  if (url.protocol === "http:" && !isLocal) {
    throw new ApiError(
      "INVALID_INPUT",
      "Use https for a remote Jira site. Plain http is allowed only for localhost.",
      400,
    );
  }

  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

export function readJiraContext(request: Request): JiraContext {
  const baseUrl = request.headers.get("x-jira-base-url");
  const authorization = request.headers.get("authorization");

  if (!baseUrl || !authorization) {
    throw new ApiError(
      "JIRA_AUTH",
      "Missing Jira connection headers. Reconnect your account.",
      401,
    );
  }

  if (!/^(Basic|Bearer)\s+/i.test(authorization)) {
    throw new ApiError("JIRA_AUTH", "Unsupported Jira authorization header.", 401);
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    authorization,
  };
}

type JiraErrorBody = {
  errorMessages?: string[];
  errors?: Record<string, string>;
};

function jiraErrorMessage(body: JiraErrorBody | undefined, fallback: string): string {
  const messages = body?.errorMessages?.filter(Boolean) ?? [];
  if (messages.length > 0) return messages.join(" ");
  const fieldErrors = body?.errors ? Object.values(body.errors).filter(Boolean) : [];
  if (fieldErrors.length > 0) return fieldErrors.join(" ");
  return fallback;
}

function mapJiraError(status: number, body: JiraErrorBody | undefined, response: Response): ApiError {
  const retryAfter = Number(response.headers.get("retry-after"));
  const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;

  if (status === 401) {
    return new ApiError(
      "JIRA_AUTH",
      "Jira rejected the credentials. Reconnect with a valid email and API token.",
      401,
    );
  }
  if (status === 403) {
    return new ApiError(
      "JIRA_FORBIDDEN",
      "You do not have permission to read or change this Jira item.",
      403,
      { jiraErrors: body?.errors },
    );
  }
  if (status === 404) {
    return new ApiError("JIRA_NOT_FOUND", "Jira could not find that item.", 404);
  }
  if (status === 429) {
    return new ApiError(
      "JIRA_RATE_LIMIT",
      "Jira rate limit reached. Wait a moment and try again.",
      429,
      { retryAfterSeconds },
    );
  }
  if (status === 400) {
    return new ApiError(
      "JIRA_VALIDATION",
      jiraErrorMessage(body, "Jira rejected this query or request."),
      400,
      { jiraErrors: body?.errors },
    );
  }
  if (status >= 500) {
    return new ApiError(
      "JIRA_UNAVAILABLE",
      "Jira is unavailable right now. Try again shortly.",
      502,
    );
  }

  return new ApiError(
    "UNKNOWN",
    jiraErrorMessage(body, `Jira request failed with status ${status}.`),
    status,
    { jiraErrors: body?.errors },
  );
}

export async function jiraFetch<T>(
  context: JiraContext,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${context.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "application/json",
        Authorization: context.authorization,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError("JIRA_UNAVAILABLE", "Could not reach Jira.", 502);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new ApiError(
      "JIRA_UNAVAILABLE",
      "Jira returned a redirect. Check the site URL and authentication.",
      502,
    );
  }

  const text = await response.text();
  let body: unknown = undefined;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new ApiError(
          "JIRA_UNAVAILABLE",
          "Jira returned a non-JSON response. Check the Jira URL.",
          502,
        );
      }
    }
  }

  if (!response.ok) {
    throw mapJiraError(response.status, body as JiraErrorBody | undefined, response);
  }

  return body as T;
}

export type JiraMyself = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  timeZone?: string;
};

export async function getMyself(context: JiraContext): Promise<JiraMyself> {
  return jiraFetch<JiraMyself>(context, "/rest/api/3/myself");
}
