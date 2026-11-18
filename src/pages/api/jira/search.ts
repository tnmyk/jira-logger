import type { APIRoute } from "astro";
import { z } from "zod";
import {
  errorResponse,
  jsonResponse,
  parseInput,
  readJsonBody,
} from "@/lib/jira/errors";
import { readJiraContext } from "@/lib/jira/proxy";
import { searchIssues } from "@/lib/jira/search";

export const prerender = false;

const schema = z.object({
  jql: z.string().min(1, "JQL cannot be empty.").max(5000, "JQL is too long."),
  nextPageToken: z.string().optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = parseInput(schema, await readJsonBody(request));
    const context = readJiraContext(request);
    const result = await searchIssues(context, input);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
};
