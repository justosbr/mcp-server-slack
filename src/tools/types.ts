import { z } from "zod";
import type { SlackEnv } from "../config.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (params: Record<string, unknown>, env: SlackEnv) => Promise<ToolResult>;
}

export const CHANNEL_SCHEMA = z.string().regex(/^C[A-Z0-9]+$/, "a Slack channel id like C0123ABCD").describe("Channel id (C…). Use list_channels to find it.");
export const CURSOR_SCHEMA = z.string().optional().describe("Pagination cursor from a previous response");
