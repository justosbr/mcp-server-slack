import { z } from "zod";
import { slackCall } from "../slack.js";
import { ToolDefinition, CURSOR_SCHEMA } from "./types.js";
import { formatError, errorContent } from "../utils/errors.js";
import { clip } from "../utils/format.js";
import type { SlackEnv } from "../config.js";

const schema = {
  query: z.string().max(200).optional().describe("Case-insensitive substring matched against channel name, topic, and purpose"),
  limit: z.number().int().min(1).max(200).default(100).describe("Channels per page (1-200). Default 100"),
  cursor: CURSOR_SCHEMA,
};

interface Channel {
  id: string; name: string; num_members?: number; is_member?: boolean;
  topic?: { value?: string }; purpose?: { value?: string };
}

async function handler(params: Record<string, unknown>, env: SlackEnv) {
  const query = (params.query as string | undefined)?.toLowerCase();
  const limit = (params.limit as number) ?? 100;
  const cursor = params.cursor as string | undefined;
  try {
    const res = await slackCall<{ channels: Channel[]; response_metadata?: { next_cursor?: string } }>(
      env, "conversations.list", { types: "public_channel", exclude_archived: true, limit, cursor },
    );
    let channels = res.channels ?? [];
    if (query) {
      channels = channels.filter((c) =>
        [c.name, c.topic?.value ?? "", c.purpose?.value ?? ""].some((s) => s.toLowerCase().includes(query)),
      );
    }
    if (channels.length === 0) {
      return { content: [{ type: "text" as const, text: `No public channels${query ? ` matching "${query}"` : ""} on this page.` }] };
    }
    const lines = channels.map((c) => {
      const about = [c.topic?.value, c.purpose?.value].filter(Boolean).map((s) => clip(s!, 120)).join(" | ");
      return `- #${c.name} (${c.id}) members: ${c.num_members ?? "?"}, member: ${c.is_member ? "yes" : "no"}${about ? ` — ${about}` : ""}`;
    });
    let text = `${channels.length} public channels:\n\n${lines.join("\n")}`;
    const next = res.response_metadata?.next_cursor;
    if (next) text += `\n\nNext page cursor: ${next}`;
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return errorContent(formatError(error, "list_channels"));
  }
}

export const listChannels: ToolDefinition = {
  name: "list_channels",
  description:
    "List public Slack channels (never private channels or DMs) with id, member count, whether the bot is a member, topic and purpose. Optional substring filter. Use the id with the other tools; if member is 'no', call join_channel before reading history.",
  schema,
  handler,
};
