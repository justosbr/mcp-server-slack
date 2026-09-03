#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { validateEnv } from "./config.js";
import { listChannels } from "./tools/list-channels.js";
import { joinChannel } from "./tools/join-channel.js";
import { getChannelHistory } from "./tools/get-channel-history.js";
import { getThread } from "./tools/get-thread.js";
import { getUser } from "./tools/get-user.js";

const env = validateEnv();

const server = new McpServer({ name: "mcp-server-slack", version: "0.1.0" });

for (const tool of [listChannels, joinChannel, getChannelHistory, getThread, getUser]) {
  server.tool(tool.name, tool.description, tool.schema, (params) =>
    tool.handler(params as Record<string, unknown>, env) as Promise<CallToolResult>,
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-server-slack connected (public channels, bot token)");
