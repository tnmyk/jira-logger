import type { APIRoute } from "astro";
import { z } from "zod";
import {
  errorResponse,
  jsonResponse,
  parseInput,
  readJsonBody,
} from "@/lib/jira/errors";
import { readJiraContext } from "@/lib/jira/proxy";
import { createWorklog } from "@/lib/jira/worklogs";

export const prerender = false;

const schema = z.object({
  issueKey: z.string().min(1, "Ticket key is required."),
  seconds: z.number().int().positive().max(86400, "Worklog cannot exceed 24 hours."),
  started: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{4}$/,
      "Worklog start time is not valid.",
    ),
  comment: z.string().max(10000).optional(),
  adjustEstimate: z.enum(["leave", "auto"]).optional(),
  notifyWatchers: z.boolean().optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = parseInput(schema, await readJsonBody(request));
    const context = readJiraContext(request);
    const worklog = await createWorklog(context, input);
    return jsonResponse(worklog, 201);
  } catch (error) {
    return errorResponse(error);
  }
};
