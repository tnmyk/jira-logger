import type { APIRoute } from "astro";
import { ApiError, errorResponse, jsonResponse } from "@/lib/jira/errors";
import { readJiraContext } from "@/lib/jira/proxy";
import { getIssue } from "@/lib/jira/search";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const key = new URL(request.url).searchParams.get("key")?.trim();
    if (!key) {
      throw new ApiError("INVALID_INPUT", "Ticket key is required.", 400);
    }

    const context = readJiraContext(request);
    const issue = await getIssue(context, key);
    return jsonResponse({ issue });
  } catch (error) {
    return errorResponse(error);
  }
};
