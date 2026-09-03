import { slackCall } from "../slack.js";
import { ToolDefinition, CHANNEL_SCHEMA } from "./types.js";
import { formatError, errorContent } from "../utils/errors.js";
import type { SlackEnv } from "../config.js";

const schema = { channel: CHANNEL_SCHEMA };

interface ChannelInfo { id: string; name: string; is_channel?: boolean; is_private?: boolean; is_archived?: boolean }

async function handler(params: Record<string, unknown>, env: SlackEnv) {
  const channel = params.channel as string;
  try {
    const info = await slackCall<{ channel: ChannelInfo }>(env, "conversations.info", { channel });
    const c = info.channel;
    if (!c?.is_channel || c.is_private) {
      return errorContent(`join_channel: ${channel} is not a public channel; this server only joins public channels.`);
    }
    if (c.is_archived) {
      return errorContent(`join_channel: #${c.name} (${channel}) is archived and cannot be joined.`);
    }
    const joined = await slackCall<{ warning?: string; channel: ChannelInfo }>(env, "conversations.join", { channel }, { post: true });
    const already = joined.warning?.includes("already_in_channel");
    return { content: [{ type: "text" as const, text: already ? `Already a member of #${c.name} (${channel}).` : `Joined #${c.name} (${channel}). Its history is now readable.` }] };
  } catch (error) {
    return errorContent(formatError(error, "join_channel"));
  }
}

export const joinChannel: ToolDefinition = {
  name: "join_channel",
  description:
    "Join a PUBLIC Slack channel so its history becomes readable. The one membership change this server makes; it is visible in the channel. Refuses private channels, DMs, and archived channels.",
  schema,
  handler,
};
