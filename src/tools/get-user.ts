import { z } from "zod";
import { slackCall } from "../slack.js";
import { ToolDefinition } from "./types.js";
import { formatError, errorContent } from "../utils/errors.js";

const schema = { user: z.string().regex(/^[UW][A-Z0-9]+$/, "a Slack user id like U0123ABCD").describe("User id (U…) as it appears in messages") };

interface SlackUser { id: string; name?: string; real_name?: string; tz?: string; is_bot?: boolean; deleted?: boolean; profile?: { display_name?: string; title?: string } }

async function handler(params: Record<string, unknown>, env: { botToken: string }) {
  const user = params.user as string;
  try {
    const res = await slackCall<{ user: SlackUser }>(env, "users.info", { user });
    const u = res.user;
    const text = [
      `${u.id}: ${u.real_name ?? u.name ?? "?"}`,
      `handle: @${u.name ?? "?"}${u.profile?.display_name ? ` (display: ${u.profile.display_name})` : ""}`,
      u.profile?.title ? `title: ${u.profile.title}` : null,
      u.tz ? `timezone: ${u.tz}` : null,
      `bot: ${u.is_bot ? "yes" : "no"}, deleted: ${u.deleted ? "yes" : "no"}`,
    ].filter(Boolean).join("\n");
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return errorContent(formatError(error, "get_user"));
  }
}

export const getUser: ToolDefinition = {
  name: "get_user",
  description: "Look up a Slack user by id (U…) as seen in messages: name, handle, title, timezone, whether it is a bot.",
  schema,
  handler,
};
