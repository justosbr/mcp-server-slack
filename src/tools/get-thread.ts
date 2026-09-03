import { z } from "zod";
import { slackCall } from "../slack.js";
import { ToolDefinition, CHANNEL_SCHEMA, CURSOR_SCHEMA } from "./types.js";
import { formatError, errorContent } from "../utils/errors.js";
import { formatMessages, SlackMessage } from "../utils/format.js";

const schema = {
  channel: CHANNEL_SCHEMA,
  thread_ts: z.string().regex(/^\d+\.\d+$/).describe("The parent message ts (from get_channel_history)"),
  limit: z.number().int().min(1).max(200).default(50).describe("Replies per page (1-200). Default 50"),
  cursor: CURSOR_SCHEMA,
};

async function handler(params: Record<string, unknown>, env: { botToken: string }) {
  const channel = params.channel as string;
  const ts = params.thread_ts as string;
  const limit = (params.limit as number) ?? 50;
  try {
    const res = await slackCall<{ messages: SlackMessage[]; has_more?: boolean; response_metadata?: { next_cursor?: string } }>(
      env, "conversations.replies", { channel, ts, limit, cursor: params.cursor as string | undefined },
    );
    const messages = res.messages ?? [];
    if (messages.length === 0) return { content: [{ type: "text" as const, text: `No messages in thread ${ts}.` }] };
    let text = `${messages.length} messages in thread ${ts} (parent first):\n\n${formatMessages(messages)}`;
    const next = res.response_metadata?.next_cursor;
    if (res.has_more && next) text += `\n\nNext page cursor: ${next}`;
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return errorContent(formatError(error, "get_thread"));
  }
}

export const getThread: ToolDefinition = {
  name: "get_thread",
  description: "Read a thread (parent + replies) in a public Slack channel the bot is a member of, given the parent message ts.",
  schema,
  handler,
};
