import { SlackApiError } from "../slack.js";
import type { ToolResult } from "../tools/types.js";

export function formatError(error: unknown, toolName: string): string {
  if (error instanceof SlackApiError) {
    switch (error.code) {
      case "not_in_channel":
        return `${toolName}: the bot is not a member of that channel, so its history is not readable. Call join_channel with the same channel id, then retry.`;
      case "channel_not_found":
        return `${toolName}: channel not found. Use list_channels to find the id; private channels and DMs are not reachable.`;
      case "ratelimited":
        return `${toolName}: Slack rate limit reached. Wait ${error.retryAfterSeconds ?? "a few"} seconds before retrying.`;
      default:
        return `${toolName}: Slack ${error.method} returned ${error.code}.`;
    }
  }
  if (error instanceof Error) return `Error in ${toolName}: ${error.message}`;
  return `Unknown error in ${toolName}: ${String(error)}`;
}

export function errorContent(message: string): ToolResult {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
