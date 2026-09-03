import { z } from "zod";
import { slackCall } from "../slack.js";
import { ToolDefinition, CHANNEL_SCHEMA, CURSOR_SCHEMA } from "./types.js";
import { formatError, errorContent } from "../utils/errors.js";
import { formatMessages, SlackMessage } from "../utils/format.js";

/** Slack takes Unix seconds; accept ISO-8601 too and convert. */
export function toUnixSeconds(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (/^\d+(\.\d+)?$/.test(value)) return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid time "${value}": use ISO-8601 or Unix seconds`);
  return String(Math.floor(ms / 1000));
}

const schema = {
  channel: CHANNEL_SCHEMA,
  oldest: z.string().optional().describe("Only messages after this time (ISO-8601 or Unix seconds)"),
  latest: z.string().optional().describe("Only messages before this time (ISO-8601 or Unix seconds). Default now"),
  limit: z.number().int().min(1).max(200).default(50).describe("Messages per page (1-200). Default 50"),
  cursor: CURSOR_SCHEMA,
};

async function handler(params: Record<string, unknown>, env: { botToken: string }) {
  const channel = params.channel as string;
  const limit = (params.limit as number) ?? 50;
  try {
    const res = await slackCall<{ messages: SlackMessage[]; has_more?: boolean; response_metadata?: { next_cursor?: string } }>(
      env, "conversations.history",
      { channel, oldest: toUnixSeconds(params.oldest as string | undefined), latest: toUnixSeconds(params.latest as string | undefined), limit, cursor: params.cursor as string | undefined },
    );
    const messages = [...(res.messages ?? [])].sort((a, b) => Number(a.ts) - Number(b.ts));
    if (messages.length === 0) return { content: [{ type: "text" as const, text: `No messages in ${channel} for that window.` }] };
    let text = `${messages.length} messages in ${channel} (oldest first; use ts with get_thread for replies):\n\n${formatMessages(messages)}`;
    const next = res.response_metadata?.next_cursor;
    if (res.has_more && next) text += `\n\nNext page cursor: ${next}`;
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return errorContent(formatError(error, "get_channel_history"));
  }
}

export const getChannelHistory: ToolDefinition = {
  name: "get_channel_history",
  description:
    "Read messages from a public Slack channel the bot is a member of (oldest first, paginated, optional time window). Not a member yet: call join_channel first. Thread parents show a reply count; open them with get_thread.",
  schema,
  handler,
};
