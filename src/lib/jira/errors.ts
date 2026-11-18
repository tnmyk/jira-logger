import type { ZodType } from "zod";
import type { ApiErrorCode, ApiErrorPayload } from "../types";

export class ApiError extends Error {
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
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = options?.details;
    this.jiraErrors = options?.jiraErrors;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const payload: ApiErrorPayload = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        jiraErrors: error.jiraErrors,
        retryAfterSeconds: error.retryAfterSeconds,
      },
    };
    return jsonResponse(payload, error.status);
  }

  return jsonResponse(
    {
      error: {
        code: "UNKNOWN",
        message: "Unexpected local proxy error.",
      },
    } satisfies ApiErrorPayload,
    500,
  );
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("INVALID_INPUT", "Request body must be valid JSON.", 400);
  }
}

export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid input.";
    throw new ApiError("INVALID_INPUT", message, 400);
  }
  return result.data;
}
