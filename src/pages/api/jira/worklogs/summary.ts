import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, errorResponse, jsonResponse, parseInput } from "@/lib/jira/errors";
import { readJiraContext } from "@/lib/jira/proxy";
import { getWorklogSummary } from "@/lib/jira/worklogs";

export const prerender = false;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");
const schema = z.object({
  from: dateSchema,
  to: dateSchema,
  timeZone: z.string().optional(),
  accountId: z.string().optional(),
});

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const params = new URL(request.url).searchParams;
    const input = parseInput(schema, {
      from: params.get("from"),
      to: params.get("to"),
      timeZone: params.get("timeZone") ?? undefined,
      accountId: params.get("accountId") ?? undefined,
    });

    if (!isRealDate(input.from) || !isRealDate(input.to)) {
      throw new ApiError("INVALID_INPUT", "Use real calendar dates.", 400);
    }
    if (input.timeZone && !isValidTimeZone(input.timeZone)) {
      throw new ApiError("INVALID_INPUT", "Timezone is not valid.", 400);
    }

    const fromTime = new Date(`${input.from}T00:00:00Z`).getTime();
    const toTime = new Date(`${input.to}T00:00:00Z`).getTime();
    if (toTime < fromTime) {
      throw new ApiError("INVALID_INPUT", "The date range is reversed.", 400);
    }
    if (toTime - fromTime > 30 * 86_400_000) {
      throw new ApiError(
        "INVALID_INPUT",
        "The date range cannot exceed 31 calendar days.",
        400,
      );
    }

    const context = readJiraContext(request);
    const summary = await getWorklogSummary(context, input);
    return jsonResponse(summary);
  } catch (error) {
    return errorResponse(error);
  }
};
