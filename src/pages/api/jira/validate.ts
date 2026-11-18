import type { APIRoute } from "astro";
import { errorResponse, jsonResponse } from "@/lib/jira/errors";
import { getMyself, readJiraContext } from "@/lib/jira/proxy";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const context = readJiraContext(request);
    const myself = await getMyself(context);

    return jsonResponse({
      baseUrl: context.baseUrl,
      accountId: myself.accountId,
      displayName: myself.displayName,
      emailAddress: myself.emailAddress,
      timeZone: myself.timeZone,
    });
  } catch (error) {
    return errorResponse(error);
  }
};
