import type { APIRoute } from "astro";
import { z } from "zod";
import {
  errorResponse,
  jsonResponse,
  parseInput,
  readJsonBody,
} from "@/lib/jira/errors";
import { readJiraContext } from "@/lib/jira/proxy";
import { deleteWorklog } from "@/lib/jira/worklogs";

export const prerender = false;

const schema = z.object({
  issueKey: z.string().min(1, "Ticket key is required."),
  id: z.string().regex(/^\d+$/, "Worklog id is not valid."),
  adjustEstimate: z.enum(["leave", "auto"]).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = parseInput(schema, await readJsonBody(request));
    const context = readJiraContext(request);
    const result = await deleteWorklog(context, input);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
};
